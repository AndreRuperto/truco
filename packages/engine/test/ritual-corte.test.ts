import { describe, expect, test } from 'vitest';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import { ErroJogada, reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import type { ModoDistribuicao } from '../src/ritual';
import { MINEIRO, PAULISTA, partida } from './helpers';

const ids = (cs: readonly Carta[]) => cs.map(idCarta);
const B = novoBaralho().map(idCarta);
/** pe = 3: embaralhador 3, cortador 2, parceiro do cortador 0. */
const cortando = (regras: RegrasMesa = PAULISTA) =>
  reduce(reduce(partida(regras), { tipo: 'monte', baralho: novoBaralho() }), { tipo: 'passarCorte', cadeira: 3 });
const dar = (regras: RegrasMesa, corte: 'abrir3' | 'dar3', modo: ModoDistribuicao = 'porCima') =>
  reduce(reduce(cortando(regras), { tipo: corte, cadeira: 2 }), { tipo: 'distribuir', cadeira: 3, modo });

describe('abrir 3', () => {
  test('as 3 de cima ficam viradas, gastam os 3 movimentos e saem da mão', () => {
    const t = reduce(cortando(), { tipo: 'abrir3', cadeira: 2 });
    expect(ids(t.ritual!.abertas)).toEqual(B.slice(0, 3));
    expect(t.ritual!.movimentos).toBe(3);
    expect(t.fase).toBe('escolhendoDistribuicao');
    expect(t.monte).toHaveLength(37);
    const s = dar(PAULISTA, 'abrir3');
    expect(ids(s.mao!.abertasNoCorte)).toEqual(B.slice(0, 3));
    expect(s.mao!.maos.map(ids)).toEqual([B.slice(3, 6), B.slice(6, 9), B.slice(9, 12), B.slice(12, 15)]);
    expect(idCarta(s.mao!.vira!)).toBe(B[15]);
  });

  test('só como primeiro movimento e só o cortador', () => {
    const t = reduce(cortando(), { tipo: 'cortar', cadeira: 2, ponto: 20 });
    expect(() => reduce(t, { tipo: 'abrir3', cadeira: 2 })).toThrow(ErroJogada);
    expect(() => reduce(cortando(), { tipo: 'abrir3', cadeira: 3 })).toThrow(ErroJogada);
  });

  test('no fim da mão as abertas voltam ao monte depois das mãos', () => {
    let s = dar(MINEIRO, 'abrir3');
    s = reduce(s, { tipo: 'truco', cadeira: 0 });
    s = reduce(s, { tipo: 'correr', cadeira: 1 });
    expect(ids(s.monte)).toEqual([...B.slice(3, 15), ...B.slice(0, 3), ...B.slice(15)]);
  });
});

describe('dar 3', () => {
  test('as 3 de cima viram a mão do parceiro do cortador, que é pulado', () => {
    const t = reduce(cortando(), { tipo: 'dar3', cadeira: 2 });
    expect(t.ritual!.dadas!.cadeira).toBe(0);
    expect(t.fase).toBe('escolhendoDistribuicao');
    const s = dar(PAULISTA, 'dar3');
    expect(s.mao!.pulada).toBe(0);
    expect(s.mao!.maos.map(ids)).toEqual([B.slice(0, 3), B.slice(3, 6), B.slice(6, 9), B.slice(9, 12)]);
    expect(idCarta(s.mao!.vira!)).toBe(B[12]);
  });

  test('subindo alternado com dar 3: só os outros três recebem, do fundo', () => {
    const s = dar(PAULISTA, 'dar3', 'subindo');
    expect(s.mao!.maos.map(ids)).toEqual([
      B.slice(0, 3),
      [B[39], B[36], B[33]],
      [B[38], B[35], B[32]],
      [B[37], B[34], B[31]],
    ]);
    expect(idCarta(s.mao!.vira!)).toBe(B[30]);
  });

  test('não depois de outro movimento', () => {
    const t = reduce(cortando(), { tipo: 'embaralhar', cadeira: 2, bits: novoBaralho().map(() => 0 as const) });
    expect(() => reduce(t, { tipo: 'dar3', cadeira: 2 })).toThrow(ErroJogada);
  });
});
