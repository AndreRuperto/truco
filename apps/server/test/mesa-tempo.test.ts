import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const minhaVez = (t: ReturnType<typeof criarMesa>) => !!t.estado('a')?.prazo?.cadeiras.includes(0);

describe('tempo e bots', () => {
  test('bots jogam sozinhos', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => t.de('a', 'acao').some((x) => x.cadeira !== 0));
  });

  test('prazo informa até quando', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const restante = t.estado('a')!.prazo!.ate - Date.now();
    expect(restante).toBeLessThanOrEqual(TEMPOS.jogadaMs);
    expect(restante).toBeGreaterThan(TEMPOS.jogadaMs - 20);
  });

  test('tempo estourado: joga automaticamente por você', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const antes = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.jogadaMs);
    expect(t.de('a', 'acao')[antes]).toEqual({ cadeira: 0, tipo: 'jogar' });
  });

  test('desconectado: bot assume na hora e nada é enviado', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const enviados = t.caixa.get('a')!.length;
    const cartasAntes = t.mesa.partida!.mao!.maos[0].length;
    t.mesa.desconectar('a');
    vi.advanceTimersByTime(TEMPOS.botMs);
    expect(t.caixa.get('a')!.length).toBe(enviados);
    const m = t.mesa.partida!.mao;
    // jogou por ele: ou a mão acabou (mao null durante a pausa) ou ele tem uma carta a menos
    expect(m === null || m.maos[0].length === cartasAntes - 1).toBe(true);
  });

  test('reconectar reenvia o estado', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => !!t.estado('a')?.visao?.mao);
    t.mesa.desconectar('a');
    const n = t.de('a', 'estado').length;
    t.mesa.reconectar('a');
    expect(t.de('a', 'estado').length).toBe(n + 1);
    expect(t.estado('a')!.cadeiras[0]).toMatchObject({ tipo: 'humano', conectado: true });
  });

  test('sair depois do início: bot permanente', () => {
    const t = criarMesa({ humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    t.mesa.sair('b');
    expect(t.estado('a')!.cadeiras[2].tipo).toBe('bot');
    expect(t.mesa.cadeiraDe('b')).toBeNull();
  });

  test('partida inteira termina e chama aoTerminar uma vez', () => {
    const aoTerminar = vi.fn();
    const t = criarMesa({ aoTerminar });
    t.mesa.sentar('a', 'Ana');
    t.mesa.desconectar('a');
    avancarAte(() => aoTerminar.mock.calls.length > 0, 10, 5_000_000);
    t.mesa.reconectar('a');
    expect(aoTerminar).toHaveBeenCalledTimes(1);
    expect(t.estado('a')!.visao!.fase).toBe('fimPartida');
    expect(t.estado('a')!.visao!.vencedor).not.toBeNull();
  });

  test('bot difícil conduz uma mão inteira', () => {
    const t = criarMesa({ nivelBot: 'dificil' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.desconectar('a');
    avancarAte(() => t.mesa.partida!.ultimaMao !== null, 10, 600_000);
  }, 60_000);
});
