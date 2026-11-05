import { describe, expect, test } from 'vitest';
import type { Acao } from '../src/estado';
import { ErroJogada, reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

const seq = (s: ReturnType<typeof distribuida>, acoes: Acao[]) => acoes.reduce(reduce, s);
const base = () => distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p');

describe('truco', () => {
  test('pedir pausa a mão; aceitar sobe para 3 e devolve a vez', () => {
    let s = reduce(base(), { tipo: 'truco', cadeira: 0 });
    expect(s.fase).toBe('respondendoTruco');
    expect(s.mao!.trucoPendente).toEqual({ dupla: 0, proposto: 1 });
    s = reduce(s, { tipo: 'aceitar', cadeira: 1 });
    expect(s.fase).toBe('jogando');
    expect(s.mao!.nivel).toBe(1);
    expect(s.mao!.vez).toBe(0);
  });

  test('correr do truco dá o valor anterior (1) a quem pediu', () => {
    const s = seq(base(), [{ tipo: 'truco', cadeira: 0 }, { tipo: 'correr', cadeira: 3 }]);
    expect(s.placar).toEqual([1, 0]);
    expect(s.ultimaMao!.motivo).toBe('correu');
  });

  test('aumentar para seis; correr do seis dá 3 a quem aumentou', () => {
    let s = seq(base(), [{ tipo: 'truco', cadeira: 0 }, { tipo: 'aumentar', cadeira: 1 }]);
    expect(s.mao!.nivel).toBe(1);
    expect(s.mao!.trucoPendente).toEqual({ dupla: 1, proposto: 2 });
    s = reduce(s, { tipo: 'correr', cadeira: 2 });
    expect(s.placar).toEqual([0, 3]);
  });

  test('escada vai até doze e para (mineiro: dupla 0 vence jogando índice 0)', () => {
    let s = seq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), [
      { tipo: 'truco', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
      { tipo: 'aumentar', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
    ]);
    expect(s.mao!.trucoPendente).toEqual({ dupla: 1, proposto: 4 });
    expect(() => reduce(s, { tipo: 'aumentar', cadeira: 0 })).toThrow(ErroJogada);
    s = reduce(s, { tipo: 'aceitar', cadeira: 2 });
    expect(s.mao!.nivel).toBe(4);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.placar[0] + s.placar[1]).toBe(12);
    expect(s.fase).toBe('fimPartida');
  });

  test('no preset 2-4-8-10-12 truco aceito vale 4', () => {
    let s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    s = seq(s, [{ tipo: 'truco', cadeira: 0 }, { tipo: 'aceitar', cadeira: 1 }]);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.placar).toEqual([4, 0]);
  });

  test('quem teve a aposta aceita não pode aumentar de novo', () => {
    const s = seq(base(), [{ tipo: 'truco', cadeira: 0 }, { tipo: 'aceitar', cadeira: 1 }]);
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow(ErroJogada);
  });

  test('truco fora da vez e resposta da própria dupla são erro', () => {
    expect(() => reduce(base(), { tipo: 'truco', cadeira: 1 })).toThrow(ErroJogada);
    const s = reduce(base(), { tipo: 'truco', cadeira: 0 });
    expect(() => reduce(s, { tipo: 'aceitar', cadeira: 2 })).toThrow(ErroJogada);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0 })).toThrow(ErroJogada);
  });
});
