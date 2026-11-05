import { type AcaoJogador, botFacil, type Cadeira, ehFamilia, type EstadoPartida, janelaDeFamilia, REGRAS_RANQUEADA } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, avancarAte, criarMesa, vezDeJogar } from './mesa-helpers';

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

  describe('família aberta e o prazo do humano da vez', () => {
    const ABERTA = { ...MINEIRO, familia: 'aberta' as const };
    /** Bots pedem família (aberta) só quando têm uma de verdade; senão jogam o fácil. */
    const soComFamilia = (s: EstadoPartida, c: Cadeira): AcaoJogador | null => {
      if (janelaDeFamilia(s) && s.mao && ehFamilia(s.mao.maos[c])) return { tipo: 'familia', cadeira: c };
      const a = botFacil(s, c);
      return a?.tipo === 'familia' ? null : a;
    };
    /** Põe 3 figuras do monte na mão da cadeira `c` (mexe no estado vivo da Mesa: só teste). */
    function darFamilia(s: EstadoPartida, c: Cadeira): void {
      const mao = s.mao!.maos[c];
      const figuras = s.monte.map((x, i) => ({ x, i })).filter(({ x }) => ['Q', 'J', 'K', 'A'].includes(x.valor)).slice(0, 3);
      figuras.forEach(({ i }, k) => {
        const tmp = mao[k];
        mao[k] = s.monte[i];
        s.monte[i] = tmp;
      });
      expect(ehFamilia(mao)).toBe(true);
    }
    const naJanelaDaAna = () => {
      const t = criarMesa({ regras: ABERTA, decidirBot: soComFamilia });
      t.mesa.sentar('a', 'Ana');
      avancarAte(() => vezDeJogar(t) && janelaDeFamilia(t.mesa.partida!) && !t.mesa.partida!.mao!.maos.some((m) => ehFamilia(m)), 1);
      return t;
    };

    test('bot fora da vez abre família: o prazo da Ana não reinicia', () => {
      const t = naJanelaDaAna();
      const ate = t.estado('a')!.prazo!.ate;
      // A consulta dos bots fora da vez ainda está agendada (botMs).
      darFamilia(t.mesa.partida!, 1);
      vi.advanceTimersByTime(300);
      expect(t.de('a', 'acao').at(-1)).toEqual({ cadeira: 1, tipo: 'familia', aberta: true });
      expect(t.estado('a')!.prazo).toEqual({ cadeiras: [0], ate });
      const n = t.de('a', 'acao').length;
      vi.advanceTimersByTime(ate - Date.now() - 1);
      expect(t.de('a', 'acao')).toHaveLength(n);
      vi.advanceTimersByTime(1);
      expect(t.de('a', 'acao')[n]).toEqual({ cadeira: 0, tipo: 'jogar' });
    });

    test('quem é da vez e age (abre família) ganha prazo novo', () => {
      const t = naJanelaDaAna();
      const ate = t.estado('a')!.prazo!.ate;
      vi.advanceTimersByTime(300);
      darFamilia(t.mesa.partida!, 0);
      t.mesa.acao('a', { tipo: 'familia' });
      expect(t.de('a', 'erro')).toEqual([]);
      expect(t.estado('a')!.prazo!.ate).toBe(ate + 300);
    });
  });
});
