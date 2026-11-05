import { type Carta, idCarta, type Naipe, novoBaralho, type Valor } from '../src/cartas';
import { type Cadeira, type EstadoPartida, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';

const N: Record<string, Naipe> = { o: 'ouros', e: 'espadas', c: 'copas', p: 'paus' };
export const c = (s: string): Carta => ({ valor: s.slice(0, -1) as Valor, naipe: N[s.slice(-1)] });

export const PAULISTA: RegrasMesa = {
  variante: 'paulista',
  pontuacao: '1-3-6-9-12',
  maoDe10: false,
  maoDe11: 'qualquerDupla',
  familia: 'off',
};
export const MINEIRO: RegrasMesa = {
  variante: 'mineiro',
  pontuacao: '2-4-8-10-12',
  maoDe10: true,
  maoDe11: 'off',
  familia: 'fechada',
};

/** Baralho que entrega `maos[cadeira]` com pe = 3 (cadeira 0 começa). */
export function baralhoCom(maos: string[][], vira?: string): Carta[] {
  const fixas: (Carta | undefined)[] = new Array(40).fill(undefined);
  maos.forEach((mao, cad) => mao.forEach((s, i) => (fixas[i * 4 + cad] = c(s))));
  if (vira) fixas[12] = c(vira);
  const usadas = new Set(fixas.filter((x): x is Carta => !!x).map(idCarta));
  const resto = novoBaralho().filter((x) => !usadas.has(idCarta(x)));
  return fixas.map((x) => x ?? resto.shift()!);
}

export function partida(regras: RegrasMesa, placar: [number, number] = [0, 0]): EstadoPartida {
  const s = novaPartida(regras, 3);
  s.placar = placar;
  return s;
}

export function distribuida(regras: RegrasMesa, maos: string[][], vira?: string, placar?: [number, number]) {
  return reduce(partida(regras, placar), { tipo: 'distribuir', baralho: baralhoCom(maos, vira) });
}

export function jogarSeq(s: EstadoPartida, seq: [Cadeira, number][]): EstadoPartida {
  return seq.reduce((acc, [cadeira, indice]) => reduce(acc, { tipo: 'jogar', cadeira, indice }), s);
}

/**
 * No mineiro a dupla 0 vence as duas primeiras rodadas jogando sempre o índice 0
 * (R1: zap 4p; R2: Jo da cadeira 2). No paulista use vira '5p' (manilha 6).
 */
export const MAOS_DUPLA0_VENCE = [
  ['4p', '5o', '6o'],
  ['3e', '5e', '6e'],
  ['Qo', 'Jo', 'Ko'],
  ['2e', '5c', '6c'],
];
