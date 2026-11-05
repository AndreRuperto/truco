import type { Carta, Naipe, Valor } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { ehVermelha, nomeManilha, rotuloCarta, SIMBOLO, textoCarta } from '../src/logica/cartas';

const N: Record<string, Naipe> = { o: 'ouros', e: 'espadas', c: 'copas', p: 'paus' };
const c = (s: string): Carta => ({ valor: s.slice(0, -1) as Valor, naipe: N[s.slice(-1)] });

describe('exibição de cartas', () => {
  test('símbolos e cor', () => {
    expect(SIMBOLO).toEqual({ ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' });
    expect(textoCarta(c('7c'))).toBe('7♥');
    expect(ehVermelha(c('7c'))).toBe(true);
    expect(ehVermelha(c('Ko'))).toBe(true);
    expect(ehVermelha(c('Ae'))).toBe(false);
    expect(ehVermelha(c('4p'))).toBe(false);
  });

  test('manilhas do mineiro têm nome', () => {
    expect(nomeManilha(c('4p'), 'mineiro', null)).toBe('Zap');
    expect(nomeManilha(c('7c'), 'mineiro', null)).toBe('Copas');
    expect(nomeManilha(c('Ae'), 'mineiro', null)).toBe('Espadilha');
    expect(nomeManilha(c('7o'), 'mineiro', null)).toBe('Pica-fumo');
    expect(nomeManilha(c('7e'), 'mineiro', null)).toBeNull();
    expect(nomeManilha(c('4o'), 'mineiro', null)).toBeNull();
  });

  test('manilhas do paulista dependem da vira', () => {
    const vira = c('5p'); // manilha = 6
    expect(nomeManilha(c('6p'), 'paulista', vira)).toBe('Zap');
    expect(nomeManilha(c('6c'), 'paulista', vira)).toBe('Copas');
    expect(nomeManilha(c('6e'), 'paulista', vira)).toBe('Espadilha');
    expect(nomeManilha(c('6o'), 'paulista', vira)).toBe('Pica-fumo');
    expect(nomeManilha(c('5p'), 'paulista', vira)).toBeNull();
    expect(nomeManilha(c('4p'), 'paulista', c('3o'))).toBe('Zap'); // depois do 3 volta pro 4
    expect(nomeManilha(c('6p'), 'paulista', null)).toBeNull();
  });

  test('rótulo acessível', () => {
    expect(rotuloCarta(c('Ae'), 'mineiro', null)).toBe('Ás de espadas — Espadilha');
    expect(rotuloCarta(c('Qo'), 'mineiro', null)).toBe('Dama de ouros');
    expect(rotuloCarta(c('Jc'), 'paulista', c('5p'))).toBe('Valete de copas');
    expect(rotuloCarta(c('Kp'), 'paulista', c('Jo'))).toBe('Rei de paus — Zap');
  });
});
