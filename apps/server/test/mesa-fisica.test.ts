import { describe, expect, test } from 'vitest';
import {
  aplicarBatida,
  CHANCE_BATIDA_BOT,
  decidirBatidaBot,
  FORCA_MINIMA_RACHADURA,
  forcaDaBatida,
  LIMITE_DANO,
  MAX_RACHADURAS,
  mesaFisicaInicial,
  pedidoQueBate,
} from '../src/mesa/mesaFisica';

const fixo = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('mesa física', () => {
  test('começa de madeira, sem rachaduras nem dano', () => {
    expect(mesaFisicaInicial()).toEqual({ tipo: 'madeira', rachaduras: [], dano: 0 });
  });

  test('forcaDaBatida clampa 0..1 e recusa o que não é número finito', () => {
    expect(forcaDaBatida(0.5)).toBe(0.5);
    expect(forcaDaBatida(7)).toBe(1);
    expect(forcaDaBatida(-2)).toBe(0);
    expect(forcaDaBatida(Number.NaN)).toBeNull();
    expect(forcaDaBatida(Infinity)).toBeNull();
    expect(forcaDaBatida('1')).toBeNull();
    expect(forcaDaBatida(undefined)).toBeNull();
  });

  test('pedidoQueBate: só truco/aumentar que deixam proposto ≥ 2 (seis, nove, doze)', () => {
    const comProposto = (p: number) => ({ mao: { trucoPendente: { dupla: 0, proposto: p } } }) as never;
    expect(pedidoQueBate({ tipo: 'truco', cadeira: 0 }, comProposto(1))).toBe(false);
    expect(pedidoQueBate({ tipo: 'truco', cadeira: 0 }, comProposto(2))).toBe(true);
    expect(pedidoQueBate({ tipo: 'aumentar', cadeira: 1 }, comProposto(3))).toBe(true);
    expect(pedidoQueBate({ tipo: 'aumentar', cadeira: 1 }, comProposto(4))).toBe(true);
    expect(pedidoQueBate({ tipo: 'aceitar', cadeira: 1 }, comProposto(3))).toBe(false);
    expect(pedidoQueBate({ tipo: 'truco', cadeira: 0 }, { mao: null } as never)).toBe(false);
  });

  test('força < 0,3 é só barulho: sem rachadura e sem mudar o estado', () => {
    const f = mesaFisicaInicial();
    const r = aplicarBatida(f, 0, FORCA_MINIMA_RACHADURA - 0.01, fixo(0.5));
    expect(r.rachadura).toBeUndefined();
    expect(r.quebrou).toBe(false);
    expect(r.fisica).toEqual(f);
  });

  test('força ≥ 0,3 cria rachadura perto da borda de quem bateu, maior quanto mais forte', () => {
    const fraca = aplicarBatida(mesaFisicaInicial(), 0, 0.4, fixo(0.5)).rachadura!;
    const forte = aplicarBatida(mesaFisicaInicial(), 0, 1, fixo(0.5)).rachadura!;
    expect(forte.tamanho).toBeGreaterThan(fraca.tamanho);
    // cadeira 0 fica embaixo no referencial absoluto da mesa
    expect(fraca.cadeira).toBe(0);
    expect(fraca.y).toBeGreaterThan(0.75);
    expect(fraca.x).toBeGreaterThan(0.1);
    expect(fraca.x).toBeLessThan(0.9);
    expect(Number.isInteger(fraca.semente)).toBe(true);
    // 1 à direita, 2 em cima, 3 à esquerda
    expect(aplicarBatida(mesaFisicaInicial(), 1, 0.5, fixo(0.5)).rachadura!.x).toBeGreaterThan(0.75);
    expect(aplicarBatida(mesaFisicaInicial(), 2, 0.5, fixo(0.5)).rachadura!.y).toBeLessThan(0.25);
    expect(aplicarBatida(mesaFisicaInicial(), 3, 0.5, fixo(0.5)).rachadura!.x).toBeLessThan(0.25);
  });

  test('a semente vem do rand injetado; ids crescem', () => {
    const a = aplicarBatida(mesaFisicaInicial(), 0, 0.8, fixo(0.25));
    const b = aplicarBatida(a.fisica, 2, 0.8, fixo(0.75));
    expect(a.rachadura!.semente).not.toBe(b.rachadura!.semente);
    expect(b.rachadura!.id).toBeGreaterThan(a.rachadura!.id);
    expect(b.fisica.rachaduras.map((r) => r.id)).toEqual([a.rachadura!.id, b.rachadura!.id]);
  });

  test('dano soma força²; no limite a madeira quebra e vira plástico zerado', () => {
    let f = mesaFisicaInicial();
    const r1 = aplicarBatida(f, 0, 1, fixo(0.5));
    expect(r1.fisica.dano).toBeCloseTo(1);
    f = aplicarBatida(r1.fisica, 1, 0.9, fixo(0.5)).fisica;
    expect(f.dano).toBeCloseTo(1.81);
    expect(f.tipo).toBe('madeira');
    const r3 = aplicarBatida(f, 0, 1, fixo(0.5));
    expect(f.dano + 1).toBeGreaterThanOrEqual(LIMITE_DANO);
    expect(r3.quebrou).toBe(true);
    expect(r3.rachadura).toBeDefined();
    expect(r3.fisica).toEqual({ tipo: 'plastico', rachaduras: [], dano: 0 });
  });

  test('plástico não quebra: batidas fortes deixam marcas (limitadas) e o tipo fica', () => {
    let f = { tipo: 'plastico' as const, rachaduras: [], dano: 0 };
    for (let i = 0; i < MAX_RACHADURAS + 5; i++) {
      const r = aplicarBatida(f, (i % 4) as 0, 1, fixo(0.3, 0.6, 0.9));
      expect(r.quebrou).toBe(false);
      f = r.fisica as typeof f;
    }
    expect(f.tipo).toBe('plastico');
    expect(f.rachaduras).toHaveLength(MAX_RACHADURAS);
  });

  test('bot bate com a chance dada e força 0,4–1', () => {
    expect(CHANCE_BATIDA_BOT).toBeCloseTo(0.35);
    expect(decidirBatidaBot(fixo(0.9))).toBeNull();
    expect(decidirBatidaBot(fixo(0.1, 0))).toBeCloseTo(0.4);
    expect(decidirBatidaBot(fixo(0.1, 0.999))).toBeCloseTo(0.9994);
    expect(decidirBatidaBot(fixo(0.5, 0.5), 0.6)).toBeCloseTo(0.7);
  });
});
