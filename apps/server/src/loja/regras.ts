import { PATENTES, type Patente, patenteDe } from '../ranking/elo';

/*
 * Regras da economia do jogo (design: docs/plans/2026-11-11-loja-duas-moedas-design.md).
 * Fichas: ganhas jogando, apostáveis. Pila: comprado em reais, só para itens.
 * NÃO existe conversão entre as duas moedas.
 */

export const MOEDAS = ['fichas', 'pila'] as const;
export type Moeda = (typeof MOEDAS)[number];

export const MOTIVOS = [
  'cadastro',
  'diario',
  'resgate',
  'cacife',
  'premio',
  'estorno_partida',
  'compra_item',
  'compra_pila',
  'estorno_pila',
  'ajuste_admin',
] as const;
export type Motivo = (typeof MOTIVOS)[number];

export const FICHAS_CADASTRO = 1000;
export const FICHAS_DIARIO = 100;
/** Abaixo disto, o bônus do dia vira resgate (o saldo vai para `RESGATE_ATE`). */
export const PISO_RESGATE = 100;
export const RESGATE_ATE = 500;

/** Cacifes que o dono de uma mesa casual/privada pode escolher (0 = sem cacife). */
export const CACIFES_MESA = [0, 50, 100, 250, 500, 1000] as const;

export const CACIFE_PATENTE: Record<Patente, number> = {
  Bronze: 50,
  Prata: 100,
  Ouro: 200,
  Diamante: 400,
  Mestre: 800,
  'Grão-Mestre': 1500,
};


const FORMATO_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Dia (AAAA-MM-DD) no fuso de São Paulo: o bônus diário vira à meia-noite de Brasília. */
export function diaSP(d: Date): string {
  return FORMATO_DIA.format(d);
}

export function bonusDoDia(saldo: number, ultimoDia: string | null, hoje: string): { delta: number; motivo: 'diario' | 'resgate' } | null {
  if (ultimoDia === hoje) return null;
  if (saldo < PISO_RESGATE) return { delta: RESGATE_ATE - saldo, motivo: 'resgate' };
  return { delta: FICHAS_DIARIO, motivo: 'diario' };
}

/** Todo mundo arrisca o mesmo: o menor entre o cacife pedido e o menor saldo dos pagantes. */
export function cacifeEfetivo(pedido: number, saldos: readonly number[]): number {
  if (saldos.length === 0 || pedido <= 0) return 0;
  return Math.max(0, Math.min(pedido, ...saldos));
}

/** Cacife da ranqueada pela patente do jogador com mais pontos. */
export function cacifeDaRanqueada(pontos: readonly number[]): number {
  const maior = pontos.length ? Math.max(...pontos) : 0;
  return CACIFE_PATENTE[patenteDe(maior)];
}

export function cacifeValido(x: unknown): number {
  return typeof x === 'number' && (CACIFES_MESA as readonly number[]).includes(x) ? x : 0;
}

/** Cacife que a fila pode mandar para uma ranqueada (um dos valores das patentes). */
export function cacifeRanqueadaValido(x: unknown): number {
  return typeof x === 'number' && PATENTES.some((p) => CACIFE_PATENTE[p.nome] === x) ? x : 0;
}

/** Pote dividido entre as cadeiras vencedoras; o resto da divisão fica com a cadeira mais baixa. */
export function dividirPote(pote: number, cadeiras: readonly number[]): Map<number, number> {
  const out = new Map<number, number>();
  if (cadeiras.length === 0 || pote <= 0) return out;
  const ordem = [...cadeiras].sort((a, b) => a - b);
  const parte = Math.floor(pote / ordem.length);
  const resto = pote - parte * ordem.length;
  ordem.forEach((c, i) => out.set(c, parte + (i === 0 ? resto : 0)));
  return out;
}
