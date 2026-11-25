import { describe, expect, test } from 'vitest';
import type { Cadeira, EstadoPartida } from '../src/estado';
import { idCarta } from '../src/cartas';
import { acoesValidas } from '../src/acoes';
import { reduce } from '../src/reducer';
import { botFacil } from '../src/bots/facil';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, PAULISTA, distribuida, empilharTodos, jogarSeq } from './helpers';

// Pedido do André (2026-11-16): no mineiro, cangou a 1ª → cada um empilha as 2 que sobraram; as 4
// de cima viram juntas e não valem nada; cada um, na vez (começa quem cangou), abre a de baixo, e
// a de baixo decide. Se as de baixo também cangarem, ninguém pontua (naipe não desempata no mineiro).
// O paulista continua: a de cima decide e a de baixo só abre se cangar de novo.
const RODADA_IDX0: [Cadeira, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];
const abrirTodas = (s: EstadoPartida) => {
  const rodadas = s.mao!.rodadas.length;
  while (s.mao && s.mao.rodadas.length === rodadas) s = reduce(s, { tipo: 'mostrar', cadeira: s.mao.vez });
  return s;
};

// R1 canga (3o x 3e). Sobram: 0 [5o, 6o], 1 [2e, 6e], 2 [5e, Qo], 3 [5c, Qe].
const MAOS = [
  ['3o', '5o', '6o'],
  ['3e', '2e', '6e'],
  ['4o', '5e', 'Qo'],
  ['4e', '5c', 'Qe'],
];

describe('cangada no mineiro: a de baixo decide', () => {
  test('empilhou: as de cima viram juntas e a vez (quem cangou) abre a de baixo', () => {
    const s = empilharTodos(jogarSeq(distribuida(MINEIRO, MAOS), RODADA_IDX0));
    expect(s.fase).toBe('jogando');
    expect(s.mao!.cangada!.etapa).toBe('baixo');
    // As de cima, à mostra para todos, contam como rodada sem valor.
    expect(s.mao!.rodadas).toEqual(['empate', 'empate']);
    expect(s.mao!.rodadasJogadas[1].map((j) => idCarta(j.carta))).toEqual(['2e', '5e', '5c', '5o']);
    expect(visaoDoJogador(s, 0).mao!.rodadasJogadas[1]).toHaveLength(4);
    expect(s.mao!.mesa).toEqual([]);
    expect(s.mao!.vez).toBe(1);
    expect(s.mao!.maos.map((m) => m.map(idCarta))).toEqual([['6o'], ['6e'], ['Qo'], ['Qe']]);
    expect(acoesValidas(s, 1).map((a) => a.tipo).sort()).toEqual(['mostrar', 'truco']);
  });

  test('a de baixo mais forte leva, mesmo que a de cima dela perdesse', () => {
    // A dupla 0 põe as fortes embaixo (6o, Qo); a dupla 1 põe 2e por cima (a mais forte de cima).
    const s = abrirTodas(empilharTodos(jogarSeq(distribuida(MINEIRO, MAOS), RODADA_IDX0), [0, 0, 0, 0]));
    // De baixo: 6e (1), Qo (2), Qe (3), 6o (0) → Q é a mais forte, as duas duplas têm Q → cangou de novo.
    expect(s.ultimaMao).toMatchObject({ vencedor: null, pontos: 0, motivo: 'rodadas' });
  });

  test('de baixo com vencedor: a dupla dela leva a mão', () => {
    // Cadeira 2 empilha Qo por cima e deixa 5e embaixo; cadeira 3 deixa Qe embaixo → dupla 1 leva.
    const s = abrirTodas(empilharTodos(jogarSeq(distribuida(MINEIRO, MAOS), RODADA_IDX0), [0, 0, 1, 0]));
    expect(s.ultimaMao).toMatchObject({ vencedor: 1, pontos: 2, motivo: 'rodadas', rodadas: ['empate', 'empate', 1] });
    expect(s.placar).toEqual([0, 2]);
  });

  test('entre uma de baixo e outra, a vez pode trucar no blefe', () => {
    let s = empilharTodos(jogarSeq(distribuida(MINEIRO, MAOS), RODADA_IDX0), [0, 0, 1, 0]);
    s = reduce(s, { tipo: 'mostrar', cadeira: 1 });
    expect(s.mao!.mesa.map((j) => idCarta(j.carta))).toEqual(['6e']);
    expect(acoesValidas(s, 2).map((a) => a.tipo).sort()).toEqual(['mostrar', 'truco']);
    s = reduce(reduce(s, { tipo: 'truco', cadeira: 2 }), { tipo: 'correr', cadeira: 1 });
    expect(s.ultimaMao).toMatchObject({ vencedor: 0, motivo: 'correu' });
  });

  test('o bot põe a mais forte embaixo', () => {
    const s = jogarSeq(distribuida(MINEIRO, MAOS), RODADA_IDX0);
    // Cadeira 1 tem [2e, 6e]: a 2e é a mais forte, então vai embaixo e a 6e (índice 1) por cima.
    expect(botFacil(s, 1)).toEqual({ tipo: 'empilhar', cadeira: 1, indice: 1 });
  });
});

// Pesquisa de regras (2026-11-25): no paulista não há pilha; empatou a 1ª, a 2ª é jogada normal
// e decide. A pilha (de cima descarte, de baixo vale) é do mineiro, como a casa joga.
describe('cangada no paulista: sem pilha, a 2ª rodada é normal e decide', () => {
  // Vira J → manilha é o K, que ninguém tem.
  test('ninguém empilha; a 2ª rodada sai como qualquer outra e decide', () => {
    let s = jogarSeq(distribuida(PAULISTA, MAOS, 'Jp'), RODADA_IDX0);
    expect(s.mao!.rodadas).toEqual(['empate']);
    expect(s.fase).toBe('jogando');
    expect(s.mao!.cangada).toBeNull();
    // Abre quem jogou primeiro a carta que empatou (a cadeira 0, com o 3o).
    expect(s.mao!.vez).toBe(0);
    s = jogarSeq(s, RODADA_IDX0);
    expect(s.ultimaMao).toMatchObject({ vencedor: 1, rodadas: ['empate', 1] });
  });

  test('o bot joga carta, não empilha', () => {
    const s = jogarSeq(distribuida(PAULISTA, MAOS, 'Jp'), RODADA_IDX0);
    expect(botFacil(s, 0)?.tipo).toBe('jogar');
  });
});
