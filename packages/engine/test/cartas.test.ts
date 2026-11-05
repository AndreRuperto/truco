import { describe, expect, test } from 'vitest';
import { idCarta, novoBaralho } from '../src/cartas';
import { embaralhar, mulberry32 } from '../src/rng';

describe('baralho', () => {
  test('tem 40 cartas únicas, sem 8, 9, 10', () => {
    const b = novoBaralho();
    expect(b).toHaveLength(40);
    expect(new Set(b.map(idCarta)).size).toBe(40);
    expect(b.some((c) => ['8', '9', '10'].includes(c.valor))).toBe(false);
  });

  test('idCarta usa valor + inicial do naipe', () => {
    expect(idCarta({ valor: '4', naipe: 'paus' })).toBe('4p');
    expect(idCarta({ valor: 'A', naipe: 'espadas' })).toBe('Ae');
  });
});

describe('rng', () => {
  test('embaralhar é determinístico por seed e preserva cartas', () => {
    const a = embaralhar(novoBaralho(), mulberry32(42)).map(idCarta);
    const b = embaralhar(novoBaralho(), mulberry32(42)).map(idCarta);
    const c = embaralhar(novoBaralho(), mulberry32(7)).map(idCarta);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual(novoBaralho().map(idCarta).sort());
  });
});
