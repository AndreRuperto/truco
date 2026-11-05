import { describe, expect, test } from 'vitest';
import { type Carta, novoBaralho } from '../src/cartas';
import type { Acao } from '../src/estado';
import { ErroJogada, ehAcaoJogador, reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq, partida } from './helpers';

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
    ['monte sem baralho', { tipo: 'monte' }],
    ['distribuir sem modo', { tipo: 'distribuir', cadeira: 0 }],
    ['embaralhar com bit 2', { tipo: 'embaralhar', cadeira: 0, bits: [2] }],
    ['cortar com ponto fracionário', { tipo: 'cortar', cadeira: 0, ponto: 1.5 }],
    ['conferir sem booleano', { tipo: 'conferir', cadeira: 1 }],
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

describe('monte valida o baralho', () => {
  const s0 = () => partida(MINEIRO);

  test('baralho válido embaralhado é aceito', () => {
    expect(() => reduce(s0(), { tipo: 'monte', baralho: [...novoBaralho()].reverse() })).not.toThrow();
  });

  test('carta duplicada → ErroJogada', () => {
    const b = novoBaralho();
    b[39] = { ...b[0] };
    expect(() => reduce(s0(), { tipo: 'monte', baralho: b })).toThrow(ErroJogada);
  });

  test('carta inexistente → ErroJogada', () => {
    const b = novoBaralho();
    b[5] = cru({ valor: '8', naipe: 'ouros' }) as unknown as Carta;
    expect(() => reduce(s0(), { tipo: 'monte', baralho: b })).toThrow(ErroJogada);
  });

  test('entrada que não é carta → ErroJogada', () => {
    const b: unknown[] = novoBaralho();
    b[7] = null;
    expect(() => reduce(s0(), cru({ tipo: 'monte', baralho: b }))).toThrow(ErroJogada);
    const b2: unknown[] = novoBaralho();
    b2[7] = { valor: '4', naipe: 'ouros', extra: { valor: 'A', naipe: 'paus' } };
    // propriedades extras não importam para a identidade da carta, mas 4o já existe → duplicada
    expect(() => reduce(s0(), cru({ tipo: 'monte', baralho: b2 }))).toThrow(ErroJogada);
  });
});

describe('ehAcaoJogador', () => {
  test('rejeita monte', () => {
    expect(ehAcaoJogador({ tipo: 'monte', baralho: [] })).toBe(false);
    expect(ehAcaoJogador({ tipo: 'monte', baralho: novoBaralho() })).toBe(false);
  });

  test('aceita ações de jogador bem formadas', () => {
    expect(ehAcaoJogador({ tipo: 'jogar', cadeira: 0, indice: 1 })).toBe(true);
    expect(ehAcaoJogador({ tipo: 'jogar', cadeira: 3, indice: 0, coberta: true })).toBe(true);
    expect(ehAcaoJogador({ tipo: 'truco', cadeira: 2 })).toBe(true);
    expect(ehAcaoJogador({ tipo: 'mao10', cadeira: 1, jogar: false })).toBe(true);
    expect(ehAcaoJogador({ tipo: 'distribuir', cadeira: 3, modo: 'subindo' })).toBe(true);
    expect(ehAcaoJogador({ tipo: 'embaralhar', cadeira: 3 })).toBe(true);
  });

  test.each([
    null,
    undefined,
    42,
    'jogar',
    [],
    {},
    { tipo: 'jogar', cadeira: 0 },
    { tipo: 'jogar', cadeira: 4, indice: 0 },
    { tipo: 'jogar', cadeira: 0, indice: 0, coberta: 1 },
    { tipo: 'mao10', cadeira: 0, jogar: 'false' },
    { tipo: 'aceitar', cadeira: 5 },
    { tipo: 'hackear', cadeira: 0 },
  ])('lixo %j → false', (x) => {
    expect(ehAcaoJogador(x)).toBe(false);
  });
});
