import { ErroJogada } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { OpcoesMesa } from '../src/mesa/Mesa';
import { avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Só bots jogando (o humano desconectou); conta as ações aplicadas. */
function mesaSoBots(decidirBot: OpcoesMesa['decidirBot']) {
  const aoErro = vi.fn();
  const t = criarMesa({ decidirBot, aoErro });
  t.mesa.sentar('a', 'Ana');
  t.mesa.desconectar('a');
  return { ...t, aoErro };
}

describe('falhas nos timers não travam a mesa', () => {
  test('bot que lança erro: registra e joga automaticamente', () => {
    const t = mesaSoBots(() => {
      throw new Error('bot quebrou');
    });
    expect(() => avancarAte(() => t.mesa.partida!.ultimaMao !== null, 10, 120_000)).not.toThrow();
    expect(t.aoErro).toHaveBeenCalled();
    expect((t.aoErro.mock.calls[0][0] as Error).message).toBe('bot quebrou');
  });

  test('bot que devolve jogada ilegal: registra e joga automaticamente', () => {
    const t = mesaSoBots((_s, cadeira) => ({ tipo: 'jogar', cadeira, indice: 99 }));
    expect(() => avancarAte(() => t.mesa.partida!.ultimaMao !== null, 10, 120_000)).not.toThrow();
    expect(t.aoErro).toHaveBeenCalled();
    expect(t.aoErro.mock.calls[0][0]).toBeInstanceOf(ErroJogada);
  });

  test('exceção qualquer dentro de um timer não escapa e a mesa segue', () => {
    const aoErro = vi.fn();
    let falhou = false;
    const t = criarMesa({
      aoErro,
      enviar: (_id, tipo) => {
        if (tipo === 'acao' && !falhou) {
          falhou = true;
          throw new Error('envio falhou');
        }
      },
    });
    t.mesa.sentar('a', 'Ana');
    expect(() => avancarAte(() => t.mesa.partida!.ultimaMao !== null, 10, 600_000)).not.toThrow();
    expect(aoErro).toHaveBeenCalledWith(expect.objectContaining({ message: 'envio falhou' }));
  });

  test('decidirBot null cai na jogada automática sem erro', () => {
    const t = mesaSoBots(() => null);
    avancarAte(() => t.mesa.partida!.ultimaMao !== null, 10, 120_000);
    expect(t.aoErro).not.toHaveBeenCalled();
  });
});
