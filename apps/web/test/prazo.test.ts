import { describe, expect, test } from 'vitest';
import { fracaoRestante, prazoEhMeu, segundosRestantes, vezEhMinha } from '../src/logica/prazo';
import { distribuida, msgEstado, PAULISTA } from './fixtures';

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
    expect(fracaoRestante(null, 0, 20_000)).toBe(0);
    expect(fracaoRestante(prazo, 10_000, 0)).toBe(0);
  });

  test('prazo é meu?', () => {
    expect(prazoEhMeu(msgEstado(null, 0, { prazo }))).toBe(true);
    expect(prazoEhMeu(msgEstado(null, 1, { prazo }))).toBe(false);
    expect(prazoEhMeu(msgEstado(null, 0))).toBe(false);
  });

  test('vez é minha: pelo prazo ou, na mesa sem limite de tempo, por quem deve agir', () => {
    const s = distribuida(PAULISTA);
    const vez = s.mao!.vez;
    const outra = ((vez + 1) % 4) as 0 | 1 | 2 | 3;
    // Com limite, só o prazo conta (o servidor manda o prazo de quem age).
    expect(vezEhMinha(msgEstado(s, vez))).toBe(false);
    expect(vezEhMinha(msgEstado(s, vez, { semLimiteDeTempo: true }))).toBe(true);
    expect(vezEhMinha(msgEstado(s, outra, { semLimiteDeTempo: true }))).toBe(false);
    expect(vezEhMinha(msgEstado(null, 0, { prazo }))).toBe(true);
  });
});
