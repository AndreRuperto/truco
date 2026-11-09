import { describe, expect, test } from 'vitest';
import { ErroJogada, reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

const DUAS_RODADAS: [0 | 1 | 2 | 3, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]];

describe('mão de 10', () => {
  const s0 = () => distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 4]);

  test('dupla com 10 decide antes de jogar', () => {
    const s = s0();
    expect(s.mao!.tipo).toBe('mao10');
    expect(s.fase).toBe('decisaoMao10');
    expect(s.mao!.duplaNoDez).toBe(0);
    expect(() => reduce(s, { tipo: 'mao10', cadeira: 1, jogar: true })).toThrow(ErroJogada);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0 })).toThrow(ErroJogada);
  });

  test('correr dá o valor base ao adversário', () => {
    const s = reduce(s0(), { tipo: 'mao10', cadeira: 2, jogar: false });
    expect(s.placar).toEqual([10, 6]);
    expect(s.ultimaMao!.motivo).toBe('mao10Correu');
  });

  test('jogar vale o truco (4 no mineiro), sem pedir truco', () => {
    let s = reduce(s0(), { tipo: 'mao10', cadeira: 0, jogar: true });
    expect(s.mao!.nivel).toBe(1);
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow(ErroJogada);
    s = jogarSeq(s, DUAS_RODADAS);
    expect(s.placar).toEqual([14, 4]);
    expect(s.fase).toBe('fimPartida');
    expect(s.vencedor).toBe(0);
  });

  test('as duas duplas com 10 = mão normal', () => {
    expect(distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 10]).mao!.tipo).toBe('normal');
  });
});

describe('mão de 11 (ferro)', () => {
  test('qualquer dupla com 11: sem truco e sem coberta', () => {
    let s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 3]);
    expect(s.mao!.tipo).toBe('mao11');
    expect(s.fase).toBe('jogando');
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow(ErroJogada);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: s.mao!.vez, indice: 0, coberta: true })).toThrow(ErroJogada);
  });

  test('mão de 11 já vale 3 e vitória de quem tem 10 encerra a partida', () => {
    let s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [10, 11]);
    expect(s.mao!.tipo).toBe('mao11');
    expect(s.mao!.nivel).toBe(1);
    s = jogarSeq(s, DUAS_RODADAS);
    expect(s.ultimaMao).toMatchObject({ vencedor: 0, pontos: 3 });
    expect(s.placar).toEqual([13, 11]);
    expect(s.fase).toBe('fimPartida');
    expect(s.vencedor).toBe(0);
  });

  test('mão de 11 também vale 3 para a dupla que já tem 11', () => {
    let s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 10]);
    s = jogarSeq(s, DUAS_RODADAS);
    expect(s.ultimaMao?.pontos).toBe(3);
    expect(s.fase).toBe('fimPartida');
  });

  test('opção onzeAOnze só ativa no 11 a 11', () => {
    const regras = { ...PAULISTA, maoDe11: 'onzeAOnze' as const };
    expect(distribuida(regras, MAOS_DUPLA0_VENCE, '5p', [11, 3]).mao!.tipo).toBe('normal');
    expect(distribuida(regras, MAOS_DUPLA0_VENCE, '5p', [11, 11]).mao!.tipo).toBe('mao11');
  });

  test('maoDe11 off nunca ativa', () => {
    const regras = { ...PAULISTA, maoDe11: 'off' as const };
    expect(distribuida(regras, MAOS_DUPLA0_VENCE, '5p', [11, 11]).mao!.tipo).toBe('normal');
  });
});
