import type { Tempos } from './mesa/Mesa';

/** Para o E2E: bots e pausas curtos; o prazo do humano continua o padrão (20 s). */
export const TEMPOS_RAPIDOS: Readonly<Partial<Tempos>> = Object.freeze({ botMs: 60, pausaMaoMs: 400 });

export function temposDoAmbiente(env: Record<string, string | undefined>): Partial<Tempos> {
  return env.TRUCO_TEMPOS === 'rapido' ? { ...TEMPOS_RAPIDOS } : {};
}
