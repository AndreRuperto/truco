import { describe, expect, test } from 'vitest';
import { ErroJogada, reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

const RODADA: [0 | 1 | 2 | 3, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];

describe('jogar', () => {
  test('rodada completa passa a vez para quem venceu', () => {
    const s = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), RODADA);
    expect(s.mao!.rodadas).toEqual([0]);
    expect(s.mao!.vez).toBe(0);
    expect(s.mao!.mesa).toHaveLength(0);
    expect(s.mao!.rodadasJogadas[0]).toHaveLength(4);
  });

  test('duas rodadas da mesma dupla fecham a mão com o valor base (mineiro = 2)', () => {
    let s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    s = jogarSeq(s, [...RODADA, ...RODADA]);
    expect(s.placar).toEqual([2, 0]);
    expect(s.ultimaMao).toMatchObject({ vencedor: 0, pontos: 2, motivo: 'rodadas' });
    expect(s.fase).toBe('aguardandoDistribuicao');
    expect(s.mao).toBeNull();
    expect(s.pe).toBe(0);
  });

  test('paulista vale 1 no preset 1-3-6-9-12', () => {
    let s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p'); // manilha = 6
    s = jogarSeq(s, [[0, 2], [1, 0], [2, 2], [3, 0]]); // 6o, 3e, Ko, 2e → dupla 0 (6o manilha)
    s = jogarSeq(s, [[0, 1], [1, 1], [2, 1], [3, 1]]); // 5o, 6e(manilha 12), Jo, 6c(manilha 14) → dupla 1
    s = jogarSeq(s, [[3, 0], [0, 0], [1, 0], [2, 0]]); // 5c, 4p, 5e, Qo(5) → dupla 0
    expect(s.placar).toEqual([1, 0]);
  });

  test('jogar fora da vez é erro', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 1, indice: 0 })).toThrow(ErroJogada);
  });

  test('índice inválido é erro', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 0, indice: 3 })).toThrow(ErroJogada);
  });

  test('carta coberta: proibida na 1ª rodada, vale 0 depois', () => {
    let s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0, coberta: true })).toThrow(ErroJogada);
    s = jogarSeq(s, RODADA);
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0, coberta: true });
    expect(s.mao!.mesa[0]).toMatchObject({ coberta: true, forca: 0 });
  });
});
