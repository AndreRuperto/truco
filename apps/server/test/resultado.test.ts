import { describe, expect, test } from 'vitest';
import { contadoresZerados, contarAcao, percentual } from '../src/ranking/estatisticas';
import { deltaAbandono, deltasDoFim, type JogadorRanqueado } from '../src/ranking/resultado';

const j = (usuarioId: number, dupla: 0 | 1, elo: number): JogadorRanqueado => ({ usuarioId, dupla, elo });

describe('deltasDoFim', () => {
  test('1x1 entre iguais: +16 / -16', () => {
    const todos = [j(1, 0, 1000), j(2, 1, 1000)];
    expect(deltasDoFim(todos, [1, 2], 0)).toEqual(new Map([[1, 16], [2, -16]]));
  });

  test('2x2: média da dupla contra média da dupla, mesmo delta para os dois', () => {
    const todos = [j(1, 0, 1100), j(3, 0, 900), j(2, 1, 1000), j(4, 1, 1000)];
    expect(deltasDoFim(todos, [1, 2, 3, 4], 0)).toEqual(new Map([[1, 16], [3, 16], [2, -16], [4, -16]]));
  });

  test('zebra vale mais', () => {
    const todos = [j(1, 0, 1200), j(3, 0, 1200), j(2, 1, 1000), j(4, 1, 1000)];
    const d = deltasDoFim(todos, [1, 2, 3, 4], 1);
    expect(d.get(2)).toBe(24);
    expect(d.get(1)).toBe(-24);
  });

  test('só os alvos recebem delta (quem abandonou fica de fora), mas a média usa todos', () => {
    const todos = [j(1, 0, 1000), j(3, 0, 1400), j(2, 1, 1200), j(4, 1, 1200)];
    expect(deltasDoFim(todos, [3, 2, 4], 0)).toEqual(new Map([[3, 16], [2, -16], [4, -16]]));
  });

  test('soma zero com K ímpar: vencedor +d, perdedor -d', () => {
    const todos = [j(1, 0, 1000), j(2, 1, 1000)];
    expect(deltasDoFim(todos, [1, 2], 1, 25)).toEqual(new Map([[1, -13], [2, 13]]));
  });

  test('dupla sem humano é erro', () => {
    expect(() => deltasDoFim([j(1, 0, 1000)], [1], 0)).toThrow();
  });
});

describe('deltaAbandono', () => {
  test('derrota contra a média dos adversários', () => {
    expect(deltaAbandono([j(1, 0, 1000), j(2, 1, 1000)], 1)).toBe(-16);
    expect(deltaAbandono([j(1, 0, 1000), j(2, 1, 1200)], 1, 32)).toBe(-8);
  });

  test('abandono com K ímpar: o simétrico do que o vencedor ganharia', () => {
    expect(deltaAbandono([j(1, 0, 1000), j(2, 1, 1000)], 1, 25)).toBe(-13);
  });

  test('usuário fora da partida é erro', () => {
    expect(() => deltaAbandono([j(1, 0, 1000), j(2, 1, 1000)], 9)).toThrow();
  });
});

describe('contadores de truco', () => {
  test('truco, aumentar, aceitar, correr e recusar mão de 10', () => {
    let c = contadoresZerados();
    c = contarAcao(c, { tipo: 'truco', cadeira: 0 });
    c = contarAcao(c, { tipo: 'aceitar', cadeira: 0 });
    c = contarAcao(c, { tipo: 'aumentar', cadeira: 0 });
    c = contarAcao(c, { tipo: 'correr', cadeira: 0 });
    c = contarAcao(c, { tipo: 'mao10', cadeira: 0, jogar: false });
    c = contarAcao(c, { tipo: 'mao10', cadeira: 0, jogar: true });
    c = contarAcao(c, { tipo: 'jogar', cadeira: 0, indice: 1 });
    expect(c).toEqual({ trucosPedidos: 2, respostasTruco: 3, trucosAceitos: 2, corridas: 2 });
  });

  test('não altera o objeto recebido', () => {
    const c = contadoresZerados();
    contarAcao(c, { tipo: 'truco', cadeira: 1 });
    expect(c.trucosPedidos).toBe(0);
  });

  test('percentual inteiro, null sem respostas', () => {
    expect(percentual(2, 3)).toBe(67);
    expect(percentual(0, 0)).toBeNull();
  });
});
