import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, avancarAte, criarMesa, vezDeJogar } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Pausa (pedido do André, 2026-11-14): sozinho contra bots, quem joga pausa; em mesa privada com
// mais gente, só o admin. Na ranqueada ninguém pausa. A pausa tem limite e volta sozinha.
describe('pausar a mesa', () => {
  test('sozinho contra bots: pausa congela tudo (prazo, bots, ações) e continuar retoma', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => vezDeJogar(t));
    expect(t.estado('a')!.podePausar).toBe(true);

    t.mesa.pausar('a');
    const e = t.estado('a')!;
    expect(e.pausa).toEqual({ por: 0, ate: expect.any(Number) });
    expect(e.prazo).toBeNull();
    const partida = t.mesa.partida;
    // Bem mais que o prazo de jogar: ninguém joga, nem por tempo estourado.
    vi.advanceTimersByTime(60_000);
    expect(t.mesa.partida).toBe(partida);

    // Ação durante a pausa é recusada.
    const erros = t.de('a', 'erro').length;
    t.mesa.acao('a', { tipo: 'jogar', cadeira: 0, indice: 0 });
    expect(t.mesa.partida).toBe(partida);
    expect(t.de('a', 'erro').at(erros)?.mensagem).toMatch(/pausada/);

    t.mesa.retomar('a');
    const depois = t.estado('a')!;
    expect(depois.pausa).toBeNull();
    expect(depois.prazo?.cadeiras).toContain(0);
    // A partida segue: o tempo volta a correr.
    vi.advanceTimersByTime(depois.prazo!.ate - Date.now());
    expect(t.mesa.partida).not.toBe(partida);
  });

  test('a pausa volta sozinha no limite', () => {
    const t = criarMesa({ tempos: { ...TEMPOS, pausaMaxMs: 5_000 } });
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => vezDeJogar(t));
    t.mesa.pausar('a');
    expect(t.estado('a')!.pausa!.ate - Date.now()).toBe(5_000);
    vi.advanceTimersByTime(4_999);
    expect(t.estado('a')!.pausa).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(t.estado('a')!.pausa).toBeNull();
  });

  test('mesa com dois humanos (não privada): ninguém pausa', () => {
    const t = criarMesa({ humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    avancarAte(() => !!t.estado('a')?.visao);
    expect(t.estado('a')!.podePausar).toBe(false);
    t.mesa.pausar('a');
    expect(t.estado('a')!.pausa ?? null).toBeNull();
  });

  test('mesa privada: só o admin pausa e retoma; se ele sai, a mesa volta', () => {
    const t = criarMesa({ humanosEsperados: 2, modo: 'privada' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    t.mesa.definirAdmin('b');
    avancarAte(() => !!t.estado('a')?.visao);
    expect(t.estado('a')!.podePausar).toBe(false);
    expect(t.estado('b')!.podePausar).toBe(true);

    t.mesa.pausar('a');
    expect(t.estado('a')!.pausa ?? null).toBeNull();
    t.mesa.pausar('b');
    expect(t.estado('a')!.pausa).toEqual({ por: t.mesa.cadeiraDe('b'), ate: expect.any(Number) });
    // Quem não pode pausar também não retoma.
    t.mesa.retomar('a');
    expect(t.estado('a')!.pausa).not.toBeNull();
    t.mesa.sair('b');
    expect(t.estado('a')!.pausa).toBeNull();
  });

  test('ranqueada: ninguém pausa, nem admin', () => {
    const t = criarMesa({ modo: 'ranqueada' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.definirAdmin('a');
    avancarAte(() => vezDeJogar(t));
    expect(t.estado('a')!.podePausar).toBe(false);
    t.mesa.pausar('a');
    expect(t.estado('a')!.pausa ?? null).toBeNull();
  });

  test('janela de família: o prazo dela anda o tempo da pausa', () => {
    const t = criarMesa({ regras: { variante: 'mineiro', pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'off', familia: 'fechada', maoLimpa: false }, tempos: { ...TEMPOS, janelaFamiliaMs: 5_000 } });
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => !!t.estado('a')?.janelaFamilia);
    const ate = t.estado('a')!.janelaFamilia!.ate;
    t.mesa.pausar('a');
    vi.advanceTimersByTime(30_000);
    t.mesa.retomar('a');
    const e = t.estado('a')!;
    expect(e.janelaFamilia?.ate).toBe(ate + 30_000);
  });
});
