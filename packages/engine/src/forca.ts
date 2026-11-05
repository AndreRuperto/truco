import { type Carta, idCarta, type Naipe, type Valor, VALORES } from './cartas';
import type { Variante } from './regras';

const ORDEM_NAIPE_MANILHA: Record<Naipe, number> = { ouros: 0, espadas: 1, copas: 2, paus: 3 };
const MANILHAS_MINEIRO: Record<string, number> = { '4p': 14, '7c': 13, Ae: 12, '7o': 11 };

export function valorManilhaPaulista(vira: Carta): Valor {
  const i = VALORES.indexOf(vira.valor);
  return VALORES[(i + 1) % VALORES.length];
}

export function forca(c: Carta, variante: Variante, vira: Carta | null): number {
  if (variante === 'mineiro') {
    const m = MANILHAS_MINEIRO[idCarta(c)];
    if (m) return m;
  } else {
    if (!vira) throw new Error('truco paulista exige vira');
    if (c.valor === valorManilhaPaulista(vira)) return 11 + ORDEM_NAIPE_MANILHA[c.naipe];
  }
  return VALORES.indexOf(c.valor) + 1;
}
