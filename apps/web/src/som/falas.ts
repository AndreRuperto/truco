/**
 * Falas gravadas (ElevenLabs, geradas uma vez por `scripts/gerar-vozes.ts`): cada balão da mesa
 * tem uma fala, na voz do tipo de jogador (o mesmo desenho do 2.5D), com 1 ou 2 jeitos de dizer.
 * Os arquivos ficam em `public/vozes/<tipo>-<fala>-<n>.mp3`.
 */

/** Uma voz por tipo de jogador (mesma ordem de `TIPOS` em `componentes/Personagem.tsx`). */
export const VOZES = [
  { tipo: 'chapéu de palha', nome: 'Sergio', id: 'RGbeQtiShYRDVCrd9b9w' },
  { tipo: 'boné', nome: 'Lax', id: 'tS45q0QcrDHqHoaWdCDR' },
  { tipo: 'careca de bigodão', nome: 'Adriano', id: 'hwnuNyWkl9DjdTFykrN6' },
  { tipo: 'moça de coque', nome: 'Raquel', id: 'GDzHdQOi6jjf8zaXhCYD' },
  { tipo: 'cacheado', nome: 'Lendário', id: '4za2kOXGgUd57HRSQ1fn' },
  { tipo: 'chapéu de feltro', nome: 'Rogério', id: 'z7lpKSQt5qSE9gT4lYbl' },
] as const;

/**
 * Vozes pessoais: quem tem a própria voz clonada fala com ela. O servidor só marca a cadeira
 * (`InfoCadeira.voz`) quando a CONTA logada é a dona (ver `apps/server/src/mesa/vozes.ts`).
 */
export const VOZES_PESSOAIS = {
  andre: { nome: 'André Ruperto', id: 'ChFE4wGBF3kV520SLSvN' },
} as const;
export type VozPessoal = keyof typeof VOZES_PESSOAIS;
export const ehVozPessoal = (x: unknown): x is VozPessoal => typeof x === 'string' && Object.hasOwn(VOZES_PESSOAIS, x);

export interface Fala {
  /** Textos de balão que disparam esta fala (os de `logica/eventos.ts`). */
  baloes: string[];
  /** O que a voz diz (um arquivo por item). */
  ditos: string[];
}

export const FALAS = {
  truco: { baloes: ['TRUCO!'], ditos: ['TRUCO!', 'Truco, marreco!'] },
  seis: { baloes: ['SEIS!'], ditos: ['SEIS!', 'Seis, então!'] },
  nove: { baloes: ['NOVE!'], ditos: ['NOVE!', 'Nove, sem medo!'] },
  doze: { baloes: ['DOZE!'], ditos: ['DOZE!', 'Doze, vamo ver!'] },
  aceito: { baloes: ['Aceito!', 'Desce!'], ditos: ['Desce!', 'Cai dentro!'] },
  corro: { baloes: ['Corro!'], ditos: ['Corro!', 'Tô fora dessa.'] },
  familia: { baloes: ['Família!', 'Família aberta!'], ditos: ['Família!'] },
  'familia-fechada': { baloes: ['Família fechada!'], ditos: ['Família fechada!'] },
  confere: { baloes: ['Confere!'], ditos: ['Confere!', 'Mostra aí!'] },
  'pode-ir': { baloes: ['Pode ir.'], ditos: ['Pode ir.'] },
  corta: { baloes: ['Corta aí!'], ditos: ['Corta aí!', 'Corta, parceiro.'] },
  'por-cima': { baloes: ['Por cima!'], ditos: ['Por cima!'] },
  'por-baixo': { baloes: ['Por baixo!'], ditos: ['Por baixo!'] },
  subindo: { baloes: ['Subindo!'], ditos: ['Subindo!'] },
  'abri-3': { baloes: ['Abri 3!'], ditos: ['Abri três!'] },
  'dar-3': { baloes: ['Toma 3, parceiro!'], ditos: ['Toma três, parceiro!'] },
  'pode-dar': { baloes: ['Pode dar.'], ditos: ['Pode dar.'] },
  vamos: { baloes: ['Vamos!'], ditos: ['Vamo jogar!'] },
  boa: { baloes: ['Boa!'], ditos: ['Boa, parceiro!', 'Isso!'] },
  // Escrito como se fala: "Vixe" o modelo lia como em inglês; o "sh" puxa o x brasileiro.
  vixe: { baloes: ['Vixe!'], ditos: ['Vishi!', 'Vishi, Maria!'] },
  bora: { baloes: ['Bora!'], ditos: ['Bora!', 'Bora, bora!'] },
} as const satisfies Record<string, Fala>;

export type IdFala = keyof typeof FALAS;

/** Fala de um texto de balão, ou null (balões sem voz, como "Embaralhando…"). */
export function falaDoBalao(texto: string): IdFala | null {
  for (const [id, f] of Object.entries(FALAS) as [IdFala, Fala][]) if (f.baloes.includes(texto)) return id;
  return null;
}

/** `tipo`: índice em `VOZES` ou a chave de uma voz pessoal. */
export const arquivoDaFala = (tipo: number | VozPessoal, fala: IdFala, n: number) => `/vozes/${tipo}-${fala}-${n}.mp3`;
