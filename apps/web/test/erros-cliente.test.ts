import { afterEach, describe, expect, test, vi } from 'vitest';
import { instalarRelatorioDeErros } from '../src/rede/errosCliente';

/** F5.3 do plano MVP: erros do navegador vão para o log do operador, sem dado de usuário. */
describe('relatório de erros do cliente', () => {
  let desinstalar: (() => void) | null = null;
  afterEach(() => {
    desinstalar?.();
    desinstalar = null;
    window.location.hash = '';
  });

  test('window.onerror manda mensagem, pilha curta, rota sem query e versão', () => {
    const enviar = vi.fn();
    window.location.hash = '#/entrar?token=segredo';
    desinstalar = instalarRelatorioDeErros({ enviar, versao: () => 'index-abc' });
    const erro = new Error('quebrou');
    window.dispatchEvent(new ErrorEvent('error', { message: 'quebrou', error: erro }));
    expect(enviar).toHaveBeenCalledTimes(1);
    const corpo = enviar.mock.calls[0][0];
    expect(corpo).toMatchObject({ mensagem: 'quebrou', rota: '#/entrar', versao: 'index-abc' });
    expect(corpo.pilha.length).toBeLessThanOrEqual(1_000);
    expect(JSON.stringify(corpo)).not.toContain('segredo');
    expect(Object.keys(corpo).sort()).toEqual(['mensagem', 'pilha', 'rota', 'versao']);
  });

  test('promessa rejeitada sem tratamento também é relatada', () => {
    const enviar = vi.fn();
    desinstalar = instalarRelatorioDeErros({ enviar, versao: () => 'v' });
    const ev = new Event('unhandledrejection') as Event & { reason?: unknown };
    ev.reason = new Error('falhou a promessa');
    window.dispatchEvent(ev);
    expect(enviar.mock.calls[0][0].mensagem).toBe('falhou a promessa');
  });

  test('a mesma mensagem não repete e há no máximo 5 por página', () => {
    const enviar = vi.fn();
    desinstalar = instalarRelatorioDeErros({ enviar, versao: () => 'v' });
    const disparar = (m: string) => window.dispatchEvent(new ErrorEvent('error', { message: m }));
    disparar('a');
    disparar('a');
    for (let i = 0; i < 10; i++) disparar(`b${i}`);
    expect(enviar).toHaveBeenCalledTimes(5);
    expect(enviar.mock.calls.map((c) => c[0].mensagem)).toEqual(['a', 'b0', 'b1', 'b2', 'b3']);
  });

  test('falha ao enviar não gera outro erro', () => {
    const enviar = vi.fn(() => {
      throw new Error('sem rede');
    });
    desinstalar = instalarRelatorioDeErros({ enviar, versao: () => 'v' });
    expect(() => window.dispatchEvent(new ErrorEvent('error', { message: 'x' }))).not.toThrow();
  });
});
