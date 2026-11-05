import { describe, expect, test } from 'vitest';
import type { Acao } from '../src/estado';
import { ErroJogada, reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

/** Simula uma mensagem crua de cliente, sem garantias de tipo. */
const cru = (x: unknown) => x as Acao;

const FAMILIA = [
  ['Qo', 'Jo', 'Ae'],
  ['3e', '5e', '6e'],
  ['4p', '7c', 'Ko'],
  ['2e', '5c', '6c'],
];

function erroDe(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('não lançou');
}

describe('validação de ações em tempo de execução', () => {
  test('cadeira fora de 0..3 no aceitar com truco pendente → ErroJogada', () => {
    const s = reduce(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p'), { tipo: 'truco', cadeira: 0 });
    expect(() => reduce(s, cru({ tipo: 'aceitar', cadeira: 5 }))).toThrow(ErroJogada);
  });

  test('cadeira fora de 0..3 na família → ErroJogada (não TypeError)', () => {
    const s = distribuida(MINEIRO, FAMILIA);
    expect(() => reduce(s, cru({ tipo: 'familia', cadeira: 5 }))).toThrow(ErroJogada);
  });

  test('mao10 com jogar não booleano → ErroJogada', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 4]);
    expect(() => reduce(s, cru({ tipo: 'mao10', cadeira: 0, jogar: 'false' }))).toThrow(ErroJogada);
  });

  test.each([
    ['null', null],
    ['string', 'jogar'],
    ['sem tipo', { cadeira: 0 }],
    ['tipo desconhecido', { tipo: 'trapacear', cadeira: 0 }],
    ['cadeira não inteira', { tipo: 'truco', cadeira: 0.5 }],
    ['cadeira string', { tipo: 'truco', cadeira: '0' }],
    ['cadeira negativa', { tipo: 'jogar', cadeira: -1, indice: 0 }],
    ['indice string', { tipo: 'jogar', cadeira: 0, indice: '0' }],
    ['indice ausente', { tipo: 'jogar', cadeira: 0 }],
    ['coberta não booleana', { tipo: 'jogar', cadeira: 0, indice: 0, coberta: 'sim' }],
    ['distribuir sem baralho', { tipo: 'distribuir' }],
  ])('%s → ErroJogada', (_nome, acao) => {
    // 2ª rodada, vez da cadeira 0: coberta seria permitida se fosse booleana.
    const s = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    const e = erroDe(() => reduce(s, cru(acao)));
    expect(e).toBeInstanceOf(ErroJogada);
  });

  test('ErroJogada é reconhecível sem instanceof', () => {
    const e = erroDe(() => reduce(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), { tipo: 'truco', cadeira: 1 })) as Error & {
      codigo?: string;
    };
    expect(e.name).toBe('ErroJogada');
    expect(e.codigo).toBe('ERRO_JOGADA');
  });
});
