import { describe, expect, test } from 'vitest';
import { amostrarMundo } from '../src/bots/dificil';
import { baralhoDaMesa, type Carta, idCarta, novoBaralho } from '../src/cartas';
import type { Cadeira, EstadoPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { cartasDaPartida } from '../src/ritual';
import { mulberry32 } from '../src/rng';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, distribuida, partida } from './helpers';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];
const ids = (cs: readonly Carta[]) => cs.map(idCarta);
const comMonte = () => reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho() });

/** Mão com uma família fechada (cadeira 0) já na mesa — montada à mão: a ação vem na Task 5. */
function comFamiliaFechada(conferida: boolean): EstadoPartida {
  const s = distribuida(MINEIRO, [['Qo', 'Jo', 'Ae']]);
  const m = s.mao!;
  m.familias.push({ cadeira: 0, tipo: 'fechada', cartas: m.maos[0], conferida: conferida ? { por: 1, real: true } : null });
  m.maos[0] = s.monte.splice(0, 3);
  return s;
}

describe('visão do ritual', () => {
  test('ninguém vê o monte: só o tamanho; nenhuma carta aparece antes de dar', () => {
    for (const c of CADEIRAS) {
      const v = visaoDoJogador(comMonte(), c);
      expect('monte' in v).toBe(false);
      expect(v.qtdMonte).toBe(40);
      expect(v.ritual).toEqual({ embaralhador: 3, cortador: 2, embaralhadas: 0, movimentos: 0, abertas: [], dadas: null });
      expect(JSON.stringify(v)).not.toContain('"naipe"');
    }
  });

  test('dar 3: todos sabem quem recebe, ninguém vê as cartas', () => {
    const s = comMonte();
    s.fase = 'escolhendoDistribuicao';
    s.ritual!.dadas = { cadeira: 0, cartas: s.monte.splice(0, 3) };
    for (const c of CADEIRAS) {
      const v = visaoDoJogador(s, c);
      expect(v.ritual!.dadas).toBe(0);
      expect(JSON.stringify(v)).not.toContain('"naipe"');
    }
  });

  test('abrir 3: as abertas são de todos', () => {
    const s = comMonte();
    s.ritual!.abertas = s.monte.splice(0, 3);
    for (const c of CADEIRAS) expect(ids(visaoDoJogador(s, c).ritual!.abertas)).toEqual(['4o', '4e', '4c']);
  });
});

describe('visão das famílias', () => {
  test('fechada: 3 versos para os outros; o dono vê as próprias', () => {
    const s = comFamiliaFechada(false);
    expect(ids(visaoDoJogador(s, 0).mao!.familias[0].cartas!)).toEqual(['Qo', 'Jo', 'Ae']);
    for (const c of [1, 2, 3] as Cadeira[]) expect(visaoDoJogador(s, c).mao!.familias[0].cartas).toBeNull();
  });

  test('conferida (ou aberta): todos veem', () => {
    const s = comFamiliaFechada(true);
    for (const c of CADEIRAS) expect(ids(visaoDoJogador(s, c).mao!.familias[0].cartas!)).toEqual(['Qo', 'Jo', 'Ae']);
    const a = comFamiliaFechada(false);
    a.mao!.familias[0].tipo = 'aberta';
    expect(visaoDoJogador(a, 2).mao!.familias[0].cartas).not.toBeNull();
  });
});

describe('amostrarMundo com monte e famílias', () => {
  test('o mundo sorteado é coerente: mesma visão, mesmo tamanho de monte, 40 cartas sem repetir', () => {
    const s = comFamiliaFechada(false);
    const doBaralho = new Set(ids(baralhoDaMesa(MINEIRO)));
    for (let seed = 1; seed <= 20; seed++) {
      for (const c of CADEIRAS) {
        const v = visaoDoJogador(s, c);
        const mundo = amostrarMundo(v, mulberry32(seed));
        expect(visaoDoJogador(mundo, c).mao).toEqual(v.mao);
        expect(mundo.monte).toHaveLength(v.qtdMonte);
        const todas = ids(cartasDaPartida(mundo));
        expect(new Set(todas).size).toBe(40);
        expect(todas.every((id) => doBaralho.has(id))).toBe(true);
      }
    }
  });
});
