import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAvisoNaAba } from '../src/logica/avisoAba';

let escondida = false;
beforeEach(() => {
  vi.useFakeTimers();
  escondida = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => escondida });
  document.title = 'Truco';
});
afterEach(() => vi.useRealTimers());

const mudarVisibilidade = (esconder: boolean) => {
  escondida = esconder;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

describe('aviso na aba', () => {
  test('com a aba visível não mexe no título; escondida, pisca até voltar', () => {
    const vibrar = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrar });
    const { rerender } = renderHook(({ ativo }) => useAvisoNaAba(ativo, 'Sua vez! · Truco'), { initialProps: { ativo: false } });
    rerender({ ativo: true });
    expect(vibrar).toHaveBeenCalledWith(140);
    expect(document.title).toBe('Truco');
    mudarVisibilidade(true);
    expect(document.title).toBe('Sua vez! · Truco');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(document.title).toBe('Truco');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(document.title).toBe('Sua vez! · Truco');
    mudarVisibilidade(false);
    expect(document.title).toBe('Truco');
  });

  test('deixou de ser a vez: o título volta na hora', () => {
    escondida = true;
    const { rerender } = renderHook(({ ativo }) => useAvisoNaAba(ativo, 'Sua vez!', false), { initialProps: { ativo: true } });
    expect(document.title).toBe('Sua vez!');
    rerender({ ativo: false });
    expect(document.title).toBe('Truco');
  });
});
