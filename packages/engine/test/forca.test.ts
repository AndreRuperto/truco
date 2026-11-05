import { describe, expect, test } from 'vitest';
import type { Carta, Naipe, Valor } from '../src/cartas';
import { forca } from '../src/forca';

const N: Record<string, Naipe> = { o: 'ouros', e: 'espadas', c: 'copas', p: 'paus' };
const c = (s: string): Carta => ({ valor: s.slice(0, -1) as Valor, naipe: N[s.slice(-1)] });

describe('paulista (vira)', () => {
  test('vira 7 → manilha é Q, com ordem ♣ > ♥ > ♠ > ♦', () => {
    const vira = c('7o');
    expect(forca(c('Qp'), 'paulista', vira)).toBe(15);
    expect(forca(c('Qc'), 'paulista', vira)).toBe(14);
    expect(forca(c('Qe'), 'paulista', vira)).toBe(13);
    expect(forca(c('Qo'), 'paulista', vira)).toBe(12);
    expect(forca(c('3e'), 'paulista', vira)).toBe(10);
    expect(forca(c('4o'), 'paulista', vira)).toBe(1);
  });

  test('vira 3 → manilha volta para o 4', () => {
    expect(forca(c('4p'), 'paulista', c('3e'))).toBe(15);
    expect(forca(c('3p'), 'paulista', c('3e'))).toBe(10);
  });

  test('paulista sem vira é erro', () => {
    expect(() => forca(c('4p'), 'paulista', null)).toThrow();
  });
});

describe('mineiro (manilhas fixas)', () => {
  test('zap 4♣ > 7♥ > espadilha A♠ > 7♦', () => {
    expect(forca(c('4p'), 'mineiro', null)).toBe(15);
    expect(forca(c('7c'), 'mineiro', null)).toBe(14);
    expect(forca(c('Ae'), 'mineiro', null)).toBe(13);
    expect(forca(c('7o'), 'mineiro', null)).toBe(12);
  });

  test('demais cartas seguem a ordem comum', () => {
    expect(forca(c('7e'), 'mineiro', null)).toBe(4);
    expect(forca(c('Ac'), 'mineiro', null)).toBe(8);
    expect(forca(c('4o'), 'mineiro', null)).toBe(1);
    expect(forca(c('3o'), 'mineiro', null)).toBe(10);
  });
});

describe('coringa (mão limpa)', () => {
  test('acima do 3, abaixo da menor manilha; os dois coringas têm a mesma força', () => {
    expect(forca(c('Cc'), 'mineiro', null)).toBe(11);
    expect(forca(c('Cp'), 'mineiro', null)).toBe(11);
    expect(forca(c('Cc'), 'mineiro', null)).toBeGreaterThan(forca(c('3o'), 'mineiro', null));
    expect(forca(c('Cc'), 'mineiro', null)).toBeLessThan(forca(c('7o'), 'mineiro', null));
  });
});
