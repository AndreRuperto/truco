import { describe, expect, test } from 'vitest';
import { type Carta, idCarta } from '../src/cartas';
import type { Cadeira } from '../src/estado';
import { reduce } from '../src/reducer';
import { visaoDoJogador } from '../src/visao';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

const RODADA: [Cadeira, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];
const ids = (r: { carta: Carta | null }[]) => r.map((j) => (j.carta ? idCarta(j.carta) : null));

describe('ultimaMao guarda a mão encerrada', () => {
  test('fim por rodadas (2 rodadas): inclui a carta final', () => {
    const s = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), [...RODADA, ...RODADA]);
    const u = s.ultimaMao!;
    expect(u).toMatchObject({ vencedor: 0, pontos: 2, motivo: 'rodadas', rodadas: [0, 0], vira: null });
    expect(u.rodadasJogadas).toHaveLength(2);
    expect(ids(u.rodadasJogadas[0])).toEqual(['4p', '3e', 'Qo', '2e']);
    expect(ids(u.rodadasJogadas[1])).toEqual(['5o', '5e', 'Jo', '5c']);
    expect(u.rodadasJogadas[1][3].cadeira).toBe(3);
  });

  test('fim por rodadas (3 rodadas, paulista): guarda a vira', () => {
    let s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p'); // manilha = 6
    s = jogarSeq(s, [[0, 2], [1, 0], [2, 2], [3, 0]]); // dupla 0
    s = jogarSeq(s, [[0, 1], [1, 1], [2, 1], [3, 1]]); // dupla 1 (6c)
    s = jogarSeq(s, [[3, 0], [0, 0], [1, 0], [2, 0]]); // dupla 0
    const u = s.ultimaMao!;
    expect(u.rodadas).toEqual([0, 1, 0]);
    expect(idCarta(u.vira!)).toBe('5p');
    expect(u.rodadasJogadas.map(ids)).toEqual([
      ['6o', '3e', 'Ko', '2e'],
      ['5o', '6e', 'Jo', '6c'],
      ['5c', '4p', '5e', 'Qo'],
    ]);
  });

  test('correu no meio da rodada: guarda o que já foi jogado', () => {
    let s = reduce(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p'), { tipo: 'jogar', cadeira: 0, indice: 0 });
    s = reduce(s, { tipo: 'truco', cadeira: 1 });
    s = reduce(s, { tipo: 'correr', cadeira: 2 });
    const u = s.ultimaMao!;
    expect(u).toMatchObject({ vencedor: 1, pontos: 1, motivo: 'correu', rodadas: [] });
    expect(u.rodadasJogadas.map(ids)).toEqual([['4p']]);
    expect(idCarta(u.vira!)).toBe('5p');
  });

  test('mão de 10 corrida: nada jogado', () => {
    const s = reduce(distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 4]), {
      tipo: 'mao10',
      cadeira: 0,
      jogar: false,
    });
    expect(s.ultimaMao).toMatchObject({ motivo: 'mao10Correu', rodadas: [], rodadasJogadas: [], vira: null });
  });
});

describe('visaoDoJogador.ultimaMao', () => {
  // R1: dupla 0 (zap). R2: cadeira 0 cobre o 5o; Jo da cadeira 2 vence → fim da mão.
  const fim = () => {
    let s = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), RODADA);
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0, coberta: true });
    s = jogarSeq(s, [[1, 0], [2, 0], [3, 0]]);
    expect(s.mao).toBeNull();
    expect(s.placar).toEqual([2, 0]);
    return s;
  };

  test('carta coberta de outra cadeira aparece como null', () => {
    const v = visaoDoJogador(fim(), 1);
    expect(v.ultimaMao!.rodadasJogadas[1][0]).toMatchObject({ cadeira: 0, coberta: true, carta: null });
    expect(JSON.stringify(v)).not.toContain('"valor":"5","naipe":"ouros"');
  });

  test('quem cobriu ainda vê a própria carta', () => {
    const v = visaoDoJogador(fim(), 0);
    expect(idCarta(v.ultimaMao!.rodadasJogadas[1][0].carta!)).toBe('5o');
  });

  test('estado original continua com a carta', () => {
    const s = fim();
    visaoDoJogador(s, 1);
    expect(idCarta(s.ultimaMao!.rodadasJogadas[1][0].carta)).toBe('5o');
  });
});
