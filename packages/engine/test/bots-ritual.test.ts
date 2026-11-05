import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import { botDificil } from '../src/bots/dificil';
import { botFacil } from '../src/bots/facil';
import { chanceDeFamilia, decidirEtapa, querFamilia } from '../src/bots/ritual';
import { baralhoDaMesa, novoBaralho } from '../src/cartas';
import { type EstadoPartida, ehFaseRitual } from '../src/estado';
import { quemDeveAgir } from '../src/vez';
import { reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import { completarSorte } from '../src/ritual';
import { mulberry32 } from '../src/rng';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, MINEIRO_LIMPA, PAULISTA, distribuida, partida } from './helpers';

/** pe = 3: embaralhador 3, cortador 2. */
const comMonte = (regras: RegrasMesa = MINEIRO) => reduce(partida(regras), { tipo: 'monte', baralho: baralhoDaMesa(regras) });
const aplicar = (s: EstadoPartida, a: Parameters<typeof completarSorte>[0], rand = mulberry32(1)) => reduce(s, completarSorte(a, s, rand));
/** Cadeira 1 com família real sem manilha (Ke não é manilha no mineiro). */
const MAOS_F = [['3e', '5e', '6e'], ['Qo', 'Jo', 'Ke'], ['4p', '7c', 'Ko'], ['2e', '5c', '6c']];

describe('bot fácil no ritual', () => {
  test('embaralha 3 vezes e passa; corta 1 vez e devolve; dá por cima', () => {
    let s = comMonte();
    for (let i = 0; i < 3; i++) {
      expect(botFacil(s, 3)).toEqual({ tipo: 'embaralhar', cadeira: 3 });
      s = aplicar(s, botFacil(s, 3)!);
    }
    expect(botFacil(s, 3)).toEqual({ tipo: 'passarCorte', cadeira: 3 });
    expect(botFacil(s, 2)).toBeNull();
    s = aplicar(s, botFacil(s, 3)!);
    expect(botFacil(s, 2)).toEqual({ tipo: 'cortar', cadeira: 2 });
    s = aplicar(s, botFacil(s, 2)!);
    expect(botFacil(s, 2)).toEqual({ tipo: 'devolver', cadeira: 2 });
    s = aplicar(s, botFacil(s, 2)!);
    expect(botFacil(s, 3)).toEqual({ tipo: 'distribuir', cadeira: 3, modo: 'porCima' });
  });
});

describe('bot fácil e família', () => {
  test('pede com família real sem manilha, mesmo fora da vez; com manilha não', () => {
    expect(botFacil(distribuida(MINEIRO, MAOS_F), 1)).toEqual({ tipo: 'familia', cadeira: 1 });
    const comManilha = [['3e', '5e', '6e'], ['Qo', 'Jo', 'Ae'], ['4p', '7c', 'Ko'], ['2e', '5c', '6c']];
    expect(botFacil(distribuida(MINEIRO, comManilha), 1)).toBeNull();
  });

  test('confere a 2ª fechada da mesma cadeira; a 1ª deixa passar', () => {
    const t = reduce(distribuida(MINEIRO, MAOS_F), { tipo: 'familia', cadeira: 1 });
    expect(botFacil(t, 0)).toEqual({ tipo: 'conferir', cadeira: 0, conferir: false });
    expect(botFacil(t, 3)).toBeNull();
    const u = reduce(t, { tipo: 'conferir', cadeira: 0, conferir: false });
    const w = reduce(u, { tipo: 'familia', cadeira: 1 });
    expect(botFacil(w, 2)).toEqual({ tipo: 'conferir', cadeira: 2, conferir: true });
  });
});

describe('desconfiança', () => {
  test('chance de família entre as cartas que não viu', () => {
    expect(chanceDeFamilia(visaoDoJogador(comMonte(MINEIRO), 0))).toBeCloseTo((16 * 15 * 14) / (40 * 39 * 38));
    expect(chanceDeFamilia(visaoDoJogador(comMonte(MINEIRO_LIMPA), 0))).toBeCloseTo((16 * 15 * 14) / (29 * 28 * 27));
  });

  test('difícil blefa família fechada com mão fraca só quando o sorteio deixa', () => {
    const fraca = distribuida(MINEIRO, [['5o', '6e', 'Jc']]);
    const v = visaoDoJogador(fraca, 0);
    expect(querFamilia(v, () => 0, 'dificil')).toBe(true);
    expect(querFamilia(v, () => 0.99, 'dificil')).toBe(false);
    expect(querFamilia(v, () => 0, 'facil')).toBe(false);
  });
});

describe('bot difícil no ritual', () => {
  test('sempre escolhe ações legais até a mão sair', () => {
    for (const regras of [PAULISTA, MINEIRO, MINEIRO_LIMPA]) {
      for (let seed = 1; seed <= 30; seed++) {
        const rand = mulberry32(seed);
        let s = comMonte(regras);
        for (let passos = 0; ehFaseRitual(s.fase); passos++) {
          if (passos > 40) throw new Error('ritual não acabou');
          const [c] = quemDeveAgir(s);
          const a = botDificil(visaoDoJogador(s, c), rand);
          expect(a).not.toBeNull();
          expect(acoesValidas(s, c)).toContainEqual(a);
          s = aplicar(s, a!, rand);
        }
        expect(s.mao).not.toBeNull();
      }
    }
  });

  test('decidirEtapa não age por quem não está com o monte', () => {
    expect(decidirEtapa(visaoDoJogador(comMonte(), 0), Math.random, 'dificil')).toBeNull();
    expect(decidirEtapa(visaoDoJogador(reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho() }), 3), () => 0.99, 'dificil')).toEqual({
      tipo: 'embaralhar',
      cadeira: 3,
    });
  });
});
