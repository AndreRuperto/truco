import { describe, expect, test } from 'vitest';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import type { EstadoPartida } from '../src/estado';
import { ehFamilia, fechadasUsadas, janelaDeFamilia, tipoDaProximaFamilia } from '../src/familia';
import { acoesValidas } from '../src/acoes';
import { ErroJogada, reduce } from '../src/reducer';
import { visaoDoJogador } from '../src/visao';
import { cartasDaPartida } from '../src/ritual';
import { MINEIRO, c, distribuida, jogarPrimeiraRodada, partida } from './helpers';

const ids = (cs: readonly Carta[]) => cs.map(idCarta);
/** Mineiro (base 2), pe = 3, a cadeira 0 começa e tem família real (Ae conta, mesmo sendo manilha). */
const MAOS = [
  ['Qo', 'Jo', 'Ae'],
  ['3e', '5e', '6e'],
  ['4p', '7c', 'Ko'],
  ['2e', '5c', '6c'],
];
const pedir = (s: EstadoPartida, cadeira: 0 | 1 | 2 | 3) => reduce(s, { tipo: 'familia', cadeira });
const conferir = (s: EstadoPartida, cadeira: 0 | 1 | 2 | 3, sim: boolean) => reduce(s, { tipo: 'conferir', cadeira, conferir: sim });

describe('ehFamilia', () => {
  test('3 cartas só de Q, J, K, A; coringa não conta', () => {
    expect(ehFamilia(['Qo', 'Jc', 'Kp'].map(c))).toBe(true);
    expect(ehFamilia(['Ao', 'Ac', 'Ae'].map(c))).toBe(true);
    expect(ehFamilia(['Qo', 'Jc', '3p'].map(c))).toBe(false);
    expect(ehFamilia(['Qo', 'Jc'].map(c))).toBe(false);
    expect(ehFamilia(['Qo', 'Jc', 'Cc'].map(c))).toBe(false);
    expect(ehFamilia(['Cc', 'Cp', 'Kp'].map(c))).toBe(false);
  });
});

describe('família fechada', () => {
  test('põe as 3 na mesa, recebe as 3 de cima e espera a dupla adversária', () => {
    const s = distribuida(MINEIRO, MAOS);
    const topo = ids(s.monte.slice(0, 3));
    const t = pedir(s, 0);
    expect(t.fase).toBe('conferindoFamilia');
    expect(ids(t.mao!.maos[0])).toEqual(topo);
    expect(t.mao!.familias).toEqual([{ cadeira: 0, tipo: 'fechada', cartas: MAOS[0].map(c), conferida: null }]);
    expect(t.mao!.familiaPendente).toBe(0);
    expect(t.monte).toHaveLength(25);
    expect(t.placar).toEqual([0, 0]);
    expect(t.pe).toBe(3);
    expect(t.mao!.vez).toBe(0);
    expect(cartasDaPartida(t)).toHaveLength(40);
  });

  test('conferiu e era família: a dupla de quem pediu ganha o valor base da mão', () => {
    const t = pedir(distribuida(MINEIRO, MAOS), 0);
    expect(() => conferir(t, 2, true)).toThrow(ErroJogada);
    const u = conferir(t, 1, true);
    expect(u.placar).toEqual([2, 0]);
    expect(u.mao!.familias[0].conferida).toEqual({ por: 1, real: true });
    expect(u.fase).toBe('jogando');
    expect(u.mao!.familiaPendente).toBeNull();
  });

  test('conferiu e era blefe: a dupla de quem conferiu ganha', () => {
    const t = pedir(distribuida(MINEIRO, MAOS), 1); // 3e 5e 6e: blefe vale na fechada
    const u = conferir(t, 0, true);
    expect(u.placar).toEqual([2, 0]);
    expect(u.mao!.familias[0].conferida).toEqual({ por: 0, real: false });
  });

  test('ninguém conferiu: ninguém pontua e as cartas continuam viradas', () => {
    const u = conferir(pedir(distribuida(MINEIRO, MAOS), 0), 3, false);
    expect(u.placar).toEqual([0, 0]);
    expect(u.mao!.familias[0].conferida).toBeNull();
    expect(u.fase).toBe('jogando');
  });

  test('limite: 3 fechadas por mão; depois só aberta, que precisa ser real', () => {
    let s = distribuida(MINEIRO, MAOS);
    for (let i = 0; i < 3; i++) s = conferir(pedir(s, 1), 0, false);
    expect(fechadasUsadas(s.mao!)).toBe(3);
    expect(tipoDaProximaFamilia(s)).toBe('aberta');
    expect(() => pedir(s, 1)).toThrow(/não é família/); // a cadeira 1 recebeu cartas baixas
    const a = pedir(s, 0); // a 0 ainda tem a família real
    expect(a.fase).toBe('jogando');
    expect(a.mao!.familias[3].tipo).toBe('aberta');
    expect(a.placar).toEqual([0, 0]);
  });

  test('o "abrir 3" do corte conta como uma fechada', () => {
    let s = reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho() });
    s = reduce(s, { tipo: 'passarCorte', cadeira: 3 });
    s = reduce(s, { tipo: 'abrir3', cadeira: 2 });
    s = reduce(s, { tipo: 'distribuir', cadeira: 3, modo: 'porCima' });
    expect(fechadasUsadas(s.mao!)).toBe(1);
    s = conferir(pedir(s, 0), 1, false);
    s = conferir(pedir(s, 0), 1, false);
    expect(tipoDaProximaFamilia(s)).toBe('aberta');
  });
});

