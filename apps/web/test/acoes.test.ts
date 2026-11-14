import { acoesValidas, type Cadeira, type EstadoPartida, reduce, visaoDoJogador } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { agruparAcoes } from '../src/logica/acoes';
import { distribuida, jogar, MINEIRO, naSegundaRodada, noRitual, PAULISTA } from './fixtures';

const ui = (s: EstadoPartida, c: Cadeira) => agruparAcoes(acoesValidas(s, c), visaoDoJogador(s, c));
const rotulos = (s: EstadoPartida, c: Cadeira) => ui(s, c).botoes.map((b) => b.rotulo);

describe('agruparAcoes', () => {
  test('início da mão: jogar as 3 abertas, sem truco (só da 2ª rodada em diante)', () => {
    const s = distribuida(PAULISTA);
    expect(ui(s, 0)).toEqual({ jogaveis: [0, 1, 2], cobriveis: [], empilhaveis: [], botoes: [] });
    expect(ui(s, 1)).toEqual({ jogaveis: [], cobriveis: [], empilhaveis: [], botoes: [] });
    const r2 = naSegundaRodada(s);
    expect(ui(r2, 0).botoes).toEqual([{ chave: 'truco', rotulo: 'Truco!', acao: { tipo: 'truco', cadeira: 0 }, tom: 'principal' }]);
    expect(ui(r2, 1)).toEqual({ jogaveis: [], cobriveis: [], empilhaveis: [], botoes: [] });
  });

  test('respondendo truco: Aceitar, Seis!, Correr — nessa ordem', () => {
    const s = reduce(naSegundaRodada(distribuida(PAULISTA)), { tipo: 'truco', cadeira: 0 });
    expect(rotulos(s, 1)).toEqual(['Aceitar', 'Seis!', 'Correr']);
    expect(rotulos(s, 3)).toEqual(['Aceitar', 'Seis!', 'Correr']);
    expect(ui(s, 1).jogaveis).toEqual([]);
    expect(rotulos(s, 0)).toEqual([]);
  });

  test('depois do truco aceito, a outra dupla pede "Seis!"', () => {
    const aceito = reduce(reduce(naSegundaRodada(distribuida(PAULISTA)), { tipo: 'truco', cadeira: 0 }), { tipo: 'aceitar', cadeira: 1 });
    expect(rotulos(aceito, 0)).toEqual([]); // dupla 0 não pode aumentar o próprio pedido
    expect(rotulos(jogar(aceito, [[0, 0]]), 1)).toEqual(['Seis!']);
  });

  test('da 2ª rodada em diante dá para jogar coberta', () => {
    const s = naSegundaRodada(distribuida(PAULISTA));
    expect(ui(s, 0)).toMatchObject({ jogaveis: [0, 1], cobriveis: [0, 1] });
  });

  test('cangada: clicar na carta empilha; empilhado, a vez tem Truco! e "Mostrar a sua"', () => {
    // paulista, novoBaralho: os quatro 4 cangam na 1ª.
    const s = jogar(distribuida(PAULISTA), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(ui(s, 0)).toEqual({ jogaveis: [], cobriveis: [], empilhaveis: [0, 1], botoes: [] });
    let e = s;
    for (const cadeira of [0, 1, 2, 3] as const) e = reduce(e, { tipo: 'empilhar', cadeira, indice: 0 });
    expect(rotulos(e, e.mao!.vez)).toEqual(['Truco!', 'Mostrar a sua']);
    // Cada um mostra a própria: depois da vez, o próximo tem os mesmos botões.
    e = reduce(e, { tipo: 'mostrar', cadeira: e.mao!.vez });
    expect(rotulos(e, e.mao!.vez)).toEqual(['Truco!', 'Mostrar a sua']);
  });

  test('mão de 10: jogar ou correr da mão', () => {
    const s = distribuida(MINEIRO, undefined, [10, 0]);
    expect(rotulos(s, 0)).toEqual(['Jogar a mão', 'Correr da mão']);
    expect(ui(s, 0).botoes[1].acao).toEqual({ tipo: 'mao10', cadeira: 0, jogar: false });
    expect(ui(s, 0).jogaveis).toEqual([]);
  });

  test('família fechada aparece para todos na janela (blefe vale)', () => {
    const s = distribuida(MINEIRO, [['Qo', 'Jo', 'Ko'], ['3e', '5e', '6e'], ['4c', '5c', '6c'], ['2e', '5p', '6p']]);
    expect(rotulos(s, 0)).toEqual(['Pedir família fechada']); // truco só da 2ª rodada em diante
    expect(rotulos(s, 1)).toEqual(['Pedir família fechada']);
  });
});

describe('agruparAcoes no ritual e na família', () => {
  test('embaralhador: Embaralhar e Passar pra cortar; cortador: Cortar, Embaralhar, Abrir 3, Dar 3, Devolver', () => {
    const s = noRitual();
    expect(rotulos(s, 3)).toEqual(['Embaralhar', 'Passar pra cortar']);
    const t = reduce(s, { tipo: 'passarCorte', cadeira: 3 });
    expect(rotulos(t, 2)).toEqual(['Cortar', 'Embaralhar', 'Abrir 3', 'Dar 3', 'Devolver']);
    expect(ui(t, 2).botoes[0].acao).toEqual({ tipo: 'cortar', cadeira: 2 });
  });

  test('quem dá: os 3 modos', () => {
    const u = reduce(reduce(noRitual(), { tipo: 'passarCorte', cadeira: 3 }), { tipo: 'devolver', cadeira: 2 });
    expect(rotulos(u, 3)).toEqual(['Por cima', 'Por baixo', 'Subindo alternado']);
  });

  test('mesa aberta pede aberta; conferir é da dupla adversária', () => {
    const fam = [['Qo', 'Jo', 'Ko']];
    expect(rotulos(distribuida({ ...PAULISTA, familia: 'aberta' }, fam), 0)).toEqual(['Pedir família aberta']);
    const t = reduce(distribuida(MINEIRO, fam), { tipo: 'familia', cadeira: 0 });
    expect(rotulos(t, 1)).toEqual(['Conferir', 'Deixar passar']);
    expect(rotulos(t, 0)).toEqual([]);
  });
});
