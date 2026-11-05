import type { RegrasMesa } from './regras';

export const NAIPES = ['ouros', 'espadas', 'copas', 'paus'] as const;
export type Naipe = (typeof NAIPES)[number];

/** Ordem de força das cartas comuns, da mais fraca para a mais forte. */
export const VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
export type ValorComum = (typeof VALORES)[number];
/** 'C' = coringa (só na mão limpa do mineiro). O naipe do coringa só dá cor e identidade. */
export type Valor = ValorComum | 'C';

export interface Carta {
  valor: Valor;
  naipe: Naipe;
}

export function novoBaralho(): Carta[] {
  const b: Carta[] = [];
  for (const valor of VALORES) for (const naipe of NAIPES) b.push({ valor, naipe });
  return b;
}

/** Os dois coringas da mão limpa: um vermelho (copas) e um preto (paus). */
export const CORINGAS: readonly Readonly<Carta>[] = Object.freeze([
  Object.freeze({ valor: 'C', naipe: 'copas' } as const),
  Object.freeze({ valor: 'C', naipe: 'paus' } as const),
]);

/** Manilhas do mineiro que são 4 ou 7 e por isso continuam na mão limpa (A♠ já entra como Ás). */
const MANILHAS_BAIXAS_MINEIRO: readonly Readonly<Carta>[] = [
  { valor: '4', naipe: 'paus' },
  { valor: '7', naipe: 'copas' },
  { valor: '7', naipe: 'ouros' },
];

export const ehCoringa = (c: Carta): boolean => c.valor === 'C';

/**
 * Baralho completo da mesa. Mão limpa (só no mineiro): Q, J, K, A, 2, 3 dos quatro
 * naipes, as manilhas 4♣, 7♥ e 7♦ e os dois coringas — 29 cartas. Senão, as 40 de `novoBaralho`.
 */
export function baralhoDaMesa(regras: Pick<RegrasMesa, 'variante' | 'maoLimpa'>): Carta[] {
  if (regras.variante !== 'mineiro' || regras.maoLimpa !== true) return novoBaralho();
  const altas = novoBaralho().filter((c) => !['4', '5', '6', '7'].includes(c.valor));
  return [...altas, ...MANILHAS_BAIXAS_MINEIRO, ...CORINGAS].map((c) => ({ ...c }));
}

export function idCarta(c: Carta): string {
  return `${c.valor}${c.naipe[0]}`;
}
