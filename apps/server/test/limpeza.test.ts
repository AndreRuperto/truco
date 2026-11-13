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

  test('falha na limpeza só vai para o log (JSON de uma linha no stderr)', async () => {
    const erro = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const parar = agendarLimpeza(async () => {
      throw new Error('banco fora');
    });
    await new Promise((r) => setTimeout(r, 0));
    const linha = JSON.parse(String(erro.mock.calls[0][0]));
    expect(linha).toMatchObject({ nivel: 'erro', evento: 'limpeza_falhou', erro: { mensagem: 'banco fora' } });
    parar();
    erro.mockRestore();
  });
});
