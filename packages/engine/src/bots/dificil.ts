import { acoesValidas } from '../acoes';
import { baralhoDaMesa, type Carta, idCarta } from '../cartas';
import {
  type AcaoJogador,
  type Cadeira,
  type Dupla,
  duplaDe,
  type EstadoPartida,
  type Jogada,
  parceiroDe,
} from '../estado';
import { reduce } from '../reducer';
import { embaralhar } from '../rng';
import type { JogadaVisivel, Visao } from '../visao';
import { botFacil } from './facil';
import { decidirEtapa, querFamilia } from './ritual';

/** O que o bot sabe por sinal do parceiro. */
export interface DicaAmostra {
  /** Carta que o parceiro sinalizou ter (ex.: o zap). */
  parceiroTem?: Carta;
}

/**
 * Monta um estado completo coerente com tudo que `v.cadeira` enxerga:
 * cartas desconhecidas (mãos alheias, cartas cobertas alheias e, na mão de
 * ferro, a própria mão) são sorteadas do que sobrou do baralho.
 */
export function amostrarMundo(v: Visao, rand: () => number, dica: DicaAmostra = {}): EstadoPartida {
  const m = v.mao;
  if (!m) throw new Error('não há mão em andamento');

  const conhecidas = new Set<string>();
  const marcar = (c: Carta | null) => {
    if (c) conhecidas.add(idCarta(c));
  };
  m.minhaMao.forEach(marcar);
  m.maoParceiro?.forEach(marcar);
  marcar(m.vira);
  m.mesa.forEach((j) => marcar(j.carta));
  m.rodadasJogadas.flat().forEach((j) => marcar(j.carta));
  m.abertasNoCorte.forEach(marcar);
  m.familias.forEach((f) => f.cartas?.forEach(marcar));

  const monte = embaralhar(
    baralhoDaMesa(v.regras).filter((c) => !conhecidas.has(idCarta(c))),
    rand,
  );
  const tirar = (): Carta => {
    const c = monte.pop();
    if (!c) throw new Error('monte esgotado ao amostrar');
    return c;
  };

  const parceiro = parceiroDe(v.cadeira);
  // O monte só tem cartas desconhecidas: se a carta sinalizada não está nele, a dica é impossível e é ignorada.
  // Também é ignorada se o parceiro já jogou coberta: a carta sinalizada pode ter sido essa.
  let reservada: Carta | null = null;
  const alvo = dica.parceiroTem;
  const parceiroCobriu = [...m.mesa, ...m.rodadasJogadas.flat()].some((j) => j.cadeira === parceiro && j.coberta);
  if (alvo && !m.maoParceiro && !parceiroCobriu && m.qtdCartas[parceiro] > 0) {
    const i = monte.findIndex((x) => idCarta(x) === idCarta(alvo));
    if (i >= 0) reservada = monte.splice(i, 1)[0];
  }

  const maos: Carta[][] = ([0, 1, 2, 3] as Cadeira[]).map((c) => {
    if (c === v.cadeira) return m.minhaMao.map((x) => x ?? tirar());
    if (c === parceiro && m.maoParceiro) return m.maoParceiro.map((x) => ({ ...x }));
    if (c === parceiro && reservada) return [reservada, ...Array.from({ length: m.qtdCartas[c] - 1 }, tirar)];
    return Array.from({ length: m.qtdCartas[c] }, tirar);
  });
  const revelar = (j: JogadaVisivel): Jogada => ({ ...j, carta: j.carta ?? tirar() });
  const { minhaMao: _a, maoParceiro: _b, qtdCartas: _c, mesa, rodadasJogadas, familias, ...resto } = m;
  const mesaReal = mesa.map(revelar);
  const rodadasReais = rodadasJogadas.map((r) => r.map(revelar));
  const familiasReais = familias.map((f) => ({ ...f, cartas: f.cartas ? f.cartas.map((x) => ({ ...x })) : [tirar(), tirar(), tirar()] }));
  // O que sobrou é o monte (a ordem não importa para a simulação).
  if (monte.length !== v.qtdMonte) throw new Error('amostrarMundo: o monte não bate com a visão');
  return {
    regras: { ...v.regras },
    placar: [v.placar[0], v.placar[1]],
    pe: v.pe,
    fase: v.fase,
    monte,
    ritual: null,
    ultimaMao: null,
    vencedor: v.vencedor,
    mao: {
      ...structuredClone(resto),
      maos,
      mesa: mesaReal,
      rodadasJogadas: rodadasReais,
      familias: familiasReais,
    },
  };
}

