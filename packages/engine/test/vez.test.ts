import { describe, expect, test } from 'vitest';
import { novaPartida, quemDeveAgir, reduce, visaoDoJogador } from '../src';
import { distribuida, MINEIRO, PAULISTA } from './helpers';

/** Mão inicial sem nada especial (pe = 3: a cadeira 0 começa). */
const inicio = (regras = PAULISTA, placar?: [number, number]) => distribuida(regras, [], undefined, placar);

describe('quemDeveAgir (EstadoPartida e Visao dão o mesmo resultado)', () => {
  test("'jogando': só a cadeira da vez", () => {
    const s = reduce(inicio(), { tipo: 'jogar', cadeira: 0, indice: 0 });
    expect(quemDeveAgir(s)).toEqual([1]);
    expect(quemDeveAgir(visaoDoJogador(s, 2))).toEqual([1]);
  });

  test("'respondendoTruco': as duas cadeiras da dupla que não pediu", () => {
    const s = reduce(inicio(), { tipo: 'truco', cadeira: 0 });
    expect(s.fase).toBe('respondendoTruco');
    expect(quemDeveAgir(s)).toEqual([1, 3]);
    expect(quemDeveAgir(visaoDoJogador(s, 0))).toEqual([1, 3]);
    expect(quemDeveAgir(visaoDoJogador(s, 1))).toEqual([1, 3]);
  });

  test("'decisaoMao10': as cadeiras da dupla no dez", () => {
    expect(quemDeveAgir(inicio(MINEIRO, [4, 10]))).toEqual([1, 3]);
    expect(quemDeveAgir(visaoDoJogador(inicio(MINEIRO, [10, 0]), 1))).toEqual([0, 2]);
    expect(quemDeveAgir(visaoDoJogador(inicio(MINEIRO, [0, 10]), 0))).toEqual([1, 3]);
  });

  test('esperando o monte: ninguém; entre mãos: o pé novo, que embaralha', () => {
    expect(quemDeveAgir(novaPartida(MINEIRO))).toEqual([]);
    const s = reduce(inicio(MINEIRO, [10, 0]), { tipo: 'mao10', cadeira: 0, jogar: false });
    expect(s.mao).toBeNull();
    expect(s.pe).toBe(0);
    expect(quemDeveAgir(s)).toEqual([0]);
    expect(quemDeveAgir(visaoDoJogador(s, 2))).toEqual([0]);
  });
});
