export const NAIPES = ['ouros', 'espadas', 'copas', 'paus'] as const;
export type Naipe = (typeof NAIPES)[number];

/** Ordem de força das cartas comuns, da mais fraca para a mais forte. */
export const VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
export type Valor = (typeof VALORES)[number];

export interface Carta {
  valor: Valor;
  naipe: Naipe;
}

export function novoBaralho(): Carta[] {
  const b: Carta[] = [];
  for (const valor of VALORES) for (const naipe of NAIPES) b.push({ valor, naipe });
  return b;
}

export function idCarta(c: Carta): string {
  return `${c.valor}${c.naipe[0]}`;
}
