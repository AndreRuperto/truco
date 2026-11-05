import { describe, expect, test } from 'vitest';
import { distribuirSemRitual, ritualMinimo } from '../src/atalhos';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import { type EstadoPartida, novaPartida } from '../src/estado';
import { ErroJogada, reduce } from '../src/reducer';
import { cartasDaPartida, completarSorte, cortarMonte, limitesCorte, riffle, semSorte } from '../src/ritual';
import type { RegrasMesa } from '../src/regras';
import { mulberry32 } from '../src/rng';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, baralhoCom, distribuida, jogarSeq, partida } from './helpers';

const ids = (cs: readonly Carta[]) => cs.map(idCarta);
const B = novoBaralho().map(idCarta);
/** pe = 3: embaralhador 3, cortador 2 (à esquerda), parceiro do cortador 0. */
const comMonte = (regras: RegrasMesa = MINEIRO) => reduce(partida(regras), { tipo: 'monte', baralho: novoBaralho() });
const cortando = (regras: RegrasMesa = MINEIRO) => reduce(comMonte(regras), { tipo: 'passarCorte', cadeira: 3 });
const prontoPraDar = (regras: RegrasMesa = MINEIRO) => reduce(cortando(regras), { tipo: 'devolver', cadeira: 2 });
const zeros = (s: EstadoPartida) => s.monte.map(() => 0 as const);
const DUAS_RODADAS: [0 | 1 | 2 | 3, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]];

describe('monte', () => {
  test('novaPartida espera o monte; o monte começa o ritual com o pé embaralhando', () => {
    const s0 = novaPartida(MINEIRO, 3);
    expect(s0.fase).toBe('aguardandoMonte');
    expect(s0.monte).toEqual([]);
    const s = comMonte();
    expect(s.fase).toBe('embaralhando');
    expect(ids(s.monte)).toEqual(B);
    expect(s.ritual).toEqual({ embaralhador: 3, cortador: 2, embaralhadas: 0, movimentos: 0, abertas: [], dadas: null });
  });

  test('só entra uma vez e é validado contra o baralho da mesa', () => {
    expect(() => reduce(comMonte(), { tipo: 'monte', baralho: novoBaralho() })).toThrow(ErroJogada);
    expect(() => reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho().slice(1) })).toThrow(ErroJogada);
  });
});

describe('embaralhar e passar', () => {
  test('riffle com os bits do servidor, só o embaralhador, até 20 vezes', () => {
    const s = comMonte();
    const bits = s.monte.map((_, i) => (i % 2) as 0 | 1);
    const t = reduce(s, { tipo: 'embaralhar', cadeira: 3, bits });
    expect(ids(t.monte)).toEqual(ids(riffle(s.monte, bits)));
    expect(t.ritual!.embaralhadas).toBe(1);
    expect(() => reduce(s, { tipo: 'embaralhar', cadeira: 0, bits })).toThrow(ErroJogada);
    expect(() => reduce(s, { tipo: 'embaralhar', cadeira: 3 })).toThrow(/sorte/);
    expect(() => reduce(s, { tipo: 'embaralhar', cadeira: 3, bits: [0, 1] })).toThrow(ErroJogada);
    let u = s;
    for (let i = 0; i < 20; i++) u = reduce(u, { tipo: 'embaralhar', cadeira: 3, bits: zeros(u) });
    expect(() => reduce(u, { tipo: 'embaralhar', cadeira: 3, bits: zeros(u) })).toThrow(ErroJogada);
  });

  test('passar pra cortar: o monte vai para a esquerda do embaralhador', () => {
    const t = cortando();
    expect(t.fase).toBe('cortando');
    expect(() => reduce(comMonte(), { tipo: 'passarCorte', cadeira: 2 })).toThrow(ErroJogada);
    expect(() => reduce(t, { tipo: 'cortar', cadeira: 3, ponto: 20 })).toThrow(ErroJogada);
  });
});

describe('cortar', () => {
  test('ponto entre 30% e 70%; inverte as metades; cada movimento gasta 1; no 3º devolve sozinho', () => {
    const t = cortando();
    const [min, max] = limitesCorte(40);
    expect(() => reduce(t, { tipo: 'cortar', cadeira: 2, ponto: min - 1 })).toThrow(ErroJogada);
    expect(() => reduce(t, { tipo: 'cortar', cadeira: 2, ponto: max + 1 })).toThrow(ErroJogada);
    expect(() => reduce(t, { tipo: 'cortar', cadeira: 2 })).toThrow(/sorte/);
    const c1 = reduce(t, { tipo: 'cortar', cadeira: 2, ponto: 12 });
    expect(ids(c1.monte)).toEqual(ids(cortarMonte(t.monte, 12)));
    expect(c1.ritual!.movimentos).toBe(1);
    expect(c1.fase).toBe('cortando');
    const c2 = reduce(c1, { tipo: 'embaralhar', cadeira: 2, bits: zeros(c1) });
    expect(c2.ritual!.movimentos).toBe(2);
    expect(c2.ritual!.embaralhadas).toBe(0);
    const c3 = reduce(c2, { tipo: 'cortar', cadeira: 2, ponto: 20 });
    expect(c3.ritual!.movimentos).toBe(3);
    expect(c3.fase).toBe('escolhendoDistribuicao');
  });

  test('devolver antes dos 3 movimentos; só o cortador devolve', () => {
    expect(prontoPraDar().fase).toBe('escolhendoDistribuicao');
    expect(() => reduce(cortando(), { tipo: 'devolver', cadeira: 3 })).toThrow(ErroJogada);
  });
});

