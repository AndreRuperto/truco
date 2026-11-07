import type { MsgChat, MsgEstado } from '@truco/protocolo';
import { useEffect, useRef, useState } from 'react';
import { useAvisoNaAba } from '../logica/avisoAba';
import { Avatar } from '../componentes/Avatar';
import { Chat } from '../componentes/Chat';
import { ConfirmarSaida } from '../componentes/ConfirmarSaida';
import { posicaoRelativa } from '../logica/posicoes';
import { linkConvite } from '../logica/rotas';
import { souDono } from '../logica/sala';
import { resumoRegras } from '../logica/textos';

interface Props {
  msg: MsgEstado;
  aoIniciar: () => void;
  aoSair: () => void;
  /** `roomId` (código do convite). */
  salaId?: string | null;
  /** Origem da página (testes passam uma fixa). */
  origem?: string;
  chat?: MsgChat[];
  aoChat?: (texto: string) => void;
}

export function SalaEspera({ msg, aoIniciar, aoSair, salaId = null, origem = window.location.origin, chat = [], aoChat }: Props) {
  const dono = souDono(msg);
  const modo = msg.modo;
  // Faltam humanos, não cadeiras: as vazias que sobrarem viram bots ao começar.
  const sentados = msg.cadeiras.filter((c) => c.tipo === 'humano').length;
  const faltam = Math.max(0, msg.humanosEsperados - sentados);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  // Quem esperava em outra aba fica sabendo que alguém chegou (o título pisca até voltar).
  const nomesHumanos = msg.cadeiras.filter((c, i) => c.tipo === 'humano' && i !== msg.minhaCadeira).map((c) => c.nome ?? 'Alguém');
  const vistos = useRef(nomesHumanos.length);
  const [chegou, setChegou] = useState<string | null>(null);
  useEffect(() => {
    if (nomesHumanos.length > vistos.current) setChegou(nomesHumanos.at(-1)!);
    vistos.current = nomesHumanos.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomesHumanos.length]);
  useEffect(() => {
    const voltou = () => {
      if (!document.hidden) setChegou(null);
    };
    document.addEventListener('visibilitychange', voltou);
    return () => document.removeEventListener('visibilitychange', voltou);
  }, []);
  useAvisoNaAba(chegou !== null, `${chegou ?? ''} entrou na mesa · Truco`);
  const minha = msg.minhaCadeira;
  return (
    <main className="sala-espera">
      <header className="sala-topo">
        <h1>{modo === 'privada' ? 'Mesa privada' : modo === 'ranqueada' ? 'Ranqueada' : 'Sala de espera'}</h1>
        <p className="sala-situacao" role="status">
          {faltam > 0 ? `Esperando ${faltam} ${faltam === 1 ? 'jogador' : 'jogadores'}…` : 'Começando…'}
        </p>
      </header>

      <section className="sala-mesa" aria-label="Lugares na mesa">
        <ul className="sala-lugares">
          {msg.cadeiras.map((c, i) => {
            const pos = posicaoRelativa(minha, i as 0 | 1 | 2 | 3);
            const nossa = i % 2 === minha % 2;
            const estado = c.tipo === 'bot' ? 'bot' : c.tipo === 'humano' ? (c.conectado ? 'pronto' : 'caiu') : 'esperando…';
            return (
              <li key={i} className={`lugar-espera pos-${pos} ${nossa ? 'nossa' : 'deles'} ${c.tipo === 'vazia' ? 'vago' : ''}`}>
                {c.nome ? <Avatar apelido={c.nome} avatar={c.avatar} tamanho={56} /> : <span className="cadeira-vaga" aria-hidden="true" />}
                <span className="lugar-nome">{c.nome ? (i === minha ? `${c.nome} (você)` : c.nome) : 'Lugar vago'}</span>
                <span className="lugar-estado">{estado}</span>
                {i !== minha && <span className="lugar-dupla">{nossa ? 'sua dupla' : 'adversário'}</span>}
              </li>
            );
          })}
          <li className="sala-tampo" aria-hidden="true">
            <span className="sala-baralho" />
          </li>
        </ul>
      </section>

      <div className="sala-lado">
        {modo === 'privada' && salaId && <Convite link={linkConvite(origem, salaId)} />}
        <section className="sala-regras" aria-labelledby="titulo-regras-casa">
          <h2 id="titulo-regras-casa">Regras da casa</h2>
          <ul aria-label="Regras da mesa">
            {resumoRegras(msg.regras, msg.chanceInterceptarSinal, msg.sinais !== false).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        {modo === 'privada' && aoChat && <Chat mensagens={chat} aoEnviar={aoChat} />}
      </div>

      <footer className="sala-acoes">
        {modo === 'ranqueada' ? (
          <p>Partida ranqueada: começa quando todos entrarem.</p>
        ) : dono ? (
          <button type="button" className="botao-principal" onClick={aoIniciar}>
            Começar com bots
          </button>
        ) : (
          <p>Só o dono da mesa pode começar antes de lotar.</p>
        )}
        <button type="button" className="sala-sair" onClick={modo === 'ranqueada' ? () => setConfirmarSaida(true) : aoSair}>
          Sair
        </button>
      </footer>
      {confirmarSaida && <ConfirmarSaida ranqueada aoSair={aoSair} aoCancelar={() => setConfirmarSaida(false)} textoFicar="Continuar esperando" />}
    </main>
  );
}

/** Copia com a Clipboard API; sem ela (HTTP, navegador antigo) ou se recusar, tenta execCommand. */
async function copiar(texto: string, campo: HTMLInputElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // cai no execCommand
  }
  if (!campo) return false;
  campo.focus();
  campo.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

function Convite({ link }: { link: string }) {
  const [situacao, setSituacao] = useState<'livre' | 'copiado' | 'falhou'>('livre');
  const campo = useRef<HTMLInputElement>(null);
  const recado = `Bora um truco? Senta aqui: ${link}`;
  return (
    <section className="convite" aria-labelledby="titulo-convite">
      <h2 id="titulo-convite">Chame a turma</h2>
      <p className="convite-dica">Quem abrir o link senta na próxima cadeira livre.</p>
      <label htmlFor="link-convite" className="visualmente-oculto">
        Link de convite
      </label>
      <div className="convite-linha">
        <input ref={campo} id="link-convite" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={() => void copiar(link, campo.current).then((ok) => setSituacao(ok ? 'copiado' : 'falhou'))}>
          {situacao === 'copiado' ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <a className="convite-whats" href={`https://wa.me/?text=${encodeURIComponent(recado)}`} target="_blank" rel="noreferrer">
        Mandar no WhatsApp
      </a>
      {situacao === 'falhou' && (
        <p className="nota" role="status">
          Selecione e copie o link
        </p>
      )}
    </section>
  );
}
