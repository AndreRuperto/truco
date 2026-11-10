import { describe, expect, test } from 'vitest';
import { TEMPOS_RAPIDOS, temposDoAmbiente } from '../src/tempos';

describe('temposDoAmbiente', () => {
  test('TRUCO_TEMPOS=rapido acelera bots e pausas, mas mantém a jogada humana', () => {
    expect(temposDoAmbiente({ TRUCO_TEMPOS: 'rapido' })).toEqual(TEMPOS_RAPIDOS);
    expect(TEMPOS_RAPIDOS.botMs).toBeLessThan(200);
    expect(TEMPOS_RAPIDOS.jogadaMs).toBeUndefined();
    expect(TEMPOS_RAPIDOS.ritualMs).toBeLessThanOrEqual(3_000);
    expect(TEMPOS_RAPIDOS.conferirMs).toBeUndefined();
  });

  test('sem a variável (ou outro valor) usa o padrão', () => {
    expect(temposDoAmbiente({})).toEqual({});
    expect(temposDoAmbiente({ TRUCO_TEMPOS: 'lento' })).toEqual({});
  });
});

// Auditoria de segurança 2026-11-10: por erro de configuração, o modo rápido do E2E encurtaria os
// prazos de quem joga de verdade (ritual de 3 s). Em produção ele é ignorado.
describe('temposDoAmbiente em produção', () => {
  test('TRUCO_TEMPOS=rapido é ignorado com NODE_ENV=production', () => {
    expect(temposDoAmbiente({ TRUCO_TEMPOS: 'rapido', NODE_ENV: 'production' })).toEqual({});
  });
});
