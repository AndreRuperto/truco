import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** a=0, b=2 (parceiros), c=1, d=3 */
function mesaCheia(chanceInterceptarSinal = 0) {
  const t = criarMesa({ humanosEsperados: 4, chanceInterceptarSinal });
  for (const id of ['a', 'b', 'c', 'd']) t.mesa.sentar(id, id);
  return t;
}

describe('sinais', () => {
  test('só o parceiro vê', () => {
    const t = mesaCheia();
    t.mesa.sinal('a', 'zap');
    expect(t.de('b', 'sinal')).toEqual([{ de: 0, sinal: 'zap' }]);
    expect(t.de('c', 'sinal')).toEqual([]);
    expect(t.de('d', 'sinal')).toEqual([]);
    expect(t.de('a', 'sinal')).toEqual([]);
  });

  test('adversário pode interceptar', () => {
    const t = mesaCheia(1);
    t.mesa.sinal('a', 'copas');
    expect(t.de('c', 'sinal')).toEqual([{ de: 0, sinal: 'copas', interceptado: true }]);
    expect(t.de('d', 'sinal')).toEqual([{ de: 0, sinal: 'copas', interceptado: true }]);
  });

  test('sinal inválido é ignorado', () => {
    const t = mesaCheia();
    t.mesa.sinal('a', 'olhar feio');
    expect(t.de('b', 'sinal')).toEqual([]);
  });

  test('limite de frequência', () => {
    const t = mesaCheia();
    t.mesa.sinal('a', 'zap');
    t.mesa.sinal('a', 'tres');
    expect(t.de('b', 'sinal')).toHaveLength(1);
    vi.advanceTimersByTime(TEMPOS.intervaloMensagemMs);
    t.mesa.sinal('a', 'tres');
    expect(t.de('b', 'sinal')).toHaveLength(2);
  });
});

describe('falas', () => {
  test('todos ouvem', () => {
    const t = mesaCheia();
    t.mesa.fala('c', 'truco');
    for (const id of ['a', 'b', 'c', 'd']) expect(t.de(id, 'fala')).toEqual([{ de: 1, fala: 'truco' }]);
  });

  test('fala inválida é ignorada', () => {
    const t = mesaCheia();
    t.mesa.fala('c', '<script>');
    expect(t.de('a', 'fala')).toEqual([]);
  });
});
