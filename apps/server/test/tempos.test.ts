import { describe, expect, test } from 'vitest';
import { TEMPOS_RAPIDOS, temposDoAmbiente } from '../src/tempos';

describe('temposDoAmbiente', () => {
  test('TRUCO_TEMPOS=rapido acelera bots e pausas, mas mantém a jogada humana', () => {
    expect(temposDoAmbiente({ TRUCO_TEMPOS: 'rapido' })).toEqual(TEMPOS_RAPIDOS);
    expect(TEMPOS_RAPIDOS.botMs).toBeLessThan(200);
    expect(TEMPOS_RAPIDOS.jogadaMs).toBeUndefined();
  });

  test('sem a variável (ou outro valor) usa o padrão', () => {
    expect(temposDoAmbiente({})).toEqual({});
    expect(temposDoAmbiente({ TRUCO_TEMPOS: 'lento' })).toEqual({});
  });
});
