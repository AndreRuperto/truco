import { describe, expect, test } from 'vitest';
import { cortarMonte, darCartas, limitesCorte, monteRodaARoda, ordemDistribuicao, riffle } from '../src/ritual';
import { mulberry32 } from '../src/rng';

const seq = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('riffle (Gilbert–Shannon–Reeds com bits)', () => {
  test('bits todos 0 ou todos 1 não mexem no monte', () => {
    expect(riffle(seq(6), [0, 0, 0, 0, 0, 0])).toEqual(seq(6));
    expect(riffle(seq(6), [1, 1, 1, 1, 1, 1])).toEqual(seq(6));
  });

  test('os zeros dizem o tamanho do pacote de cima e por onde cada posição puxa', () => {
    // 2 zeros: pacote de cima [a, b], de baixo [c, d]
    expect(riffle(['a', 'b', 'c', 'd'], [0, 1, 0, 1])).toEqual(['a', 'c', 'b', 'd']);
    // 1 zero: pacote de cima [a], de baixo [b, c, d]
    expect(riffle(['a', 'b', 'c', 'd'], [1, 0, 1, 1])).toEqual(['b', 'a', 'c', 'd']);
  });

  test('sempre é uma permutação', () => {
    const rand = mulberry32(5);
    for (let k = 0; k < 50; k++) {
      const bits = seq(40).map(() => (rand() < 0.5 ? 0 : 1));
      expect([...riffle(seq(40), bits)].sort((x, y) => x - y)).toEqual(seq(40));
    }
  });

  test('distribuição GSR: com 3 cartas, a identidade sai em 4 das 8 sequências de bits', () => {
    let identidades = 0;
    for (let m = 0; m < 8; m++) {
      const bits = [(m >> 2) & 1, (m >> 1) & 1, m & 1];
      if (riffle(seq(3), bits).join() === '0,1,2') identidades++;
    }
    expect(identidades).toBe(4);
  });

  test('um bit por carta', () => {
    expect(() => riffle(seq(3), [0, 1])).toThrow(RangeError);
  });
});

describe('corte', () => {
  test('limites: de 30% a 70% do monte', () => {
    expect(limitesCorte(40)).toEqual([12, 28]);
    expect(limitesCorte(29)).toEqual([9, 20]);
    expect(limitesCorte(26)).toEqual([8, 18]);
  });

  test('a parte de baixo vai para cima', () => {
    expect(cortarMonte(['a', 'b', 'c', 'd', 'e'], 2)).toEqual(['c', 'd', 'e', 'a', 'b']);
  });
});

describe('distribuição', () => {
  test('ordem: a partir de pe + 1, pulando quem ganhou o "dar 3"', () => {
    expect(ordemDistribuicao(3, null)).toEqual([0, 1, 2, 3]);
    expect(ordemDistribuicao(0, 1)).toEqual([2, 3, 0]);
  });

  test('por cima: 3 de uma vez do topo; a vira é a próxima de cima', () => {
    const r = darCartas(seq(20), [0, 1, 2, 3], 'porCima', true);
    expect(r.maos).toEqual([[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]]);
    expect(r.vira).toBe(12);
    expect(r.resto).toEqual(seq(20).slice(13));
  });

  test('por baixo: 3 de uma vez do fundo; a vira é a próxima do fundo', () => {
    const r = darCartas(seq(20), [0, 1, 2, 3], 'porBaixo', true);
    expect(r.maos).toEqual([[19, 18, 17], [16, 15, 14], [13, 12, 11], [10, 9, 8]]);
    expect(r.vira).toBe(7);
    expect(r.resto).toEqual(seq(7));
  });

  test('subindo alternado: do fundo, 1 por vez, 3 voltas', () => {
    const r = darCartas(seq(20), [0, 1, 2, 3], 'subindo', false);
    expect(r.maos).toEqual([[19, 15, 11], [18, 14, 10], [17, 13, 9], [16, 12, 8]]);
    expect(r.vira).toBeNull();
    expect(r.resto).toEqual(seq(8));
  });

  test('quem ficou fora da ordem não recebe', () => {
    const r = darCartas(seq(20), [2, 3, 0], 'porCima', false);
    expect(r.maos).toEqual([[6, 7, 8], [], [0, 1, 2], [3, 4, 5]]);
  });
});

describe('monteRodaARoda', () => {
  test('o monte que, dado por cima, entrega as mesmas mãos da distribuição roda a roda antiga', () => {
    expect(monteRodaARoda(seq(16))).toEqual([0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11, 12, 13, 14, 15]);
  });
});
