import type { CarteiraApi, ItemLoja, Slot, VisualMoldura, VisualRoupa, VisualVerso } from '@truco/api';
import type { CSSProperties } from 'react';

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUMERO = new Intl.NumberFormat('pt-BR');

export const formatarReais = (centavos: number): string => REAIS.format(centavos / 100);
export const formatarSaldo = (n: number): string => NUMERO.format(n);

export const NOME_MOEDA = { fichas: 'Fichas', pila: 'Pila' } as const;

export function rotuloPreco(item: ItemLoja): string {
  if (!item.preco) return 'De graça';
  return `${formatarSaldo(item.preco.valor)} ${NOME_MOEDA[item.preco.moeda]}`;
}

export type EstadoItem = 'equipado' | 'equipar' | 'comprar' | 'sem-saldo';

/** Id do item em uso no slot (de série quando nada foi equipado). */
export function equipadoNoSlot(slot: Slot, c: Pick<CarteiraApi, 'equipados' | 'avatar'> | null, itens: readonly ItemLoja[]): string | null {
  if (slot === 'avatar') return c?.avatar?.startsWith('loja:') ? c.avatar.slice(5) : null;
  const id = c?.equipados[slot];
  if (id) return id;
  return itens.find((i) => i.slot === slot && i.preco === null)?.id ?? null;
}

export function estadoDoItem(item: ItemLoja, c: CarteiraApi | null, itens: readonly ItemLoja[]): EstadoItem {
  if (equipadoNoSlot(item.slot, c, itens) === item.id) return 'equipado';
  if (!item.preco || c?.inventario.includes(item.id)) return 'equipar';
  const saldo = c ? (item.preco.moeda === 'fichas' ? c.fichas : c.pila) : 0;
  return saldo >= item.preco.valor ? 'comprar' : 'sem-saldo';
}

/** Variáveis do verso das cartas (as mesmas de `.carta.verso` em estilos.css) e a estampa. */
export function estiloVerso(v: VisualVerso | null | undefined): { style: CSSProperties; estampa: string } | null {
  if (!v) return null;
  return { style: { '--verso': v.cor, '--verso-linha': v.linha } as CSSProperties, estampa: v.estampa };
}

export const estiloMoldura = (m: VisualMoldura['estilo'] | null | undefined): string | undefined => (m && m !== 'nenhuma' ? `moldura-${m}` : undefined);

/** Paleta do personagem com a roupa equipada por cima (só os campos que a roupa define). */
export function vestir<T extends object>(tipo: T, roupa: VisualRoupa | null | undefined): T {
  if (!roupa) return tipo;
  const limpo = Object.fromEntries(Object.entries(roupa).filter(([, v]) => v !== undefined));
  return { ...tipo, ...limpo };
}

export const MOTIVO_LANCAMENTO: Record<string, string> = {
  cadastro: 'Bônus de boas-vindas',
  diario: 'Bônus do dia',
  resgate: 'Resgate do dia',
  cacife: 'Cacife da mesa',
  premio: 'Pote ganho',
  estorno_partida: 'Cacife devolvido',
  compra_item: 'Compra na loja',
  compra_pila: 'Compra de Pila',
  estorno_pila: 'Estorno de Pila',
  ajuste_admin: 'Ajuste da casa',
};
