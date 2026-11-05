import { describe, expect, test } from 'vitest';
import { fracaoRestante, prazoEhMeu, segundosRestantes } from '../src/logica/prazo';
import { msgEstado } from './fixtures';

describe('prazo', () => {
  const prazo = { cadeiras: [0 as const], ate: 10_000 };

  test('segundos restantes arredondam para cima e não ficam negativos', () => {
    expect(segundosRestantes(prazo, 1_500)).toBe(9);
    expect(segundosRestantes(prazo, 9_999)).toBe(1);
    expect(segundosRestantes(prazo, 10_500)).toBe(0);
    expect(segundosRestantes(null, 0)).toBeNull();
  });

  test('fração para a barra (0..1)', () => {
    expect(fracaoRestante(prazo, 0, 20_000)).toBe(0.5);
    expect(fracaoRestante(prazo, -20_000, 20_000)).toBe(1);
    expect(fracaoRestante(prazo, 11_000, 20_000)).toBe(0);
    expect(fracaoRestante(null, 0)).toBe(0);
  });

  test('prazo é meu?', () => {
    expect(prazoEhMeu(msgEstado(null, 0, { prazo }))).toBe(true);
    expect(prazoEhMeu(msgEstado(null, 1, { prazo }))).toBe(false);
    expect(prazoEhMeu(msgEstado(null, 0))).toBe(false);
  });
});
