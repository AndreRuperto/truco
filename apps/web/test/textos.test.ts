import { reduce, type Visao, visaoDoJogador, type VisaoResultadoMao } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import {
  marcadoresRodadas,
  nomePedido,
  placarRelativo,
  resumoFimMao,
  resumoFimPartida,
  textoPedidoPendente,
  valorMao,
} from '../src/logica/textos';
import { distribuida, jogar, MINEIRO, PAULISTA } from './fixtures';

const trucado = () => reduce(distribuida(PAULISTA), { tipo: 'truco', cadeira: 0 });

describe('pedido e valor da mão', () => {
  test('nomes por nível', () => {
    expect([0, 1, 2, 3, 4].map(nomePedido)).toEqual(['Mão', 'Truco', 'Seis', 'Nove', 'Doze']);
    expect(nomePedido(9)).toBe('Doze');
  });

  test('valor por preset', () => {
    expect(valorMao(PAULISTA, 0)).toBe(1);
    expect(valorMao(PAULISTA, 1)).toBe(3);
    expect(valorMao(MINEIRO, 2)).toBe(8);
    expect(valorMao(MINEIRO, 4)).toBe(12);
  });

  test('texto do pedido pendente', () => {
    const s = trucado();
    expect(textoPedidoPendente(visaoDoJogador(s, 1))).toBe('Pediram Truco! Vale 3.');
    expect(textoPedidoPendente(visaoDoJogador(s, 0))).toBe('Pedimos Truco! Vale 3.');
    const s2 = reduce(s, { tipo: 'aumentar', cadeira: 1 });
    expect(textoPedidoPendente(visaoDoJogador(s2, 0))).toBe('Pediram Seis! Vale 6.');
    expect(textoPedidoPendente(visaoDoJogador(distribuida(PAULISTA), 0))).toBeNull();
  });
});

describe('placar e rodadas', () => {
  test('placar do meu ponto de vista', () => {
    const v = visaoDoJogador(distribuida(PAULISTA, undefined, [3, 5]), 1);
    expect(placarRelativo(v)).toEqual({ nos: 5, eles: 3 });
    expect(placarRelativo({ ...v, cadeira: 2 })).toEqual({ nos: 3, eles: 5 });
  });

  test('marcadores das rodadas', () => {
    expect(marcadoresRodadas([1, 'empate'], 0)).toEqual(['eles', 'empate']);
    expect(marcadoresRodadas([1, 0], 3)).toEqual(['nos', 'eles']);
  });
});

describe('fim de mão', () => {
  test('ganha nas rodadas', () => {
    // mineiro, novoBaralho: o zap (cadeira 3) leva a 1ª; a 2ª canga → dupla 1 leva 2 pontos
    const s = jogar(distribuida(MINEIRO), [[0, 0], [1, 0], [2, 0], [3, 0], [3, 0], [0, 0], [1, 0], [2, 0]]);
    expect(resumoFimMao(visaoDoJogador(s, 0).ultimaMao!, 0)).toEqual({ titulo: 'Eles levaram!', detalhe: '+2 pontos — nas rodadas', nos: false });
    expect(resumoFimMao(visaoDoJogador(s, 1).ultimaMao!, 1)).toEqual({ titulo: 'Nós levamos!', detalhe: '+2 pontos — nas rodadas', nos: true });
  });

  test('correram do truco', () => {
    const s = reduce(trucado(), { tipo: 'correr', cadeira: 1 });
    expect(resumoFimMao(visaoDoJogador(s, 0).ultimaMao!, 0)).toEqual({ titulo: 'Nós levamos!', detalhe: '+1 ponto — eles correram', nos: true });
    expect(resumoFimMao(visaoDoJogador(s, 1).ultimaMao!, 1)).toEqual({ titulo: 'Eles levaram!', detalhe: '+1 ponto — nós corremos', nos: false });
  });

  test('correram da mão de 10', () => {
    const s = reduce(distribuida(MINEIRO, undefined, [10, 0]), { tipo: 'mao10', cadeira: 0, jogar: false });
    expect(resumoFimMao(visaoDoJogador(s, 0).ultimaMao!, 0).detalhe).toBe('+2 pontos — corremos na mão de 10');
    expect(resumoFimMao(visaoDoJogador(s, 1).ultimaMao!, 1).detalhe).toBe('+2 pontos — eles correram na mão de 10');
  });

  test('empate total', () => {
    const u: VisaoResultadoMao = { vencedor: null, pontos: 0, motivo: 'rodadas', rodadas: ['empate', 'empate', 'empate'], rodadasJogadas: [], vira: null };
    expect(resumoFimMao(u, 0)).toEqual({ titulo: 'Empatou!', detalhe: 'Ninguém pontua nesta mão', nos: null });
  });
});

describe('fim de partida e família', () => {
  test('vitória e derrota', () => {
    const v = visaoDoJogador(distribuida(PAULISTA), 0);
    const fim: Visao = { ...v, fase: 'fimPartida', mao: null, vencedor: 1, placar: [7, 12] };
    expect(resumoFimPartida(fim)).toEqual({ titulo: 'Derrota', placar: 'Nós 7 × 12 Eles', venceu: false });
    expect(resumoFimPartida({ ...fim, cadeira: 1 })).toEqual({ titulo: 'Vitória!', placar: 'Nós 12 × 7 Eles', venceu: true });
  });

  test('partida fechada por família conferida', () => {
    const u: VisaoResultadoMao = { vencedor: 0, pontos: 2, motivo: 'familia', rodadas: [], rodadasJogadas: [], vira: null };
    expect(resumoFimMao(u, 0).detalhe).toBe('+2 pontos — na família conferida');
  });
});
