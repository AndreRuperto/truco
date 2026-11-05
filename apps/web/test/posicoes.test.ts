import { type Cadeira, parceiroDe } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { cadeiraNaPosicao, posicaoRelativa } from '../src/logica/posicoes';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

describe('posições relativas', () => {
  test('eu embaixo, a próxima à direita, o parceiro em cima', () => {
    expect([0, 1, 2, 3].map((c) => posicaoRelativa(0, c as Cadeira))).toEqual(['baixo', 'direita', 'cima', 'esquerda']);
    expect(posicaoRelativa(3, 0)).toBe('direita');
    expect(posicaoRelativa(3, 1)).toBe('cima');
    expect(posicaoRelativa(2, 1)).toBe('esquerda');
  });

  test('o parceiro está sempre em cima', () => {
    for (const c of CADEIRAS) expect(posicaoRelativa(c, parceiroDe(c))).toBe('cima');
  });

  test('cadeiraNaPosicao é a inversa', () => {
    for (const minha of CADEIRAS) {
      for (const outra of CADEIRAS) expect(cadeiraNaPosicao(minha, posicaoRelativa(minha, outra))).toBe(outra);
    }
  });
});
