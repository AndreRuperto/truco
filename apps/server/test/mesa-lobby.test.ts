import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { REGRAS_RANQUEADA } from '@truco/engine';
import { criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('lobby', () => {
  test('os dois primeiros humanos ficam na mesma dupla', () => {
    const { mesa } = criarMesa({ humanosEsperados: 4 });
    expect(['a', 'b', 'c', 'd'].map((id) => mesa.sentar(id, id))).toEqual([0, 2, 1, 3]);
    expect(mesa.iniciada).toBe(true);
  });

  test('espera os humanos; só o dono inicia completando com bots', () => {
    const { mesa, estado } = criarMesa({ humanosEsperados: 3 });
    mesa.sentar('a', 'Ana');
    mesa.sentar('b', 'Bia');
    expect(mesa.iniciada).toBe(false);
    expect(estado('a')!.visao).toBeNull();
    expect(estado('a')!.cadeiras.map((c) => c.tipo)).toEqual(['humano', 'vazia', 'humano', 'vazia']);

    mesa.iniciar('b');
    expect(mesa.iniciada).toBe(false);
    mesa.iniciar('a');
    expect(mesa.iniciada).toBe(true);
    expect(estado('b')!.cadeiras.map((c) => c.tipo)).toEqual(['humano', 'bot', 'humano', 'bot']);
    expect(mesa.sentar('c', 'Cid')).toBeNull();
  });

  test('o estado traz as regras da mesa e a chance de interceptar, mesmo antes de começar', () => {
    const regras = { ...REGRAS_RANQUEADA.paulista, familia: 'aberta' as const };
    const { mesa, estado } = criarMesa({ humanosEsperados: 2, regras, chanceInterceptarSinal: 0.25 });
    mesa.sentar('a', 'Ana');
    expect(estado('a')!.visao).toBeNull();
    expect(estado('a')!.regras).toEqual(regras);
    expect(estado('a')!.chanceInterceptarSinal).toBe(0.25);
    mesa.sentar('b', 'Bia');
    expect(estado('b')!.regras).toEqual(regras);
  });

  test('sem chance configurada, o estado diz 0', () => {
    const { mesa, estado } = criarMesa();
    mesa.sentar('a', 'Ana');
    expect(estado('a')!.chanceInterceptarSinal).toBe(0);
  });

  test('não senta o mesmo id duas vezes e limpa o nome', () => {
    const { mesa, estado } = criarMesa({ humanosEsperados: 2 });
    expect(mesa.sentar('a', '   ')).toBe(0);
    expect(mesa.sentar('a', 'Ana')).toBeNull();
    expect(estado('a')!.cadeiras[0].nome).toBe('Jogador');
    mesa.sentar('b', 'x'.repeat(50));
    expect(estado('b')!.cadeiras[2].nome).toHaveLength(20);
  });

  test('nome de humano não pode imitar bot nem ter caracteres invisíveis', () => {
    const { mesa, estado } = criarMesa({ humanosEsperados: 2 });
    mesa.sentar('a', 'Bot Z\u200Bé');
    expect(estado('a')!.cadeiras[0].nome).toBe('Zé');
  });

  test('sair antes do início libera a cadeira', () => {
    const { mesa, estado } = criarMesa({ humanosEsperados: 3 });
    mesa.sentar('a', 'Ana');
    mesa.sentar('b', 'Bia');
    mesa.sair('b');
    expect(estado('a')!.cadeiras[2].tipo).toBe('vazia');
    expect(mesa.sentar('c', 'Cid')).toBe(2);
  });

  test('dono é o primeiro humano conectado', () => {
    const { mesa } = criarMesa({ humanosEsperados: 3 });
    mesa.sentar('a', 'Ana');
    mesa.sentar('b', 'Bia');
    mesa.desconectar('a');
    mesa.iniciar('b');
    expect(mesa.iniciada).toBe(true);
  });

  test('aoIniciar é chamado uma vez, no início manual ou automático', () => {
    const manual = vi.fn();
    const t1 = criarMesa({ humanosEsperados: 3, aoIniciar: manual });
    t1.mesa.sentar('a', 'Ana');
    expect(manual).not.toHaveBeenCalled();
    t1.mesa.iniciar('a');
    t1.mesa.iniciar('a');
    expect(manual).toHaveBeenCalledTimes(1);

    const auto = vi.fn();
    const t2 = criarMesa({ humanosEsperados: 1, aoIniciar: auto });
    t2.mesa.sentar('a', 'Ana');
    expect(auto).toHaveBeenCalledTimes(1);
  });

  test('humanosEsperados fora de 1..4 é erro', () => {
    expect(() => criarMesa({ humanosEsperados: 0 })).toThrow();
    expect(() => criarMesa({ humanosEsperados: 5 })).toThrow();
  });
});