describe('família aberta', () => {
  const ABERTA = { ...MINEIRO, familia: 'aberta' as const };

  test('mostra, troca as cartas, ninguém pontua, não tem conferir', () => {
    const t = pedir(distribuida(ABERTA, MAOS), 0);
    expect(t.fase).toBe('jogando');
    expect(t.mao!.familias[0]).toMatchObject({ cadeira: 0, tipo: 'aberta', conferida: null });
    expect(t.placar).toEqual([0, 0]);
    expect(() => pedir(distribuida(ABERTA, MAOS), 1)).toThrow(/não é família/);
  });

  test('vários pedidos: as cartas novas saem do topo na ordem dos pedidos', () => {
    const s = distribuida(ABERTA, [['Qo', 'Jo', 'Ae'], ['3e', '5e', '6e'], ['Kp', 'Jc', 'Qe'], ['2e', '5c', '6c']]);
    const topo = ids(s.monte.slice(0, 6));
    const t = pedir(pedir(s, 2), 0);
    expect(ids(t.mao!.maos[2])).toEqual(topo.slice(0, 3));
    expect(ids(t.mao!.maos[0])).toEqual(topo.slice(3, 6));
    expect(t.mao!.familias.map((f) => f.cadeira)).toEqual([2, 0]);
  });
});

describe('quando pode', () => {
  test('sem 3 cartas no monte para repor: proibido', () => {
    const s = distribuida(MINEIRO, MAOS);
    s.monte = s.monte.slice(0, 2);
    expect(() => pedir(s, 0)).toThrow(/monte/);
  });

  test('só antes da 1ª carta, em mão normal, com família ligada (bloqueada na mão de 10 e na de ferro)', () => {
    const s = distribuida(MINEIRO, MAOS);
    expect(janelaDeFamilia(s)).toBe(true);
    expect(() => pedir(reduce(s, { tipo: 'jogar', cadeira: 0, indice: 2 }), 1)).toThrow(ErroJogada);
    expect(() => pedir(distribuida({ ...MINEIRO, familia: 'off' }, MAOS), 0)).toThrow(ErroJogada);
    const dez = distribuida(MINEIRO, MAOS, undefined, [10, 4]);
    expect(dez.fase).toBe('decisaoMao10');
    expect(() => pedir(dez, 0)).toThrow(ErroJogada);
    expect(() => pedir(reduce(dez, { tipo: 'mao10', cadeira: 0, jogar: true }), 0)).toThrow(ErroJogada);
    const ferro = distribuida({ ...MINEIRO, maoDe11: 'onzeAOnze' }, MAOS, undefined, [10, 10]);
    expect(ferro.mao!.tipo).toBe('mao11');
    expect(() => pedir(ferro, 0)).toThrow(ErroJogada);
    // Truco só a partir da 2ª rodada (a cadeira 2 vence a 1ª com o zap); depois do truco aceito, nada de família.
    const r2 = jogarPrimeiraRodada(s);
    const vez = r2.mao!.vez;
    const trucada = reduce(reduce(r2, { tipo: 'truco', cadeira: vez }), {
      tipo: 'aceitar',
      cadeira: ((vez + 1) % 4) as 0 | 1 | 2 | 3,
    });
    expect(() => pedir(trucada, vez)).toThrow(ErroJogada);
  });

  test('pontos de família podem fechar a partida', () => {
    const t = pedir(distribuida({ ...MINEIRO, maoDe10: false }, MAOS, undefined, [10, 3]), 0);
    const fim = conferir(t, 1, true);
    expect(fim.placar).toEqual([12, 3]);
    expect(fim.fase).toBe('fimPartida');
    expect(fim.vencedor).toBe(0);
    expect(fim.mao).toBeNull();
    expect(fim.ultimaMao).toMatchObject({ vencedor: 0, pontos: 2, motivo: 'familia' });
    expect(cartasDaPartida(fim)).toHaveLength(40);
  });
});

describe('família que leva o placar à mão de 10', () => {
  test('depois dos pontos a mão segue, mas sem truco e sem mais família', () => {
    // 8 a 0: família real conferida vale 2 → 10 a 0 (mão de 10 pelo placar atual).
    const t = conferir(pedir(distribuida(MINEIRO, MAOS, undefined, [8, 0]), 0), 1, true);
    expect(t.placar).toEqual([10, 0]);
    expect(t.fase).toBe('jogando');
    expect(janelaDeFamilia(t)).toBe(false);
    expect(() => pedir(t, 2)).toThrow(ErroJogada);
    expect(() => reduce(t, { tipo: 'truco', cadeira: 0 })).toThrow(ErroJogada);
    expect(acoesValidas(t, 0).some((a) => a.tipo === 'truco' || a.tipo === 'familia')).toBe(false);
    // A jogada da carta continua valendo.
    expect(reduce(t, { tipo: 'jogar', cadeira: 0, indice: 0 }).mao!.mesa).toHaveLength(1);
  });

  test('a visão também fecha a janela', () => {
    const t = conferir(pedir(distribuida(MINEIRO, MAOS, undefined, [8, 0]), 0), 1, true);
    expect(janelaDeFamilia(visaoDoJogador(t, 2))).toBe(false);
  });
});
