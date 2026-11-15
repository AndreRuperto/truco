import type { Moeda } from './regras';

/*
 * Catálogo da loja. Os ids são estáveis (vão para o banco): nunca renomear, só acrescentar.
 * `visual` leva os parâmetros que os componentes da web já usam (cores do verso, paleta do
 * Personagem, moldura do Avatar, superfície do Tampo).
 */

export const SLOTS = ['verso', 'roupa', 'moldura', 'avatar', 'tampo', 'habilidade'] as const;
export type Slot = (typeof SLOTS)[number];

export type EstampaVerso = 'losango' | 'listra' | 'azulejo' | 'chita' | 'cartola';
export type EstiloMoldura = 'nenhuma' | 'corda' | 'madeira' | 'neon' | 'giz';
export type SuperficieTampo = 'madeira' | 'feltro' | 'plastico' | 'marmore' | 'formica';

export interface VisualVerso {
  cor: string;
  linha: string;
  estampa: EstampaVerso;
}
/** Só o que muda sobre a paleta da cadeira (vazio = a roupa padrão do personagem). */
export interface VisualRoupa {
  camisa?: string;
  camisaSombra?: string;
  chapeu?: 'palha' | 'bone' | 'feltro';
  chapeuCor?: string;
  estampa?: 'xadrez' | 'regata' | 'listra';
}
export interface VisualMoldura {
  estilo: EstiloMoldura;
}
export interface VisualAvatar {
  desenho: 'violeiro' | 'garrafa' | 'caramelo' | 'mao' | 'dono' | 'vo';
}
export interface VisualTampo {
  superficie: SuperficieTampo;
}

/** Habilidade: não muda o visual de ninguém, só o que a pessoa pode fazer (os floreios ao embaralhar). */
export interface VisualHabilidade {
  floreios: boolean;
}

export type VisualItem = VisualVerso | VisualRoupa | VisualMoldura | VisualAvatar | VisualTampo | VisualHabilidade;

export interface ItemLoja {
  id: string;
  slot: Slot;
  nome: string;
  /** null = de série (todo mundo tem). */
  preco: { moeda: Moeda; valor: number } | null;
  visual: VisualItem;
}

const pila = (valor: number) => ({ moeda: 'pila' as const, valor });
const fichas = (valor: number) => ({ moeda: 'fichas' as const, valor });

