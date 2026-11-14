import { describe, expect, test } from 'vitest';
import { ErroJogada, reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarAteOFimDaMao, jogarSeq } from './helpers';

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

  test('jogar vale o truco (4 no mineiro); pedir truco nela é falta', () => {
    let s = reduce(s0(), { tipo: 'mao10', cadeira: 0, jogar: true });
    expect(s.mao!.nivel).toBe(1);
    // Já é trucada: pedir truco é falta (ver mao-de-onze.test.ts), não um pedido.
    expect(reduce(s, { tipo: 'truco', cadeira: 0 }).ultimaMao).toMatchObject({ vencedor: 1, motivo: 'trucoNaMaoEspecial' });
    s = jogarSeq(s, DUAS_RODADAS);
    expect(s.placar).toEqual([14, 4]);
    expect(s.fase).toBe('fimPartida');
    expect(s.vencedor).toBe(0);
  });

  test('as duas duplas com 10 = mão normal', () => {
    expect(distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 10]).mao!.tipo).toBe('normal');
  });
});

/** Dupla 0 vence duas rodadas paulistas com duas manilhas distintas. */
const MAOS_FERRO_DUPLA0_VENCE = [
  ['6p', '6c', '4p'],
  ['3e', '5e', '7e'],
  ['Qo', 'Jo', 'Ko'],
  ['2e', '5c', '7c'],
];

/** Respeita a cadeira que o motor escolhe após cada rodada. */
function jogarDuasRodadasNaVez(s: ReturnType<typeof distribuida>) {
  for (let i = 0; i < 8 && s.fase === 'jogando'; i++) {
    s = reduce(s, { tipo: 'jogar', cadeira: s.mao!.vez, indice: 0 });
  }
  return s;
}

describe('mão de ferro (11 a 11)', () => {
  test('às cegas: sem coberta, e pedir truco é falta', () => {
    let s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 11]);
    expect(s.mao!.tipo).toBe('mao11');
    expect(s.fase).toBe('jogando');
    expect(reduce(s, { tipo: 'truco', cadeira: 0 }).ultimaMao).toMatchObject({ vencedor: 1, motivo: 'trucoNaMaoEspecial' });
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: s.mao!.vez, indice: 0, coberta: true })).toThrow(ErroJogada);
  });

  test('vale 3 e quem vence leva a partida', () => {
    let s = distribuida(PAULISTA, MAOS_FERRO_DUPLA0_VENCE, '5p', [11, 11]);
    expect(s.mao!.nivel).toBe(1);
    s = jogarDuasRodadasNaVez(s);
    expect(s.ultimaMao).toMatchObject({ vencedor: 0, pontos: 3 });
    expect(s.placar).toEqual([14, 11]);
    expect(s.fase).toBe('fimPartida');
    expect(s.vencedor).toBe(0);
  });

  test('só uma dupla com 11 não é mão de ferro: é a mão de 11 (decisão), se ligada', () => {
    expect(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 3]).mao!.tipo).toBe('normal');
    let s = distribuida({ ...PAULISTA, maoDe10: true }, MAOS_FERRO_DUPLA0_VENCE, '5p', [11, 10]);
    expect(s.fase).toBe('decisaoMao10');
    s = jogarDuasRodadasNaVez(reduce(s, { tipo: 'mao10', cadeira: 0, jogar: true }));
    expect(s.ultimaMao?.pontos).toBe(3);
    expect(s.placar).toEqual([14, 10]);
    expect(s.fase).toBe('fimPartida');
  });

  test('maoDe11 off nunca ativa', () => {
    const regras = { ...PAULISTA, maoDe11: 'off' as const };
    expect(distribuida(regras, MAOS_DUPLA0_VENCE, '5p', [11, 11]).mao!.tipo).toBe('normal');
  });
});

/** Mão de ferro na escada 2-4-8-10-12: o limite é 10 (10 a 10) e vale o 1º nível de truco (4). */
describe('mão de ferro na escada 2-4-8-10-12', () => {
  const FERRO_MINEIRO = { ...MINEIRO, maoDe11: 'onzeAOnze' as const };

  test('10 a 10: mão de ferro, vale 4, e a vitória encerra a partida', () => {
    const s = distribuida(FERRO_MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 10]);
    expect(s.mao!.tipo).toBe('mao11');
    expect(s.fase).toBe('jogando');
    expect(s.mao!.nivel).toBe(1);
    const fim = jogarAteOFimDaMao(s);
    expect(fim.ultimaMao).toMatchObject({ vencedor: 0, pontos: 4, motivo: 'rodadas' });
    expect(fim.placar).toEqual([14, 10]);
    expect(fim.fase).toBe('fimPartida');
    expect(fim.vencedor).toBe(0);
  });

  test('11 a 3 (só com pontos de família) é mão normal: vale 2', () => {
    const normal = distribuida(FERRO_MINEIRO, MAOS_DUPLA0_VENCE, undefined, [11, 3]);
    expect(normal.mao!.tipo).toBe('normal');
    expect(jogarAteOFimDaMao(normal).ultimaMao).toMatchObject({ vencedor: 0, pontos: 2 });
  });
});
