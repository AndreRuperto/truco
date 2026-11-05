import { describe, expect, test } from 'vitest';
import { idCarta } from '../src/cartas';
import { ehFamilia } from '../src/familia';
import { ErroJogada, reduce } from '../src/reducer';
import { MINEIRO, c, distribuida } from './helpers';

const MAOS = [
  ['Qo', 'Jo', 'Ae'],
  ['3e', '5e', '6e'],
  ['4p', '7c', 'Ko'],
  ['2e', '5c', '6c'],
];

describe('ehFamilia', () => {
  test('3 cartas só de Q, J, K, A', () => {
    expect(ehFamilia(['Qo', 'Jc', 'Kp'].map(c))).toBe(true);
    expect(ehFamilia(['Ao', 'Ac', 'Ae'].map(c))).toBe(true);
    expect(ehFamilia(['Qo', 'Jc', '3p'].map(c))).toBe(false);
    expect(ehFamilia(['Qo', 'Jc'].map(c))).toBe(false);
  });
});

describe('pedir família', () => {
  test('fechada: redistribui sem revelar as cartas, mesmo pé', () => {
    const s = reduce(distribuida(MINEIRO, MAOS), { tipo: 'familia', cadeira: 0 });
    expect(s.fase).toBe('embaralhando');
    expect(s.mao).toBeNull();
    expect(s.pe).toBe(3);
    expect(s.ultimaFamilia).toEqual({ cadeira: 0, cartas: null });
    expect(s.placar).toEqual([0, 0]);
  });

  test('aberta: revela as cartas', () => {
    const regras = { ...MINEIRO, familia: 'aberta' as const };
    const s = reduce(distribuida(regras, MAOS), { tipo: 'familia', cadeira: 0 });
    expect(s.ultimaFamilia!.cartas!.map(idCarta)).toEqual(['Qo', 'Jo', 'Ae']);
  });

  test('mão que não é família, depois da 1ª carta, ou com família desligada → erro', () => {
    const s = distribuida(MINEIRO, MAOS);
    expect(() => reduce(s, { tipo: 'familia', cadeira: 1 })).toThrow(ErroJogada);
    const depois = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 2 });
    expect(() => reduce(depois, { tipo: 'familia', cadeira: 0 })).toThrow(ErroJogada);
    const off = distribuida({ ...MINEIRO, familia: 'off' }, MAOS);
    expect(() => reduce(off, { tipo: 'familia', cadeira: 0 })).toThrow(ErroJogada);
  });
});

describe('coringa e família', () => {
  test('coringa não conta como figura', () => {
    expect(ehFamilia(['Qo', 'Jc', 'Cc'].map(c))).toBe(false);
    expect(ehFamilia(['Cc', 'Cp', 'Kp'].map(c))).toBe(false);
  });
});
