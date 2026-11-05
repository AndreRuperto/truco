import { distribuirSemRitual } from '../src/atalhos';
import { baralhoDaMesa, type Carta, idCarta, type Naipe, novoBaralho, type Valor } from '../src/cartas';
import { type Cadeira, type EstadoPartida, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import { completarSorte } from '../src/ritual';
import { embaralhar } from '../src/rng';

const N: Record<string, Naipe> = { o: 'ouros', e: 'espadas', c: 'copas', p: 'paus' };
export const c = (s: string): Carta => ({ valor: s.slice(0, -1) as Valor, naipe: N[s.slice(-1)] });

export const PAULISTA: RegrasMesa = {
  variante: 'paulista',
  pontuacao: '1-3-6-9-12',
  maoDe10: false,
  maoDe11: 'qualquerDupla',
  familia: 'off',
  maoLimpa: false,
};
export const MINEIRO: RegrasMesa = {
  variante: 'mineiro',
  pontuacao: '2-4-8-10-12',
  maoDe10: true,
  maoDe11: 'off',
  familia: 'fechada',
  maoLimpa: false,
};
export const MINEIRO_LIMPA: RegrasMesa = { ...MINEIRO, maoLimpa: true };

/** Baralho que entrega `maos[cadeira]` com pe = 3 (cadeira 0 começa). `base` = baralho completo da mesa. */
export function baralhoCom(maos: string[][], vira?: string, base: Carta[] = novoBaralho()): Carta[] {
  const fixas: (Carta | undefined)[] = new Array(base.length).fill(undefined);
  maos.forEach((mao, cad) => mao.forEach((s, i) => (fixas[i * 4 + cad] = c(s))));
  if (vira) fixas[12] = c(vira);
  const usadas = new Set(fixas.filter((x): x is Carta => !!x).map(idCarta));
  const resto = base.filter((x) => !usadas.has(idCarta(x)));
  return fixas.map((x) => x ?? resto.shift()!);
}

export function partida(regras: RegrasMesa, placar: [number, number] = [0, 0]): EstadoPartida {
  const s = novaPartida(regras, 3);
  s.placar = placar;
  return s;
}

export function distribuida(regras: RegrasMesa, maos: string[][], vira?: string, placar?: [number, number]) {
  return distribuirSemRitual(partida(regras, placar), baralhoCom(maos, vira, baralhoDaMesa(regras)));
}

/** Ritual com um riffle e um corte sorteados por `rand` (partidas simuladas nos testes). */
export function ritualSorteado(s: EstadoPartida, rand: () => number): EstadoPartida {
  const r = s.ritual!;
  let t = reduce(s, completarSorte({ tipo: 'embaralhar', cadeira: r.embaralhador }, s, rand));
  t = reduce(t, { tipo: 'passarCorte', cadeira: r.embaralhador });
  t = reduce(t, completarSorte({ tipo: 'cortar', cadeira: r.cortador }, t, rand));
  t = reduce(t, { tipo: 'devolver', cadeira: r.cortador });
  return reduce(t, { tipo: 'distribuir', cadeira: r.embaralhador, modo: 'porCima' });
}

/** O que acontece sem jogador: monte sorteado no começo e ritual sorteado entre mãos; null se não é o caso. */
export function avancarSemJogadas(s: EstadoPartida, rand: () => number): EstadoPartida | null {
  if (s.fase === 'aguardandoMonte') return reduce(s, { tipo: 'monte', baralho: embaralhar(baralhoDaMesa(s.regras), rand) });
  if (s.fase === 'embaralhando') return ritualSorteado(s, rand);
  return null;
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
