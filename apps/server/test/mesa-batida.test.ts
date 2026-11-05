import { type AcaoJogador, botFacil, type Cadeira, type EstadoPartida, quemDeveAgir } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { OpcoesMesa } from '../src/mesa/Mesa';
import { JANELA_BATIDA_MS } from '../src/mesa/mesaFisica';
import { avancarAte, criarMesa, TEMPOS } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Bots sempre sobem a aposta quando podem (para chegar em seis/nove), senão aceitam. */
function botQueSobe(s: EstadoPartida, c: Cadeira): AcaoJogador | null {
  if (s.fase === 'respondendoTruco' && quemDeveAgir(s).includes(c)) {
    const nivel = s.mao?.trucoPendente?.proposto ?? 0;
    return nivel < 4 ? { tipo: 'aumentar', cadeira: c } : { tipo: 'aceitar', cadeira: c };
  }
  return botFacil(s, c);
}

function mesaNaVez(extra: Partial<OpcoesMesa> = {}) {
  const t = criarMesa({ decidirBot: botQueSobe, chanceBatidaBot: 0, tempos: { ...TEMPOS, jogadaMs: 60_000 }, ...extra });
  t.mesa.sentar('a', 'Ana');
  avancarAte(() => !!t.estado('a')?.minhasAcoes.some((x) => x.tipo === 'truco'));
  return t;
}

/** Ana pede truco, o bot responde seis e Ana pede nove (nível 3). */
function anaPedeNove(extra: Partial<OpcoesMesa> = {}) {
  const t = mesaNaVez(extra);
  t.mesa.acao('a', { tipo: 'truco' });
  avancarAte(() => !!t.estado('a')?.minhasAcoes.some((x) => x.tipo === 'aumentar'));
  t.mesa.acao('a', { tipo: 'aumentar' });
  expect(t.estado('a')!.visao!.mao!.trucoPendente?.proposto).toBe(3);
  return t;
}

describe('bater na mesa', () => {
  test('MsgEstado traz a mesa física (madeira inteira no começo)', () => {
    const { estado } = mesaNaVez();
    expect(estado('a')!.mesaFisica).toEqual({ tipo: 'madeira', rachaduras: [], dano: 0 });
  });

  test('sem pedido recente a batida é ignorada', () => {
    const { mesa, de } = mesaNaVez();
    mesa.batida('a', 1);
    expect(de('a', 'batida')).toHaveLength(0);
  });

  test('truco (nível 1) não bate', () => {
    const { mesa, de } = mesaNaVez();
    mesa.acao('a', { tipo: 'truco' });
    mesa.batida('a', 1);
    expect(de('a', 'batida')).toHaveLength(0);
  });

  test('depois de pedir nove: aceita, difunde e racha a madeira; o estado guarda a rachadura', () => {
    const { mesa, de, estado } = anaPedeNove();
    mesa.batida('a', 0.8);
    const [b] = de('a', 'batida');
    expect(b).toMatchObject({ de: 0, forca: 0.8 });
    expect(b.rachadura).toMatchObject({ cadeira: 0 });
    expect(b.quebrou).toBeFalsy();
    const f = estado('a')!.mesaFisica!;
    expect(f.rachaduras).toEqual([b.rachadura]);
    expect(f.dano).toBeCloseTo(0.64);
  });

  test('batida fraca é só barulho', () => {
    const { mesa, de, estado } = anaPedeNove();
    mesa.batida('a', 0.2);
    expect(de('a', 'batida')).toEqual([{ de: 0, forca: 0.2 }]);
    expect(estado('a')!.mesaFisica!.rachaduras).toHaveLength(0);
  });

  test('uma batida por pedido', () => {
    const { mesa, de } = anaPedeNove();
    mesa.batida('a', 0.5);
    vi.advanceTimersByTime(TEMPOS.intervaloMensagemMs + 1);
    mesa.batida('a', 0.5);
    expect(de('a', 'batida')).toHaveLength(1);
  });

  test('fora da janela de ~3 s não vale', () => {
    const { mesa, de } = anaPedeNove();
    vi.advanceTimersByTime(JANELA_BATIDA_MS + 1);
    mesa.batida('a', 0.5);
    expect(de('a', 'batida')).toHaveLength(0);
  });

  test('força acima de 1 é clampada; não numérica é recusada (e não gasta a batida)', () => {
    const { mesa, de } = anaPedeNove();
    mesa.batida('a', 'forte');
    mesa.batida('a', Number.NaN);
    expect(de('a', 'batida')).toHaveLength(0);
    mesa.batida('a', 5);
    expect(de('a', 'batida')[0]).toMatchObject({ de: 0, forca: 1 });
  });

  test('quem não fez o pedido não bate', () => {
    const t = criarMesa({ decidirBot: botQueSobe, chanceBatidaBot: 0, humanosEsperados: 2, tempos: { ...TEMPOS, jogadaMs: 60_000 } });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    expect(t.mesa.cadeiraDe('b')).toBe(2);
    avancarAte(() => !!t.estado('a')?.minhasAcoes.some((x) => x.tipo === 'truco'));
    t.mesa.acao('a', { tipo: 'truco' });
    avancarAte(() => !!t.estado('a')?.minhasAcoes.some((x) => x.tipo === 'aumentar'));
    t.mesa.acao('a', { tipo: 'aumentar' });
    t.mesa.batida('b', 1);
    expect(t.de('a', 'batida')).toHaveLength(0);
    t.mesa.batida('a', 1);
    expect(t.de('b', 'batida')).toHaveLength(1);
  });

  test('bot que pede seis bate (chance injetada) com força 0,4–1', () => {
    const { mesa, de } = mesaNaVez({ chanceBatidaBot: 1 });
    mesa.acao('a', { tipo: 'truco' });
    avancarAte(() => de('a', 'batida').length > 0);
    const [b] = de('a', 'batida');
    expect([1, 3]).toContain(b.de);
    expect(b.forca).toBeGreaterThanOrEqual(0.4);
    expect(b.forca).toBeLessThanOrEqual(1);
  });

  test('com chance 0 o bot não bate', () => {
    const { mesa, de, estado } = mesaNaVez({ chanceBatidaBot: 0 });
    mesa.acao('a', { tipo: 'truco' });
    avancarAte(() => !!estado('a')?.minhasAcoes.some((x) => x.tipo === 'aumentar'));
    expect(de('a', 'batida')).toHaveLength(0);
  });
});
