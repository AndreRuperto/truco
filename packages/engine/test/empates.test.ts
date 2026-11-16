/**
 * Item 5 da auditoria de regras (docs/AUDITORIA-REGRAS.md): empates jogados de verdade, nas duas
 * variantes. V = a dupla 0 vence a rodada, D = a dupla 1 vence, E = empate entre as duplas.
 * A tabela pura (`vencedorMao`) está em mao.test.ts; aqui as mãos são distribuídas e jogadas pelo
 * reducer, com a cangada depois do 1º empate, e conferimos quem leva, quantos pontos e o próximo pé.
 */
import { describe, expect, test } from 'vitest';
import type { Dupla, EstadoPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import { cartasDaPartida } from '../src/ritual';
import { MINEIRO, PAULISTA, distribuida, jogarAteOFimDaMao } from './helpers';

type Resultado = 'V' | 'D' | 'E';

/**
 * Mãos em que, jogando sempre o índice 0 (ou empilhando na ordem), as rodadas saem como `seq`.
 * Cartas escolhidas para não serem manilha em nenhuma das variantes (paulista com vira 5♣ → manilha 6;
 * mineiro: 4♣, 7♥, A♠, 7♦): vence a rodada um 3; empata um par de 2 ou de K das duas duplas; o resto é baixo.
 */
function maosPara(seq: readonly Resultado[]): string[][] {
  const tres = ['3o', '3e', '3c'];
  const pares = [['2o', '2e'], ['2c', '2p'], ['Ko', 'Ke']];
  const baixas = ['4o', '4e', '4c', '5o', '5e', '5c', '7e', '7p'];
  const enchimento = ['Qo', 'Qe', 'Qc', 'Qp', 'Jo', 'Je', 'Jc', 'Jp'];
  const maos: string[][] = [[], [], [], []];
  for (const r of seq) {
    if (r === 'E') {
      const [a, b] = pares.shift()!;
      maos[0].push(a);
      maos[1].push(b);
      maos[2].push(baixas.shift()!);
      maos[3].push(baixas.shift()!);
    } else {
      const vencedora = r === 'V' ? 0 : 1;
      for (let cad = 0; cad < 4; cad++) maos[cad].push(cad === vencedora ? tres.shift()! : baixas.shift()!);
    }
  }
  for (const mao of maos) while (mao.length < 3) mao.push(enchimento.shift()!);
  return maos;
}

const CASOS: { seq: Resultado[]; vence: Dupla | null }[] = [
  { seq: ['E', 'V'], vence: 0 },
  { seq: ['E', 'E', 'V'], vence: 0 },
  { seq: ['E', 'E', 'E'], vence: null },
  { seq: ['V', 'E'], vence: 0 },
  { seq: ['V', 'D', 'E'], vence: 0 },
  { seq: ['E', 'D'], vence: 1 },
  { seq: ['D', 'E'], vence: 1 },
];

const VARIANTES: { nome: string; regras: RegrasMesa; vira?: string; base: number }[] = [
  { nome: 'paulista', regras: PAULISTA, vira: '5p', base: 1 },
  { nome: 'mineiro', regras: MINEIRO, base: 2 },
];

/**
 * No mineiro a cangada vai pela de baixo: as de cima viram juntas e contam como 2ª rodada cangada.
 * Então ['E', X] lá é jogado como ['E', E de cima, X de baixo].
 */
const casosDa = (regras: RegrasMesa) =>
  regras.variante === 'mineiro'
    ? CASOS.map((c) => (c.seq[0] === 'E' && c.seq.length === 2 ? { ...c, seq: ['E', 'E', c.seq[1]] as Resultado[] } : c))
    : CASOS;

describe.each(VARIANTES)('empates no $nome', ({ regras, vira, base }) => {
  test.each(casosDa(regras))('$seq → leva $vence', ({ seq, vence }) => {
    const s = distribuida(regras, maosPara(seq), vira);
    expect(s.pe).toBe(3);
    const fim = jogarAteOFimDaMao(s);

    const esperadas = seq.map((r) => (r === 'E' ? 'empate' : r === 'V' ? 0 : 1));
    expect(fim.ultimaMao!.rodadas).toEqual(esperadas);
    expect(fim.ultimaMao!.vencedor).toBe(vence);
    expect(fim.ultimaMao!.pontos).toBe(vence === null ? 0 : base);
    expect(fim.placar).toEqual(vence === null ? [0, 0] : vence === 0 ? [base, 0] : [0, base]);
    // O pé avança uma cadeira por mão, inclusive quando ninguém pontua.
    expect(fim.pe).toBe(0);
    expect(fim.fase).toBe('embaralhando');
    expect(cartasDaPartida(fim)).toHaveLength(40);
  });

  test('o 1º empate abre a cangada: todos empilham antes da 2ª rodada', () => {
    let s = distribuida(regras, maosPara(['E', 'V']), vira);
    for (let i = 0; i < 4; i++) s = jogarUma(s);
    expect(s.fase).toBe('empilhando');
    expect(s.mao!.cangada).toMatchObject({ etapa: 'empilhando' });
  });

  test('empate depois de uma rodada vencida não abre cangada', () => {
    let s = distribuida(regras, maosPara(['V', 'D', 'E']), vira);
    for (let i = 0; i < 8; i++) s = jogarUma(s);
    expect(s.mao!.rodadas).toEqual([0, 1]);
    expect(s.mao!.cangada).toBeNull();
    expect(s.fase).toBe('jogando');
  });
});

function jogarUma(s: EstadoPartida): EstadoPartida {
  return reduce(s, { tipo: 'jogar', cadeira: s.mao!.vez, indice: 0 });
}
