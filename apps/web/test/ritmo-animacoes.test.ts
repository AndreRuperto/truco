import { describe, expect, test } from 'vitest';
import { DUR_CORTE, DUR_DADA, DUR_RIFFLE, DUR_VOO, PASSO_DADA, PASSO_DADA_UMA } from '../src/componentes/animacaoMesa';

// Retorno de quem jogou (2026-11-20): as animações estavam rápidas para quem está começando.
describe('ritmo das animações', () => {
  test('carta, embaralhar e cortar com tempo de acompanhar', () => {
    expect(DUR_VOO).toBeGreaterThanOrEqual(450);
    expect(DUR_RIFFLE).toBeGreaterThanOrEqual(700);
    expect(DUR_CORTE).toBeGreaterThanOrEqual(600);
  });

  test('a distribuição mais longa (uma de cada vez, 12 cartas) termina antes de o bot jogar (5 s, distribuicaoMs)', () => {
    expect(12 * PASSO_DADA_UMA + DUR_DADA).toBeLessThanOrEqual(5_000);
    expect(4 * PASSO_DADA + DUR_DADA).toBeLessThanOrEqual(5_000);
  });
});
