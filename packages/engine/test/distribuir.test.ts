import { describe, expect, test } from 'vitest';
import { idCarta } from '../src/cartas';
import { reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, baralhoCom, distribuida, partida } from './helpers';

describe('distribuir', () => {
  test('entrega 3 cartas por cadeira a partir de pe+1', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(s.fase).toBe('jogando');
    expect(s.mao!.maos.map((m) => m.map(idCarta))).toEqual(MAOS_DUPLA0_VENCE);
    expect(s.mao!.vez).toBe(0);
    expect(s.mao!.vira).toBeNull();
    expect(s.mao!.tipo).toBe('normal');
  });

  test('paulista revela a vira', () => {
    const s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p');
    expect(idCarta(s.mao!.vira!)).toBe('5p');
  });

  test('não distribui fora de hora nem põe o monte duas vezes', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(() => reduce(s, { tipo: 'monte', baralho: [] })).toThrow();
    expect(() => reduce(partida(MINEIRO), { tipo: 'monte', baralho: [] })).toThrow();
    expect(() => reduce(s, { tipo: 'distribuir', cadeira: 3, modo: 'porCima' })).toThrow();
  });

  test('reduce não muta o estado de entrada', () => {
    const antes = partida(MINEIRO);
    const copia = structuredClone(antes);
    reduce(antes, { tipo: 'monte', baralho: baralhoCom(MAOS_DUPLA0_VENCE) });
    expect(antes).toEqual(copia);
  });
});
