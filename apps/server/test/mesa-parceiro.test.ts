import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const JOGADA = 20_000;

/** a=0 e c=1 humanos; cadeiras 2 (parceiro de a) e 3 são bots. */
function mesaComParceiroBot() {
  const t = criarMesa({ humanosEsperados: 4, tempos: { ...TEMPOS, jogadaMs: JOGADA } });
  t.mesa.sentar('a', 'Ana');
  t.mesa.sentar('b', 'Bia');
  t.mesa.sentar('c', 'Cid');
  t.mesa.iniciar('a');
  t.mesa.sair('b');
  expect(t.estado('a')!.cadeiras.map((x) => x.tipo)).toEqual(['humano', 'humano', 'bot', 'bot']);
  return t;
}

/** Espera a vez de `c` e pede truco contra a dupla de `a`. */
function cTruca() {
  const t = mesaComParceiroBot();
  avancarAte(() => t.mesa.partida?.fase === 'jogando' && t.mesa.partida.mao!.vez === 1);
  t.mesa.acao('c', { tipo: 'truco' });
  expect(t.mesa.partida!.fase).toBe('respondendoTruco');
  expect(t.estado('a')!.prazo!.cadeiras).toEqual([0]);
  return { ...t, antes: t.de('a', 'acao').length };
}

describe('parceiro bot não responde pelo humano', () => {
  test('truco: o bot espera; a resposta do humano vale', () => {
    const t = cTruca();
    vi.advanceTimersByTime(TEMPOS.botMs * 10);
    expect(t.mesa.partida!.fase).toBe('respondendoTruco');
    vi.advanceTimersByTime(5_000);
    t.mesa.acao('a', { tipo: 'aceitar' });
    expect(t.de('a', 'erro')).toEqual([]);
    expect(t.de('a', 'acao')[t.antes]).toEqual({ cadeira: 0, tipo: 'aceitar' });
  });

  test('truco: se o humano não responde, o parceiro bot decide no fim do prazo', () => {
    const t = cTruca();
    vi.advanceTimersByTime(JOGADA - 1);
    expect(t.mesa.partida!.fase).toBe('respondendoTruco');
    expect(t.de('a', 'acao')).toHaveLength(t.antes);
    vi.advanceTimersByTime(1);
    expect(t.de('a', 'acao')[t.antes].cadeira).toBe(2);
  });

  test('mão de 10: o bot espera a decisão do humano', () => {
    const t = mesaComParceiroBot();
    t.mesa.partida!.placar = [10, 0];
    avancarAte(() => t.mesa.partida!.fase === 'decisaoMao10');
    const antes = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.botMs * 10);
    expect(t.mesa.partida!.fase).toBe('decisaoMao10');
    t.mesa.acao('a', { tipo: 'mao10', jogar: true });
    expect(t.de('a', 'acao')[antes]).toEqual({ cadeira: 0, tipo: 'mao10', jogar: true });
  });

  test('mão de 10: correr também vai no aviso de ação (jogar: false)', () => {
    const t = mesaComParceiroBot();
    t.mesa.partida!.placar = [10, 0];
    avancarAte(() => t.mesa.partida!.fase === 'decisaoMao10');
    const antes = t.de('a', 'acao').length;
    t.mesa.acao('a', { tipo: 'mao10', jogar: false });
    expect(t.de('a', 'acao')[antes]).toEqual({ cadeira: 0, tipo: 'mao10', jogar: false });
  });

  test('mão de 10: sem resposta, o parceiro bot decide', () => {
    const t = mesaComParceiroBot();
    t.mesa.partida!.placar = [10, 0];
    avancarAte(() => t.mesa.partida!.fase === 'decisaoMao10');
    const antes = t.de('a', 'acao').length;
    vi.advanceTimersByTime(JOGADA - 1);
    expect(t.de('a', 'acao')).toHaveLength(antes);
    vi.advanceTimersByTime(1);
    expect(t.de('a', 'acao')[antes]).toMatchObject({ cadeira: 2, tipo: 'mao10', jogar: expect.any(Boolean) });
  });
});
