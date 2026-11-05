import {
  type Cadeira,
  type Carta,
  type EstadoPartida,
  type Naipe,
  novaPartida,
  novoBaralho,
  reduce,
  REGRAS_RANQUEADA,
  type Valor,
} from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { cartaDoSinal, falaDaRodada, rodadaFechada, sinalDaMao } from '../src/mesa/social';

const N: Record<string, Naipe> = { o: 'ouros', e: 'espadas', c: 'copas', p: 'paus' };
const c = (s: string): Carta => ({ valor: s.slice(0, -1) as Valor, naipe: N[s.slice(-1)] });
const cs = (...xs: string[]) => xs.map(c);

describe('sinalDaMao', () => {
  test('mineiro: sinaliza a melhor manilha', () => {
    expect(sinalDaMao(cs('4p', '5o', '6o'), 'mineiro', null)).toBe('zap');
    expect(sinalDaMao(cs('7o', 'Ae', '5c'), 'mineiro', null)).toBe('espadilha');
    expect(sinalDaMao(cs('7c', '3e'), 'mineiro', null)).toBe('copas');
    expect(sinalDaMao(cs('7o', '3e'), 'mineiro', null)).toBe('picafumo');
  });

  test('sem manilha: 3, depois 2, depois Ás, senão nada', () => {
    expect(sinalDaMao(cs('3e', '5e', '6e'), 'mineiro', null)).toBe('tres');
    expect(sinalDaMao(cs('2e', 'Ac', '5c'), 'mineiro', null)).toBe('dois');
    expect(sinalDaMao(cs('Ac', '5c', '6o'), 'mineiro', null)).toBe('as');
    expect(sinalDaMao(cs('Qo', 'Jo', 'Ko'), 'mineiro', null)).toBe('nada');
  });

  test('mão limpa: coringa sem manilha sinaliza "coringa"; manilha vem antes', () => {
    expect(sinalDaMao(cs('Cc', 'Cp', 'Qo'), 'mineiro', null)).toBe('coringa');
    expect(sinalDaMao(cs('Cc', '3e', 'Ko'), 'mineiro', null)).toBe('coringa');
    expect(sinalDaMao(cs('2e', 'Ae', 'Cp'), 'mineiro', null)).toBe('espadilha');
    expect(sinalDaMao(cs('Cp', '7o', '3e'), 'mineiro', null)).toBe('picafumo');
  });

  test('paulista: a manilha depende da vira', () => {
    expect(sinalDaMao(cs('6c', '3e', '4o'), 'paulista', c('5p'))).toBe('copas');
    expect(sinalDaMao(cs('6o', '5e'), 'paulista', c('5p'))).toBe('picafumo');
    // vira 2 → manilha 3: o 3♦ é manilha (pica-fumo), não "tres"
    expect(sinalDaMao(cs('3o', '2e'), 'paulista', c('2c'))).toBe('picafumo');
  });
});

describe('cartaDoSinal', () => {
  test('sinais de manilha viram carta; os outros, null', () => {
    expect(cartaDoSinal('zap', 'mineiro', null)).toEqual(c('4p'));
    expect(cartaDoSinal('espadilha', 'paulista', c('5p'))).toEqual(c('6e'));
    expect(cartaDoSinal('tres', 'mineiro', null)).toBeNull();
    expect(cartaDoSinal('nada', 'paulista', c('5p'))).toBeNull();
    expect(cartaDoSinal('zap', 'paulista', null)).toBeNull();
  });

  test('coringa não é dica de manilha', () => {
    expect(cartaDoSinal('coringa', 'mineiro', null)).toBeNull();
  });
});

describe('falaDaRodada', () => {
  test('quem ganhou comemora, quem perdeu lamenta, empate fica quieto', () => {
    expect(falaDaRodada(0, 2, 0.1)).toBe('boa');
    expect(falaDaRodada(0, 0, 0.9)).toBe('bora');
    expect(falaDaRodada(0, 1, 0.1)).toBe('vixe');
    expect(falaDaRodada('empate', 1, 0.1)).toBeNull();
  });
});

describe('rodadaFechada', () => {
  // novoBaralho() com pe = 3: cadeira 0 = 4o 5o 6o, 1 = 4e 5e 6e, 2 = 4c 5c 6c, 3 = 4p 5p 6p (4p = zap no mineiro)
  const inicio = reduce(novaPartida(REGRAS_RANQUEADA.mineiro, 3), { tipo: 'distribuir', baralho: novoBaralho() });
  const jogar = (s: EstadoPartida, cadeira: Cadeira) => reduce(s, { tipo: 'jogar', cadeira, indice: 0 });

  test('só há resultado quando a 4ª carta fecha a rodada', () => {
    const s1 = jogar(inicio, 0);
    const s2 = jogar(s1, 1);
    const s3 = jogar(s2, 2);
    const s4 = jogar(s3, 3);
    expect(rodadaFechada(inicio, s1)).toBeNull();
    expect(rodadaFechada(s2, s3)).toBeNull();
    expect(rodadaFechada(s3, s4)).toBe(1);
  });

  test('a rodada que encerra a mão também conta', () => {
    let s = inicio;
    for (const cad of [0, 1, 2, 3] as Cadeira[]) s = jogar(s, cad);
    // 2ª rodada: a 3 começa (ganhou a 1ª); todos jogam 5 → cangou → dupla 1 leva a mão
    for (const cad of [3, 0, 1] as Cadeira[]) s = jogar(s, cad);
    const fim = jogar(s, 2);
    expect(fim.mao).toBeNull();
    expect(rodadaFechada(s, fim)).toBe('empate');
  });
});
