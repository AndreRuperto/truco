import { describe, expect, test } from 'vitest';
import { ehManilha, manilhaDoNaipe, melhorManilha } from '../src/manilhas';
import { c } from './helpers';

describe('manilhaDoNaipe', () => {
  test('mineiro: manilhas fixas', () => {
    expect(manilhaDoNaipe('paus', 'mineiro', null)).toEqual(c('4p'));
    expect(manilhaDoNaipe('copas', 'mineiro', null)).toEqual(c('7c'));
    expect(manilhaDoNaipe('espadas', 'mineiro', null)).toEqual(c('Ae'));
    expect(manilhaDoNaipe('ouros', 'mineiro', null)).toEqual(c('7o'));
  });

  test('paulista: a carta seguinte à vira, no naipe pedido', () => {
    expect(manilhaDoNaipe('copas', 'paulista', c('5p'))).toEqual(c('6c'));
    expect(manilhaDoNaipe('paus', 'paulista', c('3o'))).toEqual(c('4p'));
    expect(manilhaDoNaipe('ouros', 'paulista', null)).toBeNull();
  });
});

describe('ehManilha', () => {
  test('mineiro e paulista', () => {
    expect(ehManilha(c('4p'), 'mineiro', null)).toBe(true);
    expect(ehManilha(c('4o'), 'mineiro', null)).toBe(false);
    expect(ehManilha(c('6e'), 'paulista', c('5p'))).toBe(true);
    expect(ehManilha(c('5p'), 'paulista', c('5p'))).toBe(false);
    expect(ehManilha(c('6e'), 'paulista', null)).toBe(false);
  });
});

describe('melhorManilha', () => {
  test('a mais forte da mão, ou null', () => {
    expect(melhorManilha([c('7o'), c('Ae'), c('3e')], 'mineiro', null)).toEqual(c('Ae'));
    expect(melhorManilha([c('3e'), c('2e'), c('Ac')], 'mineiro', null)).toBeNull();
    expect(melhorManilha([c('6o'), c('6p'), c('3c')], 'paulista', c('5p'))).toEqual(c('6p'));
    expect(melhorManilha([], 'paulista', c('5p'))).toBeNull();
  });
});