describe('distribuir', () => {
  test('por cima: 3 de uma vez a partir de pe + 1; a vira paulista é a próxima de cima', () => {
    const s = reduce(prontoPraDar(PAULISTA), { tipo: 'distribuir', cadeira: 3, modo: 'porCima' });
    expect(s.fase).toBe('jogando');
    expect(s.ritual).toBeNull();
    expect(s.mao!.maos.map(ids)).toEqual([B.slice(0, 3), B.slice(3, 6), B.slice(6, 9), B.slice(9, 12)]);
    expect(idCarta(s.mao!.vira!)).toBe(B[12]);
    expect(s.monte).toHaveLength(27);
    expect(s.mao!.vez).toBe(0);
    expect(s.mao!).toMatchObject({ modo: 'porCima', pulada: null, abertasNoCorte: [], familias: [], familiaPendente: null });
    expect(() => reduce(prontoPraDar(PAULISTA), { tipo: 'distribuir', cadeira: 2, modo: 'porCima' })).toThrow(ErroJogada);
  });

  test('por baixo e subindo tiram do fundo (a vira também)', () => {
    const baixo = reduce(prontoPraDar(PAULISTA), { tipo: 'distribuir', cadeira: 3, modo: 'porBaixo' });
    expect(baixo.mao!.maos.map(ids)).toEqual([
      [B[39], B[38], B[37]],
      [B[36], B[35], B[34]],
      [B[33], B[32], B[31]],
      [B[30], B[29], B[28]],
    ]);
    expect(idCarta(baixo.mao!.vira!)).toBe(B[27]);
    const sobe = reduce(prontoPraDar(PAULISTA), { tipo: 'distribuir', cadeira: 3, modo: 'subindo' });
    expect(sobe.mao!.maos.map(ids)).toEqual([
      [B[39], B[35], B[31]],
      [B[38], B[34], B[30]],
      [B[37], B[33], B[29]],
      [B[36], B[32], B[28]],
    ]);
    expect(ids(sobe.monte)).toEqual(B.slice(0, 27));
  });
});

describe('recolhimento', () => {
  test('no fim da mão as cartas voltam por cima do monte, na ordem, e o pé seguinte embaralha', () => {
    const base = baralhoCom(MAOS_DUPLA0_VENCE);
    const fim = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), DUAS_RODADAS);
    expect(fim.mao).toBeNull();
    expect(fim.placar).toEqual([2, 0]);
    expect(fim.fase).toBe('embaralhando');
    expect(fim.pe).toBe(0);
    expect(fim.ritual).toMatchObject({ embaralhador: 0, cortador: 3, embaralhadas: 0, movimentos: 0 });
    expect(ids(fim.monte)).toEqual([
      ...['4p', '3e', 'Qo', '2e', '5o', '5e', 'Jo', '5c'],
      ...['6o', '6e', 'Ko', '6c'],
      ...ids(base.slice(12)),
    ]);
  });

  test('quem correu: a rodada incompleta vem antes das mãos', () => {
    let s = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), [[0, 0]]);
    s = reduce(s, { tipo: 'truco', cadeira: 1 });
    s = reduce(s, { tipo: 'correr', cadeira: 0 });
    expect(ids(s.monte).slice(0, 12)).toEqual(['4p', '5o', '6o', '3e', '5e', '6e', 'Qo', 'Jo', 'Ko', '2e', '5c', '6c']);
    expect(cartasDaPartida(s)).toHaveLength(40);
  });
});

describe('sorte e atalhos', () => {
  test('completarSorte só usa o rand; semSorte tira; o resto passa igual', () => {
    const s = comMonte();
    const e = completarSorte({ tipo: 'embaralhar', cadeira: 3 }, s, mulberry32(1));
    expect(e.tipo === 'embaralhar' && e.bits!.length).toBe(40);
    expect(e.tipo === 'embaralhar' && e.bits!.every((b) => b === 0 || b === 1)).toBe(true);
    const k = completarSorte({ tipo: 'cortar', cadeira: 2 }, s, () => 0.999);
    expect(k).toEqual({ tipo: 'cortar', cadeira: 2, ponto: 28 });
    expect(semSorte(k)).toEqual({ tipo: 'cortar', cadeira: 2 });
    expect(semSorte(e)).toEqual({ tipo: 'embaralhar', cadeira: 3 });
    expect(completarSorte({ tipo: 'truco', cadeira: 0 }, s, Math.random)).toEqual({ tipo: 'truco', cadeira: 0 });
  });

  test('distribuirSemRitual mantém as mãos roda a roda dos testes antigos; ritualMinimo serve no meio da partida', () => {
    const s = distribuirSemRitual(partida(MINEIRO), baralhoCom(MAOS_DUPLA0_VENCE));
    expect(s.mao!.maos.map(ids)).toEqual(MAOS_DUPLA0_VENCE);
    const prox = ritualMinimo(jogarSeq(s, DUAS_RODADAS));
    expect(prox.fase).toBe('jogando');
    expect(prox.pe).toBe(0);
    expect(prox.mao!.vez).toBe(1);
    expect(() => ritualMinimo(prox)).toThrow();
  });
});
