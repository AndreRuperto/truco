import { afterEach, describe, expect, test, vi } from 'vitest';
import { agendarLimpeza, UMA_HORA_MS } from '../src/limpeza';

afterEach(() => {
  vi.useRealTimers();
});

describe('agendarLimpeza', () => {
  test('limpa no boot e a cada hora; o timer não segura o processo; parar cancela', async () => {
    vi.useFakeTimers();
    const limpar = vi.fn(async () => ({ sessoes: 0, links: 0 }));
    const parar = agendarLimpeza(limpar);
    expect(limpar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(UMA_HORA_MS);
    expect(limpar).toHaveBeenCalledTimes(2);
    parar();
    await vi.advanceTimersByTimeAsync(3 * UMA_HORA_MS);
    expect(limpar).toHaveBeenCalledTimes(2);
  });

  test('timer com unref', () => {
    const unref = vi.fn();
    const espiao = vi.spyOn(globalThis, 'setInterval').mockReturnValue({ unref } as unknown as ReturnType<typeof setInterval>);
    agendarLimpeza(async () => {});
    expect(unref).toHaveBeenCalled();
    espiao.mockRestore();
  });

  test('falha na limpeza só vai para o log', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const parar = agendarLimpeza(async () => {
      throw new Error('banco fora');
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(erro).toHaveBeenCalled();
    parar();
    erro.mockRestore();
  });
});
