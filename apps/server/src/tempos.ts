import type { Tempos } from './mesa/Mesa';

/** Para o E2E: bots, pausas e etapas do ritual curtos; o prazo de jogar carta continua o padrão (20 s). */
export const TEMPOS_RAPIDOS: Readonly<Partial<Tempos>> = Object.freeze({ botMs: 60, pausaMaoMs: 400, ritualMs: 3_000, distribuicaoMs: 300, janelaFamiliaMs: 500 });

export function temposDoAmbiente(env: Record<string, string | undefined>): Partial<Tempos> {
  // Em produção é sempre o padrão: o modo do E2E encurtaria os prazos de quem joga de verdade.
  if (env.NODE_ENV === 'production') return {};
  return env.TRUCO_TEMPOS === 'rapido' ? { ...TEMPOS_RAPIDOS } : {};
}

/**
 * Limite de criação de mesa por IP (SEC-09): 20 a cada 10 min. O E2E cria muitas mesas do mesmo
 * IP (127.0.0.1) e sobe o máximo com `TRUCO_LIMITE_MESAS`; em produção a variável é ignorada.
 */
export function limiteMesasDoAmbiente(env: Record<string, string | undefined>): number {
  const PADRAO = 20;
  if (env.NODE_ENV === 'production') return PADRAO;
  const n = Number(env.TRUCO_LIMITE_MESAS);
  return Number.isInteger(n) && n > 0 ? n : PADRAO;
}
