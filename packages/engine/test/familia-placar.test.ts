/**
 * Item 4 da auditoria de regras (docs/AUDITORIA-REGRAS.md): pontos de família no meio da mão.
 * A família conferida vale o valor base da escada (1 no 1-3-6-9-12, 2 no 2-4-8-10-12) e entra no
 * placar na hora, antes da 1ª carta. O tipo da mão (normal, de 10, de ferro) é o do início: os
 * pontos não transformam a mão corrente; só fecham a janela de truco e de família quando o placar
 * novo pediria uma mão especial.
 */
import { describe, expect, test } from 'vitest';
import type { Cadeira, EstadoPartida } from '../src/estado';
import { janelaDeFamilia } from '../src/familia';
import { ErroJogada, reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import { cartasDaPartida } from '../src/ritual';
import { MINEIRO, PAULISTA, distribuida, jogarAteOFimDaMao, jogarPrimeiraRodada } from './helpers';

/** pe = 3, a cadeira 0 começa e tem família real; a cadeira 1 tem cartas baixas (blefe na fechada). */
const MAOS = [
  ['Qo', 'Jo', 'Ae'],
  ['3e', '5e', '6e'],
  ['4p', '7c', 'Ko'],
  ['2e', '5c', '6c'],
];
const PAULISTA_FAMILIA: RegrasMesa = { ...PAULISTA, familia: 'fechada' };

const pedir = (s: EstadoPartida, cadeira: Cadeira) => reduce(s, { tipo: 'familia', cadeira });
const conferir = (s: EstadoPartida, cadeira: Cadeira, sim: boolean) => reduce(s, { tipo: 'conferir', cadeira, conferir: sim });
/** Cadeira 0 pede (família real) e a cadeira 1 confere: a dupla 0 ganha o valor base. */
const familiaRealDaDupla0 = (s: EstadoPartida) => conferir(pedir(s, 0), 1, true);
/** Cadeira 1 pede blefando e a cadeira 0 confere: a dupla 0 ganha o valor base. */
const blefeDaDupla1Conferido = (s: EstadoPartida) => conferir(pedir(s, 1), 0, true);

describe('família conferida com placar 9', () => {
  test('paulista: 9 → 10, a mão segue normal e a janela continua aberta (sem mão de 10 nesta mesa)', () => {
    const t = familiaRealDaDupla0(distribuida(PAULISTA_FAMILIA, MAOS, undefined, [9, 0]));
    expect(t.placar).toEqual([10, 0]);
    expect(t.fase).toBe('jogando');
    expect(t.mao!.tipo).toBe('normal');
    expect(janelaDeFamilia(t)).toBe(true);
  });

  test('mineiro: 9 → 11, sem mão de ferro nesta mesa a mão segue normal e a janela continua aberta', () => {
    const t = familiaRealDaDupla0(distribuida(MINEIRO, MAOS, undefined, [9, 0]));
    expect(t.placar).toEqual([11, 0]);
    expect(t.fase).toBe('jogando');
    expect(t.mao!.tipo).toBe('normal');
    expect(janelaDeFamilia(t)).toBe(true);
  });

  test('mineiro com mão de ferro: 9 → 11 fecha truco e família, mas a mão corrente não vira de ferro', () => {
    const regras: RegrasMesa = { ...MINEIRO, maoDe11: 'qualquerDupla' };
    const t = familiaRealDaDupla0(distribuida(regras, MAOS, undefined, [9, 0]));
    expect(t.placar).toEqual([11, 0]);
    expect(t.mao!.tipo).toBe('normal');
    expect(t.mao!.nivel).toBe(0);
    expect(janelaDeFamilia(t)).toBe(false);
    expect(() => pedir(t, 2)).toThrow(ErroJogada);
    const r2 = jogarPrimeiraRodada(t);
    if (r2.mao) expect(() => reduce(r2, { tipo: 'truco', cadeira: r2.mao!.vez })).toThrow(/não se truca/);
  });
});

describe('família conferida com placar 10', () => {
  test('paulista: 10 → 11 no meio da mão não vira mão de ferro; a mão vale 1 até o fim', () => {
    const t = familiaRealDaDupla0(distribuida(PAULISTA_FAMILIA, MAOS, '5p', [10, 0]));
    expect(t.placar).toEqual([11, 0]);
    expect(t.fase).toBe('jogando');
    expect(t.mao!.tipo).toBe('normal');
    expect(t.mao!.nivel).toBe(0);
    expect(janelaDeFamilia(t)).toBe(false);

    const fim = jogarAteOFimDaMao(t);
    const u = fim.ultimaMao!;
    expect(u.motivo).toBe('rodadas');
    expect(u.pontos).toBe(u.vencedor === null ? 0 : 1);
  });

  test('mineiro com mão de 10: a mão começa na decisão e família não sai', () => {
    const s = distribuida(MINEIRO, MAOS, undefined, [10, 0]);
    expect(s.fase).toBe('decisaoMao10');
    expect(() => pedir(s, 0)).toThrow(ErroJogada);
  });
});

describe('família conferida com placar 11', () => {
  test('paulista com mão de ferro para qualquer dupla: a mão já é de ferro e família não sai', () => {
    const s = distribuida(PAULISTA_FAMILIA, MAOS, '5p', [11, 0]);
    expect(s.mao!.tipo).toBe('mao11');
    expect(() => pedir(s, 0)).toThrow(ErroJogada);
  });

  test('paulista só 11 a 11: com 11 a 4 a mão é normal e a família leva a 12, encerrando a partida', () => {
    const regras: RegrasMesa = { ...PAULISTA_FAMILIA, maoDe11: 'onzeAOnze' };
    const fim = familiaRealDaDupla0(distribuida(regras, MAOS, '5p', [11, 4]));
    expect(fim.placar).toEqual([12, 4]);
    expect(fim.fase).toBe('fimPartida');
    expect(fim.vencedor).toBe(0);
    expect(fim.ultimaMao).toMatchObject({ vencedor: 0, pontos: 1, motivo: 'familia' });
    expect(cartasDaPartida(fim)).toHaveLength(40);
  });

  test('mineiro sem mão de ferro: 11 + 2 = 13 encerra a partida na hora', () => {
    const fim = familiaRealDaDupla0(distribuida(MINEIRO, MAOS, undefined, [11, 5]));
    expect(fim.placar).toEqual([13, 5]);
    expect(fim.fase).toBe('fimPartida');
    expect(fim.vencedor).toBe(0);
    expect(fim.mao).toBeNull();
  });

  test('o blefe conferido dá os pontos a quem conferiu, e isso também pode encerrar', () => {
    const fim = blefeDaDupla1Conferido(distribuida(MINEIRO, MAOS, undefined, [11, 0]));
    expect(fim.placar).toEqual([13, 0]);
    expect(fim.vencedor).toBe(0);
    expect(fim.ultimaMao).toMatchObject({ vencedor: 0, pontos: 2, motivo: 'familia' });
  });
});

describe('duas famílias na mesma mão', () => {
  test('os pontos somam: família real e blefe conferido, ambos para a dupla 0', () => {
    let s = familiaRealDaDupla0(distribuida(MINEIRO, MAOS));
    expect(s.placar).toEqual([2, 0]);
    s = blefeDaDupla1Conferido(s);
    expect(s.placar).toEqual([4, 0]);
    expect(s.mao!.familias.map((f) => f.conferida)).toEqual([
      { por: 1, real: true },
      { por: 0, real: false },
    ]);
    expect(s.fase).toBe('jogando');
    expect(cartasDaPartida(s)).toHaveLength(40);
  });

  test('8 → 10 → 12: a segunda família encerra a partida na hora', () => {
    const regras: RegrasMesa = { ...MINEIRO, maoDe10: false };
    const s = familiaRealDaDupla0(distribuida(regras, MAOS, undefined, [8, 0]));
    expect(s.placar).toEqual([10, 0]);
    expect(janelaDeFamilia(s)).toBe(true);
    const fim = blefeDaDupla1Conferido(s);
    expect(fim.placar).toEqual([12, 0]);
    expect(fim.fase).toBe('fimPartida');
    expect(fim.ultimaMao).toMatchObject({ vencedor: 0, pontos: 2, motivo: 'familia' });
  });
});
