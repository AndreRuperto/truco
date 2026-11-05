import type { Carta } from './cartas';

const FIGURAS = new Set(['Q', 'J', 'K', 'A']);

/** Família: 3 cartas só de Q, J, K, A (inclusive A♠, se o jogador quiser). */
export function ehFamilia(mao: Carta[]): boolean {
  return mao.length === 3 && mao.every((c) => FIGURAS.has(c.valor));
}
