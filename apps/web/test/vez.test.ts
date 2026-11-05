import { reduce, visaoDoJogador } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { quemDeveAgir } from '../src/logica/vez';
import { distribuida, jogar, MINEIRO, PAULISTA } from './fixtures';

describe('quemDeveAgir (igual ao do servidor, a partir da Visao)', () => {
  test("'jogando': só a cadeira da vez", () => {
    const s = jogar(distribuida(PAULISTA), [[0, 0]]);
    expect(quemDeveAgir(visaoDoJogador(s, 2))).toEqual([1]);
  });

  test("'respondendoTruco': as duas cadeiras da dupla que não pediu", () => {
    const s = reduce(distribuida(PAULISTA), { tipo: 'truco', cadeira: 0 });
    expect(s.fase).toBe('respondendoTruco');
    expect(quemDeveAgir(visaoDoJogador(s, 0))).toEqual([1, 3]);
    expect(quemDeveAgir(visaoDoJogador(s, 1))).toEqual([1, 3]);
  });

  test("'decisaoMao10': as cadeiras da dupla no dez", () => {
    expect(quemDeveAgir(visaoDoJogador(distribuida(MINEIRO, undefined, [10, 0]), 1))).toEqual([0, 2]);
    expect(quemDeveAgir(visaoDoJogador(distribuida(MINEIRO, undefined, [0, 10]), 0))).toEqual([1, 3]);
  });

  test('sem mão (entre mãos ou fim): ninguém', () => {
    const s = reduce(distribuida(MINEIRO, undefined, [10, 0]), { tipo: 'mao10', cadeira: 0, jogar: false });
    expect(s.mao).toBeNull();
    expect(quemDeveAgir(visaoDoJogador(s, 0))).toEqual([]);
  });
});
