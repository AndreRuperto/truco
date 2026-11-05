import { type Carta, ehCoringa, idCarta, type Naipe, type ValorComum, VALORES } from './cartas';
import type { Variante } from './regras';

/**
 * Escala de força: coberta 0; comuns 1 (4) … 10 (3); coringa 11; manilhas 12 … 15.
 */
export const FORCA_CORINGA = 11;
/** Menor força de manilha (ver `ehManilha`). */
export const FORCA_MANILHA_MIN = 12;

const ORDEM_NAIPE_MANILHA: Record<Naipe, number> = { ouros: 0, espadas: 1, copas: 2, paus: 3 };
const MANILHAS_MINEIRO: Record<string, number> = { '4p': 15, '7c': 14, Ae: 13, '7o': 12 };

const indiceComum = (v: Carta['valor']): number => (VALORES as readonly string[]).indexOf(v);

export function valorManilhaPaulista(vira: Carta): ValorComum {
  const i = indiceComum(vira.valor);
  if (i < 0) throw new Error('vira inválida');
  return VALORES[(i + 1) % VALORES.length];
}

export function forca(c: Carta, variante: Variante, vira: Carta | null): number {
  if (ehCoringa(c)) return FORCA_CORINGA;
  if (variante === 'mineiro') {
    const m = MANILHAS_MINEIRO[idCarta(c)];
    if (m) return m;
  } else {
    if (!vira) throw new Error('truco paulista exige vira');
    if (c.valor === valorManilhaPaulista(vira)) return FORCA_MANILHA_MIN + ORDEM_NAIPE_MANILHA[c.naipe];
  }
  return indiceComum(c.valor) + 1;
}
