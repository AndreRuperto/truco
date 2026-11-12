import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import type { Acao } from '../src/estado';
import { ErroJogada, reduce } from '../src/reducer';
import {
  MAOS_DUPLA0_VENCE,
  MINEIRO,
  PAULISTA,
  PRIMEIRA_RODADA_PAULISTA_DUPLA0,
  distribuida,
  jogarPrimeiraRodada,
  jogarSeq,
} from './helpers';

const seq = (s: ReturnType<typeof distribuida>, acoes: Acao[]) => acoes.reduce(reduce, s);
const inicio = () => distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p');
/** Truco só a partir da 2ª rodada: a dupla 0 vence a 1ª e a cadeira 0 volta a ter a vez. */
const base = () => jogarPrimeiraRodada(inicio(), PRIMEIRA_RODADA_PAULISTA_DUPLA0);
const baseMineiro = () => jogarPrimeiraRodada(distribuida(MINEIRO, MAOS_DUPLA0_VENCE));

describe('truco', () => {
  test('na 1ª rodada não se truca; da 2ª em diante pode', () => {
    let s = inicio();
    expect(s.mao!.vez).toBe(0);
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow(ErroJogada);
    expect(acoesValidas(s, 0).some((a) => a.tipo === 'truco')).toBe(false);
    // Nem no meio da 1ª rodada.
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: PRIMEIRA_RODADA_PAULISTA_DUPLA0[0] });
    expect(() => reduce(s, { tipo: 'truco', cadeira: 1 })).toThrow(ErroJogada);
    expect(acoesValidas(s, 1).some((a) => a.tipo === 'truco')).toBe(false);

    s = base();
    expect(s.mao!.rodadas).toEqual([0]);
    expect(s.mao!.vez).toBe(0);
    expect(acoesValidas(s, 0)).toContainEqual({ tipo: 'truco', cadeira: 0 });
    expect(reduce(s, { tipo: 'truco', cadeira: 0 }).fase).toBe('respondendoTruco');
  });

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
    let s = seq(baseMineiro(), [
      { tipo: 'truco', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
      { tipo: 'aumentar', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
    ]);
    expect(s.mao!.trucoPendente).toEqual({ dupla: 1, proposto: 4 });
    expect(() => reduce(s, { tipo: 'aumentar', cadeira: 0 })).toThrow(ErroJogada);
    s = reduce(s, { tipo: 'aceitar', cadeira: 2 });
    expect(s.mao!.nivel).toBe(4);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.placar[0] + s.placar[1]).toBe(12);
    expect(s.fase).toBe('fimPartida');
  });

  test('no preset 2-4-8-10-12 truco aceito vale 4', () => {
    let s = baseMineiro();
    s = seq(s, [{ tipo: 'truco', cadeira: 0 }, { tipo: 'aceitar', cadeira: 1 }]);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.placar).toEqual([4, 0]);
  });

  test('quem teve a aposta aceita não pode aumentar de novo', () => {
    const s = seq(base(), [{ tipo: 'truco', cadeira: 0 }, { tipo: 'aceitar', cadeira: 1 }]);
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow(ErroJogada);
  });

  /**
   * Item 6 da auditoria: correr em cada nível, nas duas escadas. A dupla 0 pede truco e as duas
   * duplas vão aumentando; quem corre do pedido de nível k dá a quem pediu o valor do nível k-1.
   */
  describe.each([
    { nome: '1-3-6-9-12', comeco: base, valores: [1, 3, 6, 9] },
    { nome: '2-4-8-10-12', comeco: baseMineiro, valores: [2, 4, 8, 10] },
  ])('correr em cada nível ($nome)', ({ comeco, valores }) => {
    test.each([1, 2, 3, 4])('pedido de nível %i', (nivel) => {
      const acoes: Acao[] = [{ tipo: 'truco', cadeira: 0 }];
      for (let k = 2; k <= nivel; k++) acoes.push({ tipo: 'aumentar', cadeira: k % 2 === 0 ? 1 : 0 });
      let s = seq(comeco(), acoes);
      const quemPediu = s.mao!.trucoPendente!.dupla;
      expect(s.mao!.trucoPendente!.proposto).toBe(nivel);
      expect(quemPediu).toBe(nivel % 2 === 1 ? 0 : 1);
      s = reduce(s, { tipo: 'correr', cadeira: quemPediu === 0 ? 1 : 0 });
      const esperado: [number, number] = [0, 0];
      esperado[quemPediu] = valores[nivel - 1];
      expect(s.placar).toEqual(esperado);
      expect(s.ultimaMao).toMatchObject({ vencedor: quemPediu, pontos: valores[nivel - 1], motivo: 'correu' });
    });
  });

  test('doze aceito: ninguém pede mais nada nesta mão', () => {
    const s = seq(base(), [
      { tipo: 'truco', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
      { tipo: 'aumentar', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
      { tipo: 'aceitar', cadeira: 0 },
    ]);
    expect(s.mao!.nivel).toBe(4);
    expect(s.mao!.vez).toBe(0);
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow(/máximo/);
    expect(acoesValidas(s, 0).some((a) => a.tipo === 'truco')).toBe(false);
  });

  test('truco fora da vez e resposta da própria dupla são erro', () => {
    expect(() => reduce(base(), { tipo: 'truco', cadeira: 1 })).toThrow(ErroJogada);
    const s = reduce(base(), { tipo: 'truco', cadeira: 0 });
    expect(() => reduce(s, { tipo: 'aceitar', cadeira: 2 })).toThrow(ErroJogada);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0 })).toThrow(ErroJogada);
  });
});
