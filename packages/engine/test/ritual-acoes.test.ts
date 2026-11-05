import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import { novoBaralho } from '../src/cartas';
import type { Cadeira, EstadoPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { quemDeveAgir } from '../src/vez';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, distribuida, partida } from './helpers';

const tipos = (s: EstadoPartida, c: Cadeira) => acoesValidas(s, c).map((a) => a.tipo).sort();
/** pe = 3: embaralhador 3, cortador 2. */
const comMonte = () => reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho() });
const cortando = () => reduce(comMonte(), { tipo: 'passarCorte', cadeira: 3 });

describe('ritual: quem age e o que pode', () => {
  test('embaralhando: só o embaralhador; embaralhar ou passar', () => {
    const s = comMonte();
    expect(quemDeveAgir(s)).toEqual([3]);
    expect(quemDeveAgir(visaoDoJogador(s, 1))).toEqual([3]);
    expect(tipos(s, 3)).toEqual(['embaralhar', 'passarCorte']);
    expect(acoesValidas(s, 0)).toEqual([]);
    expect(JSON.stringify(acoesValidas(s, 3))).not.toMatch(/bits|ponto/);
  });

  test('depois de 20 embaralhadas só dá para passar', () => {
    let s = comMonte();
    for (let i = 0; i < 20; i++) s = reduce(s, { tipo: 'embaralhar', cadeira: 3, bits: s.monte.map(() => 0 as const) });
    expect(tipos(s, 3)).toEqual(['passarCorte']);
  });

  test('cortando: só o cortador; abrir/dar 3 só antes do primeiro movimento', () => {
    const t = cortando();
    expect(quemDeveAgir(t)).toEqual([2]);
    expect(tipos(t, 2)).toEqual(['abrir3', 'cortar', 'dar3', 'devolver', 'embaralhar']);
    expect(acoesValidas(t, 3)).toEqual([]);
    const u = reduce(t, { tipo: 'cortar', cadeira: 2, ponto: 15 });
    expect(tipos(u, 2)).toEqual(['cortar', 'devolver', 'embaralhar']);
    expect(JSON.stringify(acoesValidas(t, 2))).not.toMatch(/bits|ponto/);
  });

  test('escolhendo como dar: o embaralhador, nos 3 modos', () => {
    const u = reduce(cortando(), { tipo: 'devolver', cadeira: 2 });
    expect(quemDeveAgir(u)).toEqual([3]);
    expect(acoesValidas(u, 3)).toEqual([
      { tipo: 'distribuir', cadeira: 3, modo: 'porCima' },
      { tipo: 'distribuir', cadeira: 3, modo: 'porBaixo' },
      { tipo: 'distribuir', cadeira: 3, modo: 'subindo' },
    ]);
  });
});

describe('família: janela e conferir', () => {
  const MAOS = [['Qo', 'Jo', 'Ae'], ['3e', '5e', '6e'], ['4p', '7c', 'Ko'], ['2e', '5c', '6c']];

  test('na janela qualquer um pode pedir fechada (blefe vale), mesmo fora da vez', () => {
    const s = distribuida(MINEIRO, MAOS);
    expect(acoesValidas(s, 1)).toEqual([{ tipo: 'familia', cadeira: 1 }]);
    expect(quemDeveAgir(s)).toEqual([0]);
  });

  test('conferindo: a dupla adversária de quem pediu, com conferir ou deixar passar', () => {
    const t = reduce(distribuida(MINEIRO, MAOS), { tipo: 'familia', cadeira: 0 });
    expect(quemDeveAgir(t)).toEqual([1, 3]);
    expect(quemDeveAgir(visaoDoJogador(t, 0))).toEqual([1, 3]);
    expect(acoesValidas(t, 1)).toEqual([
      { tipo: 'conferir', cadeira: 1, conferir: true },
      { tipo: 'conferir', cadeira: 1, conferir: false },
    ]);
    expect(acoesValidas(t, 0)).toEqual([]);
    expect(acoesValidas(t, 2)).toEqual([]);
  });
});
