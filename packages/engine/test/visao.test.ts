import { describe, expect, test } from 'vitest';
import { type Carta, idCarta } from '../src/cartas';
import type { Cadeira } from '../src/estado';
import { reduce } from '../src/reducer';
import { visaoDoJogador } from '../src/visao';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

/** Coleta todo objeto com formato de carta dentro de um valor qualquer. */
function cartasDentro(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((y) => cartasDentro(y, out));
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (typeof o.valor === 'string' && typeof o.naipe === 'string') out.push(idCarta(o as unknown as Carta));
    else Object.values(o).forEach((y) => cartasDentro(y, out));
  }
  return out;
}

describe('visaoDoJogador', () => {
  test('não vaza cartas dos outros', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    for (const cad of [0, 1, 2, 3] as Cadeira[]) {
      const v = visaoDoJogador(s, cad);
      const vistas = cartasDentro(v);
      expect(vistas.sort()).toEqual([...MAOS_DUPLA0_VENCE[cad]].sort());
      expect(v.mao!.qtdCartas).toEqual([3, 3, 3, 3]);
    }
  });

  test('carta coberta só aparece para quem jogou', () => {
    let s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0, coberta: true });
    expect(visaoDoJogador(s, 1).mao!.mesa[0].carta).toBeNull();
    expect(idCarta(visaoDoJogador(s, 0).mao!.mesa[0].carta!)).toBe('5o');
  });

  test('mão de 10: dupla no dez vê o parceiro; adversário não', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 0]);
    expect(visaoDoJogador(s, 0).mao!.maoParceiro!.map(idCarta)).toEqual(MAOS_DUPLA0_VENCE[2]);
    expect(visaoDoJogador(s, 1).mao!.maoParceiro).toBeNull();
  });

  test('mão de 11: ninguém vê a própria mão', () => {
    const s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 0]);
    expect(visaoDoJogador(s, 0).mao!.minhaMao).toEqual([null, null, null]);
  });
});
