import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { avancarAte, criarMesa, TEMPOS } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const RAPIDO = { ...TEMPOS, jogadaMs: 50, ritualMs: 50 };

/** Partida inteira no automático (o tempo de cada humano acaba e o servidor joga por ele). */
function ateOFim(extra = {}, nomes = ['a']) {
  const t = criarMesa({ tempos: RAPIDO, humanosEsperados: nomes.length, ...extra });
  for (const n of nomes) t.mesa.sentar(n, n.toUpperCase());
  avancarAte(() => t.estado('a')?.visao?.fase === 'fimPartida', 10, 3_000_000);
  return t;
}

describe('revanche na mesma mesa', () => {
  test('sozinho com bots: pedir revanche começa outra partida do zero, com as mesmas regras', () => {
    const t = ateOFim({ modo: 'classica' });
    expect(t.estado('a')!.revanche).toEqual({ votos: [], faltam: [0] });
    const regras = t.estado('a')!.regras;
    t.mesa.revanche('a');
    const e = t.estado('a')!;
    expect(e.visao!.fase).not.toBe('fimPartida');
    expect(e.visao!.placar).toEqual([0, 0]);
    expect(e.regras).toEqual(regras);
    expect(e.revanche).toBeNull();
  });

  test('com dois humanos, só começa quando os dois pedem', () => {
    const t = ateOFim({ modo: 'privada' }, ['a', 'b']);
    t.mesa.revanche('a');
    expect(t.estado('b')!.revanche).toEqual({ votos: [0], faltam: [2] });
    expect(t.estado('b')!.visao!.fase).toBe('fimPartida');
    t.mesa.revanche('b');
    expect(t.estado('b')!.visao!.fase).not.toBe('fimPartida');
    expect(t.estado('b')!.cadeiras[2]).toMatchObject({ tipo: 'humano', nome: 'B' });
  });

  test('quem caiu não segura a revanche (vira bot); ranqueada não tem revanche', () => {
    const t = ateOFim({ modo: 'privada' }, ['a', 'b']);
    t.mesa.desconectar('b');
    expect(t.estado('a')!.revanche!.faltam).toEqual([0]);
    t.mesa.revanche('a');
    expect(t.estado('a')!.visao!.fase).not.toBe('fimPartida');
    expect(t.estado('a')!.cadeiras[2].tipo).toBe('bot');
    const r = ateOFim({ modo: 'ranqueada' });
    expect(r.estado('a')!.revanche).toBeNull();
    r.mesa.revanche('a');
    expect(r.estado('a')!.visao!.fase).toBe('fimPartida');
  });
});
