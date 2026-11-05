import { visaoDoJogador } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { exibicaoMesa, jogadasNovas, rodadaRecolhida } from '../src/logica/jogadas';
import { distribuida, jogar, PAULISTA } from './fixtures';

// Paulista, vira 7♦ (manilha = Dama). A cadeira 0 tem os 3 e o 2: leva as rodadas.
const MAOS = [
  ['3o', '3e', '2o'],
  ['4e', '5e', '6e'],
  ['4c', '5c', '6c'],
  ['4p', '5p', '6p'],
];
// Empate na 1ª: 0 e 1 jogam 3, o resto joga baixo.
const MAOS_EMPATE = [
  ['3o', '4o', '5o'],
  ['3e', '4e', '5e'],
  ['4c', '5c', '6c'],
  ['4p', '5p', '6p'],
];
const inicio = (maos = MAOS) => distribuida(PAULISTA, maos, [0, 0], '7o');
const exib = (s: ReturnType<typeof inicio>, minha: 0 | 1 | 2 | 3 = 0) => {
  const v = visaoDoJogador(s, minha);
  return exibicaoMesa(v.mao, v.ultimaMao);
};
const RODADA_1: [0 | 1 | 2 | 3, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];

describe('jogadas novas', () => {
  test('primeiro render (F5/reconexão) não tem jogada nova', () => {
    expect(jogadasNovas(null, exib(jogar(inicio(), [[0, 0], [1, 0]])))).toEqual([]);
  });

  test('só a carta que entrou é nova, qualquer que seja a ordem das mensagens', () => {
    const a = exib(jogar(inicio(), [[0, 0]]));
    const b = exib(jogar(inicio(), [[0, 0], [1, 0], [2, 0]]));
    const novas = jogadasNovas(a, b);
    expect(novas).toHaveLength(2);
    expect(novas.map((k) => b.jogadas.find((j) => j.chave === k)!.jogada.cadeira)).toEqual([1, 2]);
    expect(jogadasNovas(b, b)).toEqual([]);
  });

  test('a última carta da rodada é nova mesmo com a mesa já vazia (rodada esmaecida)', () => {
    const a = exib(jogar(inicio(), RODADA_1.slice(0, 3)));
    const b = exib(jogar(inicio(), RODADA_1));
    expect(b.anterior).toBe(true);
    const novas = jogadasNovas(a, b);
    expect(novas).toHaveLength(1);
    expect(b.jogadas.find((j) => j.chave === novas[0])!.jogada.cadeira).toBe(3);
  });
});

describe('rodada recolhida', () => {
  test('nada sai enquanto a rodada está na mesa ou esmaecida', () => {
    const a = exib(jogar(inicio(), RODADA_1.slice(0, 3)));
    const b = exib(jogar(inicio(), RODADA_1));
    expect(rodadaRecolhida(a, b, 0)).toBeNull();
    expect(rodadaRecolhida(null, b, 0)).toBeNull();
  });

  test('quando a próxima rodada começa, as 4 cartas vão para quem levou', () => {
    const fechada = jogar(inicio(), RODADA_1);
    const a = exib(fechada);
    const b = exib(jogar(fechada, [[0, 0]]));
    const r = rodadaRecolhida(a, b, 0)!;
    expect(r.chaves).toHaveLength(4);
    expect(r.destino).toBe('baixo');
    // Visto pela cadeira 1, quem levou (a 0) está à esquerda.
    const r1 = rodadaRecolhida(exib(fechada, 1), exib(jogar(fechada, [[0, 0]]), 1), 1)!;
    expect(r1.destino).toBe('esquerda');
  });

  test('empate: as cartas ficam e somem (sem destino)', () => {
    const fechada = jogar(inicio(MAOS_EMPATE), RODADA_1);
    expect(exib(fechada).resultado).toBe('empate');
    const r = rodadaRecolhida(exib(fechada), exib(jogar(fechada, [[0, 0]])), 0)!;
    expect(r.chaves).toHaveLength(4);
    expect(r.destino).toBeNull();
  });
});
