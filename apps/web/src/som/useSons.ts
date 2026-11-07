import type { Visao } from '@truco/engine';
import { useEffect, useRef } from 'react';
import type { EstadoLoja } from '../rede/loja';
import { cadeiraNaPosicao } from '../logica/posicoes';
import { tiposDaMesa } from '../componentes/Personagem';
import { sonsDaAcao, sonsDoEstado } from './decidir';
import { arquivoDaFala, ehVozPessoal, FALAS, falaDoBalao } from './falas';
import { destravarAudio, sintetizar, tocarArquivo } from './sintese';

export const CHAVE_SOM = 'truco:som';

/** Som ligado por padrão; a escolha fica no aparelho. */
export function lerSomLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== '0';
  } catch {
    return true;
  }
}

export function gravarSomLigado(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE_SOM, ligado ? '1' : '0');
  } catch {
    // modo privado: vale só nesta visita
  }
}

/**
 * Sons da mesa: ações que chegam (carta, truco, embaralhar...), rodada/mão/partida decididas,
 * a vez que chega para mim e os tiques dos últimos 5 s do meu prazo. Nada toca no primeiro
 * estado (F5, reconexão) nem com o som desligado.
 */
export function useSonsDaMesa(snap: EstadoLoja, ligado: boolean, agora: number): void {
  const msg = snap.msg;
  const minha = msg?.minhaCadeira ?? 0;

  // O navegador só deixa tocar depois de um gesto: qualquer toque/tecla libera.
  useEffect(() => {
    const liberar = () => destravarAudio();
    window.addEventListener('pointerdown', liberar);
    window.addEventListener('keydown', liberar);
    return () => {
      window.removeEventListener('pointerdown', liberar);
      window.removeEventListener('keydown', liberar);
    };
  }, []);

  const visto = useRef<number | null>(null);
  const movimentos = snap.movimentos ?? [];
  const ultimo = movimentos.at(-1)?.id ?? 0;
  useEffect(() => {
    const desde = visto.current;
    visto.current = ultimo;
    if (desde === null || ultimo < desde || !ligado) return;
    for (const { id, msg: a } of movimentos) if (id > desde) for (const s of sonsDaAcao(a, minha)) sintetizar(s.nome, s.atraso);
    // `movimentos` muda junto com `ultimo`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimo]);

  const visaoAntes = useRef<Visao | null>(null);
  const visao = msg?.visao ?? null;
  useEffect(() => {
    const antes = visaoAntes.current;
    visaoAntes.current = visao;
    if (!visao || !ligado) return;
    for (const s of sonsDoEstado(antes, visao, minha)) sintetizar(s.nome, s.atraso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao]);

  // Minha vez de jogar carta: um sino; nos últimos 5 s, um tique por segundo.
  const prazo = msg?.prazo ?? null;
  const meu = !!prazo && prazo.cadeiras.includes(minha);
  const jogando = visao?.fase === 'jogando' || visao?.fase === 'respondendoTruco';
  const minhaVez = meu && jogando;
  const eraMinha = useRef(false);
  useEffect(() => {
    if (minhaVez && !eraMinha.current && ligado) sintetizar('vez');
    eraMinha.current = minhaVez;
  }, [minhaVez, ligado]);
  const restam = meu && prazo ? Math.ceil((prazo.ate - agora) / 1000) : null;
  const ultimoTique = useRef<number | null>(null);
  useEffect(() => {
    if (restam === null || restam > 5 || restam <= 0) return;
    if (ultimoTique.current === restam) return;
    ultimoTique.current = restam;
    if (ligado) sintetizar('tique');
  }, [restam, ligado]);

  // Falas: cada balão novo (ação ou fala) sai na voz do tipo de jogador de quem falou —
  // o mesmo desenho do 2.5D (cima, esquerda, direita) e um quarto tipo para mim.
  const ultimoEvento = snap.eventos.at(-1)?.id ?? 0;
  const eventoVisto = useRef<number | null>(null);
  useEffect(() => {
    const desde = eventoVisto.current;
    eventoVisto.current = ultimoEvento;
    if (desde === null || ultimoEvento < desde || !ligado || !msg) return;
    const ordem = (['cima', 'esquerda', 'direita', 'baixo'] as const).map((p) => cadeiraNaPosicao(minha, p));
    const tipos = tiposDaMesa(ordem.map((c) => msg.cadeiras[c]?.nome ?? `Cadeira ${c + 1}`));
    for (const e of snap.eventos) {
      if (e.id <= desde || e.tipo === 'sinal') continue;
      const fala = falaDoBalao(e.texto);
      if (!fala) continue;
      // Conta com voz própria (marcada pelo servidor) fala com ela; o resto, com a voz do tipo.
      const pessoal = msg.cadeiras[e.de]?.voz;
      const tipo = ehVozPessoal(pessoal) ? pessoal : tipos[ordem.indexOf(e.de)];
      const n = Math.floor(Math.random() * FALAS[fala].ditos.length);
      tocarArquivo(arquivoDaFala(tipo, fala, n), 0.05);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoEvento]);

  const idBatida = snap.batida?.id;
  useEffect(() => {
    const b = snap.batida;
    if (b && ligado && Date.now() - b.em < 1_000) sintetizar('tum', 0, b.forca);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idBatida]);
}
