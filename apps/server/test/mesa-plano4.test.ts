import type { AcaoJogador } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('sentar em cadeira escolhida', () => {
  test('respeita a cadeira pedida e recusa a ocupada', () => {
    const { mesa, estado } = criarMesa({ humanosEsperados: 2 });
    expect(mesa.sentar('a', 'Ana', 1)).toBe(1);
    expect(mesa.sentar('b', 'Bia', 1)).toBeNull();
    expect(mesa.sentar('b', 'Bia', 0)).toBe(0);
    expect(estado('a')?.minhaCadeira).toBe(1);
    expect(mesa.iniciada).toBe(true);
  });
});

describe('modo', () => {
  test('vai no MsgEstado (padrão: clássica)', () => {
    const t1 = criarMesa();
    t1.mesa.sentar('a', 'Ana');
    expect(t1.estado('a')?.modo).toBe('classica');
    const t2 = criarMesa({ modo: 'privada', humanosEsperados: 2 });
    t2.mesa.sentar('a', 'Ana');
    expect(t2.estado('a')?.modo).toBe('privada');
  });
});

describe('aoAplicar', () => {
  test('avisa cada ação aplicada, dizendo se veio de humano', () => {
    const chamadas: [AcaoJogador, boolean][] = [];
    const { mesa, estado } = criarMesa({ aoAplicar: (a, h) => chamadas.push([a, h]) });
    mesa.sentar('a', 'Ana');
    avancarAte(() => !!estado('a')?.minhasAcoes.some((x) => x.tipo === 'jogar'));
    // tudo o que aconteceu até aqui foi de bot
    expect(chamadas.every(([, porHumano]) => !porHumano)).toBe(true);
    const jogar = estado('a')!.minhasAcoes.find((x) => x.tipo === 'jogar')!;
    const antes = chamadas.length;
    mesa.acao('a', jogar);
    expect(chamadas.length).toBe(antes + 1);
    expect(chamadas.at(-1)).toEqual([expect.objectContaining({ tipo: 'jogar', cadeira: 0 }), true]);
  });

  test('exceção no gancho não derruba a mesa', () => {
    const aoErro = vi.fn();
    const { mesa, estado } = criarMesa({
      aoErro,
      aoAplicar: () => {
        throw new Error('banco fora');
      },
    });
    mesa.sentar('a', 'Ana');
    avancarAte(() => !!estado('a')?.minhasAcoes.some((x) => x.tipo === 'jogar'));
    mesa.acao('a', estado('a')!.minhasAcoes.find((x) => x.tipo === 'jogar')!);
    expect(aoErro).toHaveBeenCalled();
    // a partida segue: o humano volta a ter jogada mais adiante
    const versao = estado('a');
    avancarAte(() => estado('a') !== versao && !!estado('a')?.minhasAcoes.some((x) => x.tipo === 'jogar'));
  });
});

describe('chat', () => {
  test('só na privada; limpa o texto; 1 por segundo por jogador; vale na sala de espera', () => {
    const { mesa, de } = criarMesa({ modo: 'privada', humanosEsperados: 3 });
    mesa.sentar('a', 'Ana');
    mesa.sentar('b', 'Bia');
    mesa.chat('a', '  oi\u0007 pessoal ');
    expect(de('b', 'chat')).toEqual([{ de: 0, nome: 'Ana', texto: 'oi pessoal' }]);
    expect(de('a', 'chat')).toHaveLength(1);
    mesa.chat('a', 'de novo');
    expect(de('b', 'chat')).toHaveLength(1);
    expect(de('a', 'erro').at(-1)).toEqual({ mensagem: 'calma: uma mensagem por segundo' });
    vi.advanceTimersByTime(1_000);
    mesa.chat('a', 'de novo');
    expect(de('b', 'chat')).toHaveLength(2);
    mesa.chat('b', '   ');
    expect(de('a', 'chat')).toHaveLength(2);
    mesa.chat('x', 'quem?');
    expect(de('a', 'chat')).toHaveLength(2);
  });

  test('fora da privada responde erro', () => {
    const { mesa, de } = criarMesa({ humanosEsperados: 2 });
    mesa.sentar('a', 'Ana');
    mesa.chat('a', 'oi');
    expect(de('a', 'chat')).toEqual([]);
    expect(de('a', 'erro').at(-1)).toEqual({ mensagem: 'chat só em mesa privada' });
  });
});
