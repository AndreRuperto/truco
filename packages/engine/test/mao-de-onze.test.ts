import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import { reduce } from '../src/reducer';
import { REGRAS_RANQUEADA, tipoPeloPlacar } from '../src/regras';
import { visaoDoJogador } from '../src/visao';
import { MAOS_DUPLA0_VENCE, distribuida } from './helpers';

// Regra tradicional (pedido do André, 2026-11-14; fontes: pagat.com, Viva, Buscapé):
// - só uma dupla no limite (11 no paulista 1-3-6-9-12; 10 na escala 2-4-8-10-12): ela vê as cartas
//   do parceiro e decide jogar (a mão já vale truco) ou correr (o adversário ganha o valor inicial);
// - as duas no limite: mão de ferro (às cegas), só aí;
// - a mão especial já é trucada: pedir truco nela é falta, e o adversário leva a mão.
const PAULISTA = REGRAS_RANQUEADA.paulista;
const MINEIRO = REGRAS_RANQUEADA.mineiro;

describe('mão de 11 (paulista)', () => {
  test('só uma dupla com 11: decide jogar ou correr, vendo as cartas do parceiro', () => {
    const s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 3]);
    expect(s.mao!.tipo).toBe('mao10');
    expect(s.fase).toBe('decisaoMao10');
    expect(s.mao!.duplaNoDez).toBe(0);
    // Cadeira 0 vê a mão do parceiro (2); a dupla adversária não vê nada a mais.
    expect(visaoDoJogador(s, 0).mao!.maoParceiro).toHaveLength(3);
    expect(visaoDoJogador(s, 1).mao!.maoParceiro ?? null).toBeNull();
  });

  test('correr dá 1 ponto ao adversário; jogar vale 3', () => {
    const correu = reduce(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 3]), { tipo: 'mao10', cadeira: 0, jogar: false });
    expect(correu.placar).toEqual([11, 4]);
    const jogou = reduce(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 3]), { tipo: 'mao10', cadeira: 0, jogar: true });
    expect(jogou.mao!.nivel).toBe(1);
    expect(jogou.fase).toBe('jogando');
  });

  test('11 a 11: mão de ferro, às cegas', () => {
    const s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 11]);
    expect(s.mao!.tipo).toBe('mao11');
    expect(visaoDoJogador(s, 0).mao!.minhaMao).toEqual([null, null, null]);
  });

  test('com 10 no paulista a mão é normal', () => {
    expect(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [10, 3]).mao!.tipo).toBe('normal');
  });

  test('pedir truco na mão de 11 é falta: o adversário leva a mão (3)', () => {
    const s = reduce(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 3]), { tipo: 'mao10', cadeira: 0, jogar: true });
    const vez = s.mao!.vez;
    expect(acoesValidas(s, vez).map((a) => a.tipo)).toContain('truco');
    const falta = reduce(s, { tipo: 'truco', cadeira: vez });
    const adversaria = 1 - (vez % 2);
    expect(falta.ultimaMao).toMatchObject({ vencedor: adversaria, pontos: 3, motivo: 'trucoNaMaoEspecial' });
  });

  test('pedir truco na mão de ferro também é falta', () => {
    const s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 11]);
    const vez = s.mao!.vez;
    const falta = reduce(s, { tipo: 'truco', cadeira: vez });
    expect(falta.ultimaMao).toMatchObject({ vencedor: 1 - (vez % 2), motivo: 'trucoNaMaoEspecial' });
    expect(falta.fase).toBe('fimPartida');
  });
});

describe('mão de 10 (escala 2-4-8-10-12)', () => {
  test('só uma dupla com 10 decide; 10 a 10 é mão de ferro', () => {
    expect(distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 4]).fase).toBe('decisaoMao10');
    expect(distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 10]).mao!.tipo).toBe('mao11');
  });

  test('pedir truco na mão de 10 é falta: o adversário leva 4', () => {
    const s = reduce(distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 4]), { tipo: 'mao10', cadeira: 0, jogar: true });
    const vez = s.mao!.vez;
    const falta = reduce(s, { tipo: 'truco', cadeira: vez });
    expect(falta.ultimaMao).toMatchObject({ vencedor: 1 - (vez % 2), pontos: 4, motivo: 'trucoNaMaoEspecial' });
  });
});

describe('tipoPeloPlacar', () => {
  test('limite pela escala de pontos', () => {
    expect(tipoPeloPlacar([11, 0], PAULISTA)).toBe('mao10');
    expect(tipoPeloPlacar([0, 11], PAULISTA)).toBe('mao10');
    expect(tipoPeloPlacar([11, 11], PAULISTA)).toBe('mao11');
    expect(tipoPeloPlacar([10, 0], PAULISTA)).toBe('normal');
    expect(tipoPeloPlacar([10, 0], MINEIRO)).toBe('mao10');
    expect(tipoPeloPlacar([10, 10], MINEIRO)).toBe('mao11');
    // Desligadas na mesa: tudo normal.
    expect(tipoPeloPlacar([11, 0], { ...PAULISTA, maoDe10: false })).toBe('normal');
    expect(tipoPeloPlacar([11, 11], { ...PAULISTA, maoDe11: 'off' })).toBe('normal');
  });
});

describe('bots na mão especial', () => {
  test('o bot difícil nunca pede truco nela (seria falta), nem no blefe', async () => {
    const { botDificil } = await import('../src/bots/dificil');
    const s = reduce(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 3]), { tipo: 'mao10', cadeira: 0, jogar: true });
    const vez = s.mao!.vez;
    for (let i = 0; i < 20; i++) {
      const a = botDificil(visaoDoJogador(s, vez), () => (i + 0.5) / 20, { amostras: 4, chanceBlefe: 1 });
      expect(a?.tipo).not.toBe('truco');
    }
  });
});