export interface OpcoesBotDificil {
  /** Mundos amostrados por decisão. Mais = mais forte e mais lento. */
  amostras?: number;
  /** Chance de trucar "no escuro" quando pode. */
  chanceBlefe?: number;
  /**
   * Teto de tempo (ms) para a amostragem: depois dele para de amostrar, mas
   * sempre faz pelo menos `minAmostras`. Sem orçamento o bot é determinístico.
   */
  orcamentoMs?: number;
  /** Mínimo de amostras mesmo com o orçamento estourado (padrão 4, limitado a `amostras`). */
  minAmostras?: number;
  /** Dica vinda do sinal do parceiro; usada em toda amostragem. */
  dica?: DicaAmostra;
}

/** Joga o resto da mão com o bot fácil em todas as cadeiras; devolve o saldo de pontos da `dupla`. */
function simularResto(inicio: EstadoPartida, dupla: Dupla): number {
  let s = inicio;
  for (let guarda = 0; s.mao && guarda < 200; guarda++) {
    const atual = s;
    const a = ([0, 1, 2, 3] as Cadeira[]).map((c) => botFacil(atual, c)).find((x) => x !== null);
    if (!a) break;
    s = reduce(s, a);
  }
  const outra = (1 - dupla) as Dupla;
  return s.placar[dupla] - inicio.placar[dupla] - (s.placar[outra] - inicio.placar[outra]);
}

/**
 * Bot difícil: para cada ação legal, simula o resto da mão em vários mundos
 * possíveis (coerentes com a própria visão) e escolhe a de melhor saldo médio.
 * Recebe só a `Visao` — não tem como "roubar" olhando cartas alheias.
 */
export function botDificil(v: Visao, rand: () => number, opcoes: OpcoesBotDificil = {}): AcaoJogador | null {
  const { amostras = 24, chanceBlefe = 0.08, orcamentoMs, minAmostras = 4, dica } = opcoes;
  if (!v.mao || v.fase === 'conferindoFamilia') return decidirEtapa(v, rand, 'dificil');
  if (querFamilia(v, rand, 'dificil')) return { tipo: 'familia', cadeira: v.cadeira };
  const inicio = orcamentoMs === undefined ? 0 : performance.now();
  const estourou = (k: number) =>
    orcamentoMs !== undefined && k >= minAmostras && performance.now() - inicio >= orcamentoMs;

  const primeiro = amostrarMundo(v, rand, dica);
  // Família é decidida pela política acima, não pela simulação.
  const candidatas = acoesValidas(primeiro, v.cadeira).filter((a) => a.tipo !== 'familia');
  if (candidatas.length <= 1) return candidatas[0] ?? null;

  const truco = candidatas.find((a) => a.tipo === 'truco');
  if (truco && rand() < chanceBlefe) return truco;

  const dupla = duplaDe(v.cadeira);
  const soma = candidatas.map(() => 0);
  for (let k = 0; k < amostras && !estourou(k); k++) {
    const mundo = k === 0 ? primeiro : amostrarMundo(v, rand, dica);
    candidatas.forEach((a, i) => {
      soma[i] += simularResto(reduce(mundo, a), dupla);
    });
  }
  let melhor = 0;
  for (let i = 1; i < soma.length; i++) if (soma[i] > soma[melhor]) melhor = i;
  return candidatas[melhor];
}
