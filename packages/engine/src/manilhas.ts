import type { Carta, Naipe } from './cartas';
import { forca, valorManilhaPaulista } from './forca';
import type { Variante } from './regras';

const MANILHAS_MINEIRO: Record<Naipe, Carta> = {
  paus: { valor: '4', naipe: 'paus' },
  copas: { valor: '7', naipe: 'copas' },
  espadas: { valor: 'A', naipe: 'espadas' },
  ouros: { valor: '7', naipe: 'ouros' },
};

/** `forca` de manilha começa em 11 (ver forca.ts). */
const PISO_MANILHA = 11;

/** A manilha de um naipe (zap = paus, copas, espadilha = espadas, pica-fumo = ouros). Paulista sem vira: null. */
export function manilhaDoNaipe(naipe: Naipe, variante: Variante, vira: Carta | null): Carta | null {
  if (variante === 'mineiro') return { ...MANILHAS_MINEIRO[naipe] };
  return vira ? { valor: valorManilhaPaulista(vira), naipe } : null;
}

export function ehManilha(c: Carta, variante: Variante, vira: Carta | null): boolean {
  if (variante === 'paulista' && !vira) return false;
  return forca(c, variante, vira) >= PISO_MANILHA;
}

/** A manilha mais forte da mão, ou null se não houver. */
export function melhorManilha(mao: readonly Carta[], variante: Variante, vira: Carta | null): Carta | null {
  let melhor: Carta | null = null;
  let forcaMelhor = 0;
  for (const c of mao) {
    if (!ehManilha(c, variante, vira)) continue;
    const f = forca(c, variante, vira);
    if (f > forcaMelhor) {
      melhor = c;
      forcaMelhor = f;
    }
  }
  return melhor;
}
