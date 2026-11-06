import { type Carta, ehCoringa, ehManilha, type Naipe, type Valor, type Variante } from '@truco/engine';

export const SIMBOLO: Record<Naipe, string> = { ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' };

const NOME_VALOR: Record<Valor, string> = {
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  Q: 'Dama',
  J: 'Valete',
  K: 'Rei',
  A: 'Ás',
  '2': '2',
  '3': '3',
  C: 'Coringa',
};

/** "Dama", "Ás", "7"... */
export const nomeValor = (v: Valor): string => NOME_VALOR[v];

/** Nome da manilha pelo naipe — igual nas duas variantes (♣ > ♥ > ♠ > ♦). */
const NOME_MANILHA: Record<Naipe, string> = { paus: 'Zap', copas: 'Copas', espadas: 'Espadilha', ouros: 'Pica-fumo' };

export const ehVermelha = (c: Carta): boolean => c.naipe === 'ouros' || c.naipe === 'copas';

export const textoCarta = (c: Carta): string => (ehCoringa(c) ? NOME_VALOR.C : `${c.valor}${SIMBOLO[c.naipe]}`);

export function nomeManilha(c: Carta, variante: Variante, vira: Carta | null): string | null {
  return ehManilha(c, variante, vira) ? NOME_MANILHA[c.naipe] : null;
}

/** Ex.: "Ás de espadas — Espadilha". Usado como nome acessível dos botões de carta. */
export function rotuloCarta(c: Carta, variante: Variante, vira: Carta | null): string {
  if (ehCoringa(c)) return NOME_VALOR.C;
  const base = `${NOME_VALOR[c.valor]} de ${c.naipe}`;
  const manilha = nomeManilha(c, variante, vira);
  return manilha ? `${base} — ${manilha}` : base;
}
