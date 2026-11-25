import { describe, expect, test } from 'vitest';
import { distribuirSemRitual, ritualMinimo } from '../src/testes';
import { novoBaralho } from '../src/cartas';
import type { Acao, Cadeira, EstadoPartida } from '../src/estado';
import { proximaCadeira } from '../src/estado';
import { acoesValidas } from '../src/acoes';
import { idCarta } from '../src/cartas';
import { quemDeveAgir } from '../src/vez';
import { visaoDoJogador } from '../src/visao';
import { ErroJogada, reduce } from '../src/reducer';
import { embaralhar, mulberry32 } from '../src/rng';
import {
  MAOS_DUPLA0_VENCE,
  MINEIRO,
  PAULISTA,
  PRIMEIRA_RODADA_PAULISTA_DUPLA0,
  baralhoCom,
  distribuida,
  empilharTodos,
  jogarPrimeiraRodada,
  jogarSeq,
  partida,
  ritualSorteado,
} from './helpers';

const seq = (s: EstadoPartida, acoes: Acao[]) => acoes.reduce(reduce, s);
const RODADA_IDX0: [Cadeira, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];
/** Cangada: cada um, na sua vez, mostra a carta de cima da própria pilha, até fechar a rodada. */
const mostrarRodada = (s: EstadoPartida) => {
  const rodadas = s.mao!.rodadas.length;
  while (s.mao && s.mao.rodadas.length === rodadas) s = reduce(s, { tipo: 'mostrar', cadeira: s.mao.vez });
  return s;
};

// Cangada no paulista: sem pilha, a 2ª decide. A do mineiro, pela de baixo, está em cangada-mineira.test.ts.
describe('cangou dentro de uma mão real', () => {
  // Paulista com vira J (manilha K), sem manilhas em jogo. R1: 3o(10) x 3e(10) → empate entre duplas.
  // R2: 5o(2), 2e(9), 5e(2), 5c(2) → dupla 1 decide.
  const MAOS = [
    ['3o', '5o', '6o'],
    ['3e', '2e', '6e'],
    ['4o', '5e', 'Qo'],
    ['4e', '5c', 'Qe'],
  ];

  test('1ª rodada empatada → a 2ª é jogada normal e quem vence leva a mão', () => {
    let s = jogarSeq(distribuida(PAULISTA, MAOS, 'Jp'), RODADA_IDX0);
    expect(s.mao!.rodadas).toEqual(['empate']);
    expect(s.fase).toBe('jogando');
    s = jogarSeq(s, RODADA_IDX0);
    expect(s.placar).toEqual([0, 1]);
    expect(s.ultimaMao).toMatchObject({ vencedor: 1, pontos: 1, motivo: 'rodadas', rodadas: ['empate', 1] });
  });
});

describe('três rodadas empatadas', () => {
  // Paulista com vira 6 (manilha 7). R1: 3o x 3e; R2: 2o x 2e; R3: Ko x Ke — parceiros sempre mais fracos.
  const MAOS = [
    ['3o', '2o', 'Ko'],
    ['3e', '2e', 'Ke'],
    ['4o', '5e', 'Qo'],
    ['4e', '5c', 'Qe'],
  ];

  test('ninguém pontua e o pé avança', () => {
    let s = jogarSeq(distribuida(PAULISTA, MAOS, '6p'), RODADA_IDX0);
    s = jogarSeq(s, RODADA_IDX0);
    expect(s.mao!.rodadas).toEqual(['empate', 'empate']);
    s = jogarSeq(s, RODADA_IDX0);
    expect(s.ultimaMao).toMatchObject({
      vencedor: null,
      pontos: 0,
      motivo: 'rodadas',
      rodadas: ['empate', 'empate', 'empate'],
    });
    expect(s.placar).toEqual([0, 0]);
    expect(s.pe).toBe(0);
    expect(s.fase).toBe('embaralhando');
  });
});

