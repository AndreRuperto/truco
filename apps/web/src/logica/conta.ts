import type { ItemHistorico } from '@truco/api';
import type { Variante } from '@truco/engine';
import type { ModoMesa } from '@truco/protocolo';

export const NOME_VARIANTE: Record<Variante, string> = { paulista: 'Paulista', mineiro: 'Mineiro' };

export const NOME_MODO: Record<ModoMesa, string> = { classica: 'Clássica', desafio: 'Desafio', privada: 'Privada', ranqueada: 'Ranqueada' };

export function textoResultado(p: Pick<ItemHistorico, 'venceu' | 'abandonou' | 'terminadaEm'>): string {
  if (p.abandonou) return 'Abandonou';
  if (p.venceu === true) return 'Vitória';
  if (p.venceu === false) return 'Derrota';
  return p.terminadaEm ? '—' : 'Em andamento';
}

export function textoDelta(d: number | null): string {
  if (d === null) return '';
  if (d > 0) return `+${d}`;
  return d < 0 ? `−${-d}` : '0';
}
