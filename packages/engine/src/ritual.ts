import type { Carta } from './cartas';
import type { AcaoJogador, Cadeira, EstadoMao, EstadoPartida } from './estado';

export type ModoDistribuicao = 'porCima' | 'porBaixo' | 'subindo';
export const MODOS_DISTRIBUICAO: readonly ModoDistribuicao[] = Object.freeze(['porCima', 'porBaixo', 'subindo'] as const);

/** Limite técnico de embaralhadas do pé por mão. */
export const LIMITE_EMBARALHADAS = 20;
/** Movimentos do cortador (cada corte ou embaralhada gasta 1; abrir/dar 3 gastam os 3). */
export const MOVIMENTOS_CORTE = 3;
/** Famílias fechadas por mão (o "abrir 3" do corte conta como uma). */
export const LIMITE_FAMILIAS_FECHADAS = 3;

/**
 * Riffle no modelo Gilbert–Shannon–Reeds, com a sorte em `bits` (um por carta, 0 ou 1):
 * o pacote de cima tem tantas cartas quantos zeros há; a posição i do resultado puxa a próxima
 * carta do pacote de cima se `bits[i]` = 0, senão do de baixo. Com bits uniformes isso é exatamente
 * o GSR (corte binomial + intercalação uniforme). Índice 0 = topo.
 */
export function riffle<T>(monte: readonly T[], bits: readonly number[]): T[] {
  if (bits.length !== monte.length) throw new RangeError('riffle: um bit por carta');
  let cima = 0;
  let baixo = bits.reduce((n, b) => n + (b === 0 ? 1 : 0), 0);
  return bits.map((b) => monte[b === 0 ? cima++ : baixo++]);
}

/** Menor e maior ponto de corte (30% a 70% do monte, ao menos 1 carta de cada lado). */
export function limitesCorte(n: number): [number, number] {
  const min = Math.max(1, Math.ceil(n * 0.3));
  const max = Math.max(min, Math.min(n - 1, Math.floor(n * 0.7)));
  return [min, max];
}

/** Corte normal: divide em `ponto` e a parte de baixo vai para cima. */
export function cortarMonte<T>(monte: readonly T[], ponto: number): T[] {
  return [...monte.slice(ponto), ...monte.slice(0, ponto)];
}

/** Quem recebe, na ordem: (pe+1), (pe+2), (pe+3), pe — sem quem ganhou o "dar 3". */
export function ordemDistribuicao(pe: Cadeira, pulada: Cadeira | null): Cadeira[] {
  return [1, 2, 3, 4].map((k) => ((pe + k) % 4) as Cadeira).filter((c) => c !== pulada);
}

export interface CartasDadas<T> {
  maos: T[][];
  vira: T | null;
  resto: T[];
}

/**
 * Distribui 3 cartas para cada cadeira de `ordem`. Por cima: 3 de uma vez do topo. Por baixo: 3 de
 * uma vez do fundo (a do fundo primeiro). Subindo: do fundo, 1 por vez, 3 voltas. A vira (se houver)
 * é a próxima carta na mesma direção.
 */
export function darCartas<T>(monte: readonly T[], ordem: readonly Cadeira[], modo: ModoDistribuicao, comVira: boolean): CartasDadas<T> {
  const resto = [...monte];
  const maos: T[][] = [[], [], [], []];
  const tirar = (): T => {
    const c = modo === 'porCima' ? resto.shift() : resto.pop();
    if (c === undefined) throw new Error('monte acabou na distribuição');
    return c;
  };
  if (modo === 'subindo') {
    for (let volta = 0; volta < 3; volta++) for (const c of ordem) maos[c].push(tirar());
  } else {
    for (const c of ordem) for (let i = 0; i < 3; i++) maos[c].push(tirar());
  }
  return { maos, vira: comVira ? tirar() : null, resto };
}

/**
 * Converte um baralho na ordem "roda a roda" de antes do ritual (1 carta por vez a partir de pe+1;
 * a 13ª era a vira) no monte que, dado por cima, entrega as mesmas mãos e a mesma vira.
 */
export function monteRodaARoda<T>(baralho: readonly T[]): T[] {
  const topo = [0, 1, 2, 3].flatMap((k) => [baralho[k], baralho[k + 4], baralho[k + 8]]);
  return [...topo, ...baralho.slice(12)];
}

/**
 * Ordem do recolhimento no fim da mão: jogadas na ordem em que saíram (a rodada incompleta por
 * último), mãos não jogadas (cadeiras 0→3), abertas do corte, famílias (na ordem dos pedidos), vira.
 * A primeira carta da lista vai para o topo do monte.
 */
export function recolher(m: Pick<EstadoMao, 'rodadasJogadas' | 'mesa' | 'maos' | 'abertasNoCorte' | 'familias' | 'vira'>): Carta[] {
  return [
    ...[...m.rodadasJogadas.flat(), ...m.mesa].map((j) => j.carta),
    ...m.maos.flat(),
    ...m.abertasNoCorte,
    ...m.familias.flatMap((f) => f.cartas),
    ...(m.vira ? [m.vira] : []),
  ];
}

/** Toda carta da partida, onde estiver (monte, ritual, mão). Server/teste: revela tudo. */
export function cartasDaPartida(s: Pick<EstadoPartida, 'monte' | 'ritual' | 'mao'>): Carta[] {
  const r = s.ritual;
  return [...s.monte, ...(r ? [...r.abertas, ...(r.dadas?.cartas ?? [])] : []), ...(s.mao ? recolher(s.mao) : [])];
}

/** Preenche a sorte (bits do riffle, ponto do corte) com `rand`. Só o servidor chama com o rand de verdade. */
export function completarSorte(a: AcaoJogador, s: Pick<EstadoPartida, 'monte'>, rand: () => number): AcaoJogador {
  if (a.tipo === 'embaralhar') return { ...a, bits: s.monte.map(() => (rand() < 0.5 ? 0 : 1)) };
  if (a.tipo === 'cortar') {
    const [min, max] = limitesCorte(s.monte.length);
    return { ...a, ponto: min + Math.floor(rand() * (max - min + 1)) };
  }
  return a;
}

/** Tira a sorte de uma ação (a de um cliente ou de um bot nunca conta). */
export function semSorte(a: AcaoJogador): AcaoJogador {
  if (a.tipo === 'embaralhar') {
    const { bits: _b, ...resto } = a;
    return resto;
  }
  if (a.tipo === 'cortar') {
    const { ponto: _p, ...resto } = a;
    return resto;
  }
  return a;
}
