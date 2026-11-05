import { describe, expect, test } from 'vitest';
import type { Jogada } from '../src/estado';
import { resolverRodada, vencedorMao } from '../src/mao';

const j = (cadeira: 0 | 1 | 2 | 3, forca: number): Jogada => ({
  cadeira,
  forca,
  coberta: forca === 0,
  carta: { valor: '4', naipe: 'ouros' },
});

describe('resolverRodada', () => {
  test('maior carta vence e começa a próxima', () => {
    expect(resolverRodada([j(0, 3), j(1, 9), j(2, 5), j(3, 2)])).toEqual({ resultado: 1, proximo: 1 });
  });
  test('empate entre duplas adversárias = cangou', () => {
    expect(resolverRodada([j(0, 9), j(1, 9), j(2, 1), j(3, 2)]).resultado).toBe('empate');
  });
  test('empate dentro da mesma dupla não é cangar', () => {
    expect(resolverRodada([j(0, 9), j(1, 3), j(2, 9), j(3, 2)])).toEqual({ resultado: 0, proximo: 0 });
  });
  test('todas cobertas = empate', () => {
    expect(resolverRodada([j(0, 0), j(1, 0), j(2, 0), j(3, 0)]).resultado).toBe('empate');
  });
});

describe('vencedorMao', () => {
  test.each([
    [[], 'continua'],
    [[0], 'continua'],
    [[0, 0], 0],
    [[0, 1], 'continua'],
    [[0, 1, 1], 1],
    [[0, 1, 'empate'], 0],
    [[0, 'empate'], 0],
    [['empate'], 'continua'],
    [['empate', 1], 1],
    [['empate', 'empate'], 'continua'],
    [['empate', 'empate', 0], 0],
    [['empate', 'empate', 'empate'], null],
  ] as const)('%j → %s', (rodadas, esperado) => {
    expect(vencedorMao([...rodadas])).toBe(esperado);
  });
});
