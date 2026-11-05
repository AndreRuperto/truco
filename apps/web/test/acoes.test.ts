import { acoesValidas, type Cadeira, type EstadoPartida, reduce, visaoDoJogador } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { agruparAcoes } from '../src/logica/acoes';
import { distribuida, jogar, MINEIRO, PAULISTA } from './fixtures';

const ui = (s: EstadoPartida, c: Cadeira) => agruparAcoes(acoesValidas(s, c), visaoDoJogador(s, c).mao);
const rotulos = (s: EstadoPartida, c: Cadeira) => ui(s, c).botoes.map((b) => b.rotulo);

describe('agruparAcoes', () => {
  test('início da mão: jogar as 3 abertas e trucar', () => {
    const s = distribuida(PAULISTA);
    expect(ui(s, 0)).toMatchObject({ jogaveis: [0, 1, 2], cobriveis: [] });
    expect(ui(s, 0).botoes).toEqual([{ chave: 'truco', rotulo: 'Truco!', acao: { tipo: 'truco', cadeira: 0 }, tom: 'principal' }]);
    expect(ui(s, 1)).toEqual({ jogaveis: [], cobriveis: [], botoes: [] });
  });

  test('respondendo truco: Aceitar, Seis!, Correr — nessa ordem', () => {
    const s = reduce(distribuida(PAULISTA), { tipo: 'truco', cadeira: 0 });
    expect(rotulos(s, 1)).toEqual(['Aceitar', 'Seis!', 'Correr']);
    expect(rotulos(s, 3)).toEqual(['Aceitar', 'Seis!', 'Correr']);
    expect(ui(s, 1).jogaveis).toEqual([]);
    expect(rotulos(s, 0)).toEqual([]);
  });

  test('depois do truco aceito, a outra dupla pede "Seis!"', () => {
    const aceito = reduce(reduce(distribuida(PAULISTA), { tipo: 'truco', cadeira: 0 }), { tipo: 'aceitar', cadeira: 1 });
    expect(rotulos(aceito, 0)).toEqual([]); // dupla 0 não pode aumentar o próprio pedido
    expect(rotulos(jogar(aceito, [[0, 0]]), 1)).toEqual(['Seis!']);
  });

  test('da 2ª rodada em diante dá para jogar coberta', () => {
    // paulista, novoBaralho: os quatro 4 cangam na 1ª; a cadeira 0 volta a jogar
    const s = jogar(distribuida(PAULISTA), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(ui(s, 0)).toMatchObject({ jogaveis: [0, 1], cobriveis: [0, 1] });
  });

  test('mão de 10: jogar ou correr da mão', () => {
    const s = distribuida(MINEIRO, undefined, [10, 0]);
    expect(rotulos(s, 0)).toEqual(['Jogar a mão', 'Correr da mão']);
    expect(ui(s, 0).botoes[1].acao).toEqual({ tipo: 'mao10', cadeira: 0, jogar: false });
    expect(ui(s, 0).jogaveis).toEqual([]);
  });

  test('família aparece quando a mão é família', () => {
    const s = distribuida(MINEIRO, [['Qo', 'Jo', 'Ko'], ['3e', '5e', '6e'], ['4c', '5c', '6c'], ['2e', '5p', '6p']]);
    expect(rotulos(s, 0)).toEqual(['Truco!', 'Família!']);
  });
});
