import { type EstadoPartida, novaPartida, novoBaralho, reduce, REGRAS_RANQUEADA } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { jogadaAutomatica, quemDeveAgir } from '../src/mesa/Mesa';

/**
 * Baralho na ordem de novoBaralho() com pe = 3:
 * cad0 = 4o 5o 6o, cad1 = 4e 5e 6e, cad2 = 4c 5c 6c, cad3 = 4p(zap) 5p 6p.
 */
function inicio(placar: [number, number] = [0, 0]): EstadoPartida {
  const s = novaPartida(REGRAS_RANQUEADA.mineiro, 3);
  s.placar = placar;
  return reduce(s, { tipo: 'distribuir', baralho: novoBaralho() });
}

describe('quemDeveAgir', () => {
  test('jogando: só quem está na vez', () => {
    expect(quemDeveAgir(inicio())).toEqual([0]);
  });
  test('truco pendente: a dupla adversária', () => {
    expect(quemDeveAgir(reduce(inicio(), { tipo: 'truco', cadeira: 0 }))).toEqual([1, 3]);
  });
  test('mão de 10: a dupla com 10', () => {
    expect(quemDeveAgir(inicio([4, 10]))).toEqual([1, 3]);
  });
  test('sem mão: ninguém', () => {
    expect(quemDeveAgir(novaPartida(REGRAS_RANQUEADA.mineiro))).toEqual([]);
  });
});

describe('jogadaAutomatica', () => {
  test('joga a carta mais fraca', () => {
    let s = inicio();
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 2 }); // 6o
    s = reduce(s, { tipo: 'jogar', cadeira: 1, indice: 0 }); // 4e
    s = reduce(s, { tipo: 'jogar', cadeira: 2, indice: 0 }); // 4c
    // cad3 tem 4p (zap, 14), 5p (2), 6p (3) → mais fraca é 5p (índice 1)
    expect(jogadaAutomatica(s, 3)).toEqual({ tipo: 'jogar', cadeira: 3, indice: 1 });
  });
  test('corre do truco e da mão de 10', () => {
    expect(jogadaAutomatica(reduce(inicio(), { tipo: 'truco', cadeira: 0 }), 1)).toEqual({ tipo: 'correr', cadeira: 1 });
    expect(jogadaAutomatica(inicio([4, 10]), 3)).toEqual({ tipo: 'mao10', cadeira: 3, jogar: false });
  });
});
