import { describe, expect, test } from 'vitest';
import { limiteMesasDoAmbiente, reconexaoDoAmbiente, TEMPOS_RAPIDOS, temposDoAmbiente } from '../src/tempos';

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

describe('limiteMesasDoAmbiente (F4.5)', () => {
  test('padrão 20; o E2E sobe com TRUCO_LIMITE_MESAS; produção ignora; valor inválido vira o padrão', () => {
    expect(limiteMesasDoAmbiente({})).toBe(20);
    expect(limiteMesasDoAmbiente({ TRUCO_LIMITE_MESAS: '10000' })).toBe(10_000);
    expect(limiteMesasDoAmbiente({ TRUCO_LIMITE_MESAS: '10000', NODE_ENV: 'production' })).toBe(20);
    expect(limiteMesasDoAmbiente({ TRUCO_LIMITE_MESAS: 'abc' })).toBe(20);
    expect(limiteMesasDoAmbiente({ TRUCO_LIMITE_MESAS: '-3' })).toBe(20);
  });
});

describe('reconexaoDoAmbiente (F5.2)', () => {
  test('padrão 300 s; o E2E encurta com TRUCO_RECONEXAO_S; produção ignora; inválido vira o padrão', () => {
    expect(reconexaoDoAmbiente({})).toBe(300);
    expect(reconexaoDoAmbiente({ TRUCO_RECONEXAO_S: '30' })).toBe(30);
    expect(reconexaoDoAmbiente({ TRUCO_RECONEXAO_S: '30', NODE_ENV: 'production' })).toBe(300);
    expect(reconexaoDoAmbiente({ TRUCO_RECONEXAO_S: '0' })).toBe(300);
    expect(reconexaoDoAmbiente({ TRUCO_RECONEXAO_S: 'x' })).toBe(300);
  });
});