describe('correr de apostas altas (1-3-6-9-12)', () => {
  // Truco só da 2ª rodada em diante: a dupla 0 vence a 1ª e a cadeira 0 tem a vez.
  const base = () => jogarPrimeiraRodada(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p'), PRIMEIRA_RODADA_PAULISTA_DUPLA0);

  test('correr do nove paga 6', () => {
    const s = seq(base(), [
      { tipo: 'truco', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
      { tipo: 'aumentar', cadeira: 0 },
    ]);
    expect(s.mao!.trucoPendente).toEqual({ dupla: 0, proposto: 3 });
    expect(reduce(s, { tipo: 'correr', cadeira: 1 }).placar).toEqual([6, 0]);
  });

  test('correr do doze paga 9', () => {
    const s = seq(base(), [
      { tipo: 'truco', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
      { tipo: 'aumentar', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 3 },
    ]);
    expect(s.mao!.trucoPendente).toEqual({ dupla: 1, proposto: 4 });
    expect(reduce(s, { tipo: 'correr', cadeira: 2 }).placar).toEqual([0, 9]);
  });
});

describe('depois de truco → seis aceito', () => {
  // Depois da 1ª rodada (vencida pela cadeira 0): cad0 truca, cad1 pede seis, cad0 aceita: a aposta aceita é da dupla 1.
  const aceito = () =>
    seq(jogarPrimeiraRodada(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p'), PRIMEIRA_RODADA_PAULISTA_DUPLA0), [
      { tipo: 'truco', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
      { tipo: 'aceitar', cadeira: 0 },
    ]);

  test('nível é seis e a vez volta para a cadeira 0', () => {
    const s = aceito();
    expect(s.mao!.nivel).toBe(2);
    expect(s.mao!.ultimoAumento).toBe(1);
    expect(s.mao!.vez).toBe(0);
  });

  test('a dupla 0 pode pedir nove na sua vez', () => {
    const s = reduce(aceito(), { tipo: 'truco', cadeira: 0 });
    expect(s.mao!.trucoPendente).toEqual({ dupla: 0, proposto: 3 });
  });

  test('a dupla 1 (que pediu seis) não pode trucar na sua vez', () => {
    let s = reduce(aceito(), { tipo: 'jogar', cadeira: 0, indice: 0 });
    expect(s.mao!.vez).toBe(1);
    expect(() => reduce(s, { tipo: 'truco', cadeira: 1 })).toThrow(ErroJogada);
    s = reduce(s, { tipo: 'jogar', cadeira: 1, indice: 0 });
    expect(reduce(s, { tipo: 'truco', cadeira: 2 }).mao!.trucoPendente).toEqual({ dupla: 0, proposto: 3 });
    s = reduce(s, { tipo: 'jogar', cadeira: 2, indice: 0 });
    expect(() => reduce(s, { tipo: 'truco', cadeira: 3 })).toThrow(ErroJogada);
  });
});

describe('rotação do pé', () => {
  /** Encerra a mão: joga a 1ª rodada (truco só a partir da 2ª), quem está na vez truca, o próximo corre. */
  const encerrar = (s: EstadoPartida) => {
    s = jogarPrimeiraRodada(s);
    const vez = s.mao!.vez;
    return seq(s, [
      { tipo: 'truco', cadeira: vez },
      { tipo: 'correr', cadeira: proximaCadeira(vez) },
    ]);
  };

  test('pé avança uma cadeira por mão, e a mão começa à direita do pé', () => {
    const rand = mulberry32(7);
    let s = partida(MINEIRO);
    const pes: Cadeira[] = [];
    for (let i = 0; i < 3; i++) {
      s = s.fase === 'aguardandoMonte' ? distribuirSemRitual(s, embaralhar(novoBaralho(), rand)) : ritualSorteado(s, rand);
      expect(s.mao!.vez).toBe(proximaCadeira(s.pe));
      s = encerrar(s);
      pes.push(s.pe);
    }
    expect(pes).toEqual([0, 1, 2]);
  });

  test('família não encerra a mão nem troca o pé', () => {
    const FAMILIA = [
      ['Qo', 'Jo', 'Ae'],
      ['3e', '5e', '6e'],
      ['4p', '7c', 'Ko'],
      ['2e', '5c', '6c'],
    ];
    let s = reduce(distribuida({ ...MINEIRO, familia: 'aberta' }, FAMILIA), { tipo: 'familia', cadeira: 0 });
    expect(s.pe).toBe(3);
    expect(s.fase).toBe('jogando');
    expect(s.mao!.vez).toBe(0);
    s = encerrar(s);
    expect(s.pe).toBe(0);
  });
});

describe('reduce não muta a entrada', () => {
  const intacto = (s: EstadoPartida, acao: Acao) => {
    const copia = structuredClone(s);
    reduce(s, acao);
    expect(s).toEqual(copia);
  };

  test('jogar (inclusive a carta que fecha a mão)', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    intacto(s, { tipo: 'jogar', cadeira: 0, indice: 0 });
    const quaseFim = jogarSeq(s, [...RODADA_IDX0, [0, 0], [1, 0], [2, 0]]);
    intacto(quaseFim, { tipo: 'jogar', cadeira: 3, indice: 0 });
  });

  test('truco', () => {
    const s = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), RODADA_IDX0);
    intacto(s, { tipo: 'truco', cadeira: s.mao!.vez });
  });

  test('família', () => {
    const s = distribuida({ ...MINEIRO, familia: 'aberta' }, [
      ['Qo', 'Jo', 'Ae'],
      ['3e', '5e', '6e'],
      ['4p', '7c', 'Ko'],
      ['2e', '5c', '6c'],
    ]);
    intacto(s, { tipo: 'familia', cadeira: 0 });
  });
});

describe('cangada: cartas empilhadas', () => {
  // R1 canga (3o x 3e). Sobram: 0 [5o, 6o], 1 [2e, 6e], 2 [5e, Qo], 3 [5c, Qe].
  const MAOS = [
    ['3o', '5o', '6o'],
    ['3e', '2e', '6e'],
    ['4o', '5e', 'Qo'],
    ['4e', '5c', 'Qe'],
  ];
  // Mineiro, sem manilha em jogo (a pilha só existe no mineiro).
  const cangou = () => jogarSeq(distribuida(MINEIRO, MAOS, 'Jp'), RODADA_IDX0);

  test('todos escolhem a de cima ao mesmo tempo; ninguém joga carta nem truca enquanto empilha', () => {
    const s = cangou();
    expect(quemDeveAgir(s)).toEqual([0, 1, 2, 3]);
    expect(acoesValidas(s, 0).map((a) => a.tipo)).toEqual(['empilhar', 'empilhar']);
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow();
    const um = reduce(s, { tipo: 'empilhar', cadeira: 2, indice: 1 });
    expect(um.mao!.maos[2].map(idCarta)).toEqual(['Qo', '5e']);
    expect(quemDeveAgir(um)).toEqual([0, 1, 3]);
    expect(() => reduce(um, { tipo: 'empilhar', cadeira: 2, indice: 0 })).toThrow(/já empilhou/);
    // A visão de outro jogador não mostra a ordem de quem empilhou, só que empilhou.
    expect(visaoDoJogador(um, 0).mao!.cangada!.empilhou).toEqual([false, false, true, false]);
  });

});