export const ITENS: readonly ItemLoja[] = [
  // Verso do baralho (todos veem o de quem dá as cartas)
  { id: 'verso-classico', slot: 'verso', nome: 'Clássico', preco: null, visual: { cor: '#7a1a22', linha: '#c9767b', estampa: 'losango' } },
  { id: 'verso-boteco', slot: 'verso', nome: 'Vermelho Boteco', preco: pila(120), visual: { cor: '#b8202a', linha: '#fbf3dc', estampa: 'listra' } },
  { id: 'verso-azulejo', slot: 'verso', nome: 'Azulejo', preco: pila(200), visual: { cor: '#f4efe2', linha: '#2f68b8', estampa: 'azulejo' } },
  { id: 'verso-chita', slot: 'verso', nome: 'Chita', preco: pila(300), visual: { cor: '#d9763a', linha: '#2d6a45', estampa: 'chita' } },
  { id: 'verso-cartola', slot: 'verso', nome: 'Cartola de Ouro', preco: fichas(6000), visual: { cor: '#1c1410', linha: '#e9b02c', estampa: 'cartola' } },
  // Roupa do personagem
  { id: 'roupa-padrao', slot: 'roupa', nome: 'Roupa de sempre', preco: null, visual: {} },
  { id: 'roupa-time', slot: 'roupa', nome: 'Camisa do Time', preco: pila(150), visual: { camisa: '#2d6a45', camisaSombra: '#1f4b31', estampa: 'listra', chapeu: 'bone', chapeuCor: '#e9b02c' } },
  { id: 'roupa-festa', slot: 'roupa', nome: 'Caipira de Festa', preco: pila(250), visual: { camisa: '#b8202a', camisaSombra: '#861820', estampa: 'xadrez', chapeu: 'palha', chapeuCor: '#e8c35e' } },
  { id: 'roupa-terno', slot: 'roupa', nome: 'Terno de Domingo', preco: pila(400), visual: { camisa: '#24304a', camisaSombra: '#161d2e', chapeu: 'feltro', chapeuCor: '#2b2f36' } },
  { id: 'roupa-campeao', slot: 'roupa', nome: 'Chapéu do Campeão', preco: fichas(10000), visual: { chapeu: 'feltro', chapeuCor: '#e9b02c' } },
  // Moldura do avatar
  { id: 'moldura-nenhuma', slot: 'moldura', nome: 'Sem moldura', preco: null, visual: { estilo: 'nenhuma' } },
  { id: 'moldura-corda', slot: 'moldura', nome: 'Corda', preco: pila(80), visual: { estilo: 'corda' } },
  { id: 'moldura-madeira', slot: 'moldura', nome: 'Madeira Entalhada', preco: pila(150), visual: { estilo: 'madeira' } },
  { id: 'moldura-neon', slot: 'moldura', nome: 'Neon de Bar', preco: pila(250), visual: { estilo: 'neon' } },
  { id: 'moldura-giz', slot: 'moldura', nome: 'Giz de Lousa', preco: fichas(3000), visual: { estilo: 'giz' } },
  // Avatares exclusivos (os prontos continuam grátis, em `AVATARES_PRONTOS`)
  { id: 'avatar-violeiro', slot: 'avatar', nome: 'Violeiro', preco: pila(120), visual: { desenho: 'violeiro' } },
  { id: 'avatar-garrafa', slot: 'avatar', nome: 'Garrafa na Mesa', preco: pila(120), visual: { desenho: 'garrafa' } },
  { id: 'avatar-caramelo', slot: 'avatar', nome: 'Caramelo', preco: pila(120), visual: { desenho: 'caramelo' } },
  { id: 'avatar-mao', slot: 'avatar', nome: 'Mão de Truco', preco: pila(120), visual: { desenho: 'mao' } },
  { id: 'avatar-dono', slot: 'avatar', nome: 'Seu Dono', preco: pila(120), visual: { desenho: 'dono' } },
  { id: 'avatar-vo', slot: 'avatar', nome: 'Vó do Truco', preco: pila(120), visual: { desenho: 'vo' } },
  // Tampo da mesa (só quem escolheu vê)
  { id: 'tampo-madeira', slot: 'tampo', nome: 'Madeira', preco: null, visual: { superficie: 'madeira' } },
  { id: 'tampo-feltro', slot: 'tampo', nome: 'Feltro', preco: null, visual: { superficie: 'feltro' } },
  { id: 'tampo-plastico', slot: 'tampo', nome: 'Plástico', preco: null, visual: { superficie: 'plastico' } },
  { id: 'tampo-marmore', slot: 'tampo', nome: 'Mármore de Bar', preco: pila(200), visual: { superficie: 'marmore' } },
  { id: 'tampo-formica', slot: 'tampo', nome: 'Fórmica Anos 70', preco: pila(150), visual: { superficie: 'formica' } },
  // Habilidade (pedido do André): os truques de embaralhar (cascata, corte triplo, leque, mola)
  // embaralham de verdade na sua vez. Comprada com Fichas, o dinheiro do jogo; admin tem sem comprar.
  { id: 'habilidade-simples', slot: 'habilidade', nome: 'Embaralhar simples', preco: null, visual: { floreios: false } },
  { id: 'habilidade-floreios', slot: 'habilidade', nome: 'Floreios', preco: fichas(5000), visual: { floreios: true } },
];

export interface PacotePila {
  id: string;
  nome: string;
  /** Preço em centavos (a API da InfinitePay usa centavos; mínimo 100). */
  centavos: number;
  pila: number;
}

export const PACOTES: readonly PacotePila[] = [
  { id: 'punhado', nome: 'Punhado', centavos: 490, pila: 100 },
  { id: 'bolso', nome: 'Bolso', centavos: 990, pila: 220 },
  { id: 'carteira', nome: 'Carteira', centavos: 2490, pila: 600 },
  { id: 'cofre', nome: 'Cofre', centavos: 4990, pila: 1300 },
];

const porId = new Map(ITENS.map((i) => [i.id, i]));

export const itemPorId = (id: unknown): ItemLoja | null => (typeof id === 'string' ? (porId.get(id) ?? null) : null);
export const pacotePorId = (id: unknown): PacotePila | null => PACOTES.find((p) => p.id === id) ?? null;
export const ehSlot = (x: unknown): x is Slot => (SLOTS as readonly unknown[]).includes(x);

/** Primeiro item de série do slot (o padrão de quem não equipou nada). */
export function gratisDoSlot(slot: Slot): ItemLoja | null {
  return ITENS.find((i) => i.slot === slot && i.preco === null) ?? null;
}
