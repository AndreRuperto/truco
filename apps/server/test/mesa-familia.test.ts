import { type AcaoJogador, botFacil, type Cadeira, type EstadoPartida, janelaDeFamilia, REGRAS_RANQUEADA } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Família fechada ligada. */
const MINEIRO = REGRAS_RANQUEADA.mineiro;

/**
 * O bot da cadeira 1 pede família fechada uma vez, na primeira janela; no resto é o bot fácil,
 * mas sem pedir outras famílias (assim o teste não depende das mãos sorteadas).
 */
function pedeUmaVez() {
  let pediu = false;
  return (s: EstadoPartida, c: Cadeira): AcaoJogador | null => {
    if (!pediu && c === 1 && janelaDeFamilia(s)) {
      pediu = true;
      return { tipo: 'familia', cadeira: 1 };
    }
    const a = botFacil(s, c);
    return a?.tipo === 'familia' ? null : a;
  };
}

function ateConferir() {
  const t = criarMesa({ regras: MINEIRO, decidirBot: pedeUmaVez() });
  t.mesa.sentar('a', 'Ana');
  avancarAte(() => t.estado('a')?.visao?.fase === 'conferindoFamilia');
  return t;
}

describe('família na Mesa', () => {
  test('bot pede na janela; a dupla humana tem conferirMs e confere', () => {
    const t = ateConferir();
    const e = t.estado('a')!;
    expect(t.de('a', 'acao').at(-1)).toEqual({ cadeira: 1, tipo: 'familia', aberta: false });
    expect(e.prazo!.cadeiras).toEqual([0]);
    expect(e.prazo!.ate - Date.now()).toBeLessThanOrEqual(TEMPOS.conferirMs);
    expect(e.minhasAcoes).toEqual([
      { tipo: 'conferir', cadeira: 0, conferir: true },
      { tipo: 'conferir', cadeira: 0, conferir: false },
    ]);
    expect(e.visao!.mao!.familias[0].cartas).toBeNull();
    const [a, b] = e.visao!.placar;
    t.mesa.acao('a', { tipo: 'conferir', conferir: true });
    expect(t.de('a', 'acao').at(-1)).toEqual({ cadeira: 0, tipo: 'conferir', conferir: true });
    const v = t.estado('a')!.visao!;
    expect(v.mao!.familias[0].conferida!.por).toBe(0);
    expect(v.mao!.familias[0].cartas).toHaveLength(3);
    expect(v.placar[0] + v.placar[1]).toBe(a + b + 2);
  });

  test('prazo do conferir acaba: o parceiro bot decide (o fácil deixa passar a 1ª)', () => {
    const t = ateConferir();
    const placar = [...t.estado('a')!.visao!.placar];
    vi.advanceTimersByTime(TEMPOS.conferirMs);
    expect(t.de('a', 'acao').find((x) => x.tipo === 'conferir')).toEqual({ cadeira: 2, tipo: 'conferir', conferir: false });
    expect(t.estado('a')!.visao!.placar).toEqual(placar);
  });

  test('o bot da vez espera a janela de família antes da 1ª carta', () => {
    const t = criarMesa({ regras: MINEIRO, tempos: { ...TEMPOS, janelaFamiliaMs: 400 } });
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => t.de('a', 'acao').at(-1)?.tipo === 'distribuir', 1);
    const t0 = Date.now();
    const n = t.de('a', 'acao').length;
    avancarAte(() => t.de('a', 'acao').slice(n).some((x) => x.tipo === 'jogar'), 1);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(400);
  });

  test('dois humanos na dupla que confere: o prazo acaba e o servidor deixa passar (não trava)', () => {
    const t = criarMesa({ regras: MINEIRO, decidirBot: pedeUmaVez(), humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    avancarAte(() => t.estado('a')?.visao?.fase === 'conferindoFamilia');
    expect(t.estado('a')!.prazo!.cadeiras).toEqual([0, 2]);
    const placar = [...t.estado('a')!.visao!.placar];
    vi.advanceTimersByTime(TEMPOS.conferirMs);
    expect(t.de('a', 'acao').find((x) => x.tipo === 'conferir')).toMatchObject({ tipo: 'conferir', conferir: false });
    expect(t.estado('a')!.visao!.fase).toBe('jogando');
    expect(t.estado('a')!.visao!.placar).toEqual(placar);
  });
});
