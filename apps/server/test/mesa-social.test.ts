import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cartaDoSinal, sinalDaMao } from '../src/mesa/social';
import { TEMPOS, avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type T = ReturnType<typeof criarMesa>;
/** Passo de 1 ms: para logo após a distribuição, antes de qualquer bot jogar (botMs = 10). */
const ateDistribuir = (t: T) => avancarAte(() => !!t.mesa.partida?.mao, 1, 5_000);

describe('bots sinalizam', () => {
  test('bot difícil sinaliza a melhor carta ao parceiro humano no início da mão', () => {
    const t = criarMesa({ nivelBot: 'dificil' });
    t.mesa.sentar('a', 'Ana');
    ateDistribuir(t);
    const s = t.mesa.partida!;
    const m = s.mao!;
    expect(t.de('a', 'sinal')).toEqual([{ de: 2, sinal: sinalDaMao(m.maos[2], s.regras.variante, m.vira) }]);
  });

  test('sinais entre bots viram dica para o parceiro', () => {
    const t = criarMesa({ nivelBot: 'dificil' });
    t.mesa.sentar('a', 'Ana');
    ateDistribuir(t);
    const s = t.mesa.partida!;
    const m = s.mao!;
    const dica = (de: 0 | 1 | 2 | 3) => cartaDoSinal(sinalDaMao(m.maos[de], s.regras.variante, m.vira), s.regras.variante, m.vira);
    expect(t.mesa.dicaPara(3)).toEqual(dica(1));
    expect(t.mesa.dicaPara(1)).toEqual(dica(3));
    expect(t.mesa.dicaPara(0)).toEqual(dica(2));
    expect(t.mesa.dicaPara(2)).toBeNull(); // o humano não sinalizou
  });

  test('bot fácil não sinaliza (padrão)', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    ateDistribuir(t);
    expect(t.de('a', 'sinal')).toEqual([]);
  });
});

describe('bots leem sinais', () => {
  test('sinal do humano vira dica do bot parceiro e zera na mão seguinte', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    ateDistribuir(t);
    t.mesa.sinal('a', 'zap');
    expect(t.mesa.dicaPara(2)).toEqual({ valor: '4', naipe: 'paus' }); // mineiro: zap = 4♣
    vi.advanceTimersByTime(TEMPOS.intervaloMensagemMs);
    t.mesa.sinal('a', 'nada');
    expect(t.mesa.dicaPara(2)).toBeNull();
    vi.advanceTimersByTime(TEMPOS.intervaloMensagemMs);
    t.mesa.sinal('a', 'copas');
    expect(t.mesa.dicaPara(2)).toEqual({ valor: '7', naipe: 'copas' });
    avancarAte(() => t.mesa.partida!.ultimaMao !== null && !!t.mesa.partida!.mao, 10, 600_000);
    expect(t.mesa.dicaPara(2)).toBeNull();
  });
});

describe('falas dos bots', () => {
  test('com chanceFalaBot 1, um bot comenta o fim da rodada', () => {
    const t = criarMesa({ chanceFalaBot: 1 });
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => t.de('a', 'fala').length > 0, 10, 600_000);
    const [f] = t.de('a', 'fala');
    expect(['boa', 'bora', 'vixe']).toContain(f.fala);
    expect(f.de).not.toBe(0);
  });

  test('padrão: bots ficam quietos', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => t.mesa.partida!.ultimaMao !== null, 10, 600_000);
    expect(t.de('a', 'fala')).toEqual([]);
  });
});
