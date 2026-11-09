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
  test('humano pode pedir três fechadas na mesma mão e o prazo pausa durante a conferência', () => {
    const semPedidos = (estado: EstadoPartida, cadeira: Cadeira): AcaoJogador | null => {
      const a = botFacil(estado, cadeira);
      return a?.tipo === 'familia' ? null : a;
    };
    // O tempo de conferir é maior que o da janela, para testar a pausa.
    const t = criarMesa({
      regras: MINEIRO,
      decidirBot: semPedidos,
      tempos: { ...TEMPOS, distribuicaoMs: 0, janelaFamiliaMs: 30, botMs: 110 },
    });
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => !!t.estado('a')?.janelaFamilia, 1);
    for (let n = 1; n <= 3; n++) {
      t.mesa.acao('a', { tipo: 'familia' });
      expect(t.estado('a')!.visao!.fase).toBe('conferindoFamilia');
      avancarAte(() => t.estado('a')?.visao?.fase === 'jogando', 1, 1000);
      expect(t.estado('a')!.visao!.mao!.familias.filter((f) => f.tipo === 'fechada')).toHaveLength(n);
      // Após três fechadas, quem não tem família verdadeira é dispensado automaticamente.
      if (n < 3) {
        expect(t.estado('a')!.janelaFamilia).not.toBeNull();
      } else {
        // A terceira fechada esgota o limite; sem família real, não há decisão pendente.
        expect(t.estado('a')!.janelaFamilia).toBeNull();
        expect(t.estado('a')!.prazo?.cadeiras ?? []).not.toContain(0);
      }
      expect(t.estado('a')!.minhasAcoes.some((a) => a.tipo === 'familia')).toBe(n < 3);
    }
    // A quarta só pode ser aberta (e somente com uma família real).
    expect(t.estado('a')!.visao!.mao!.familias).toHaveLength(3);
    if (t.estado('a')!.janelaFamilia) t.mesa.semFamilia('a');
    expect(t.estado('a')!.janelaFamilia).toBeNull();
  });

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

  describe('janela de família (igual para todos)', () => {
    const JANELA = { ...TEMPOS, janelaFamiliaMs: 5_000, jogadaMs: 20_000 };
    /** Bot fácil que nunca pede família (o teste não depende das mãos sorteadas). */
    const semFamilia = (s: EstadoPartida, c: Cadeira): AcaoJogador | null => {
      const a = botFacil(s, c);
      return a?.tipo === 'familia' ? null : a;
    };
    const aposDar = (extra = {}) => {
      const t = criarMesa({ regras: MINEIRO, decidirBot: semFamilia, tempos: JANELA, ...extra });
      t.mesa.sentar('a', 'Ana');
      avancarAte(() => !!t.estado('a')?.janelaFamilia, 1);
      return t;
    };

    test('depois de dar, ninguém joga até o fim da janela; nem quem começa', () => {
      const t = aposDar();
      const e = t.estado('a')!;
      expect(e.janelaFamilia!.decidiram).toEqual([]);
      expect(e.prazo).toEqual({ cadeiras: [0], ate: e.janelaFamilia!.ate });
      expect(e.minhasAcoes.some((a) => a.tipo === 'jogar')).toBe(false);
      const n = t.de('a', 'acao').length;
      // quem é da vez tenta jogar: recusado
      const vez = t.mesa.partida!.mao!.vez;
      if (vez === 0) {
        t.mesa.acao('a', { tipo: 'jogar', carta: t.mesa.partida!.mao!.maos[0][0] });
        expect(t.de('a', 'erro').at(-1)?.mensagem).toMatch(/hora de pedir família/);
      }
      vi.advanceTimersByTime(e.janelaFamilia!.ate - Date.now() - 1);
      expect(t.de('a', 'acao').slice(n).some((x) => x.tipo === 'jogar')).toBe(false);
      vi.advanceTimersByTime(1);
      expect(t.estado('a')!.janelaFamilia).toBeNull();
      avancarAte(() => vezDeJogar(t) || t.de('a', 'acao').slice(n).some((x) => x.tipo === 'jogar'), 1);
    });

    test('"sem família" de todos os humanos fecha a janela na hora', () => {
      const t = aposDar();
      const n = t.de('a', 'acao').length;
      t.mesa.semFamilia('a');
      expect(t.estado('a')!.janelaFamilia).toBeNull();
      if (t.mesa.partida!.mao!.vez === 0) expect(t.estado('a')!.minhasAcoes.some((a) => a.tipo === 'jogar')).toBe(true);
      else {
        avancarAte(() => t.de('a', 'acao').slice(n).some((x) => x.tipo === 'jogar'), 1, 2_000);
      }
    });

    test('três fechadas e nenhum humano com família: janela fecha sem esperar o relógio', () => {
      const t = criarMesa({ regras: MINEIRO, decidirBot: semFamilia, tempos: JANELA, humanosEsperados: 2 });
      t.mesa.sentar('a', 'Ana');
      t.mesa.sentar('b', 'Bia');
      avancarAte(() => !!t.estado('a')?.janelaFamilia, 1);
      const m = t.mesa.partida!.mao!;
      m.familias = Array.from({ length: 3 }, () => ({
        cadeira: 1 as Cadeira, tipo: 'fechada' as const, cartas: [], conferida: null,
      }));
      // A decisão de Ana dispara a reavaliação: Bia não tem família real.
      for (const c of [0, 2] as Cadeira[]) {
        m.maos[c] = [
          { valor: '4', naipe: 'ouros' }, { valor: '5', naipe: 'copas' }, { valor: '6', naipe: 'espadas' },
        ];
      }
      t.mesa.semFamilia('a');
      expect(t.estado('a')!.janelaFamilia).toBeNull();
      expect(t.estado('b')!.janelaFamilia).toBeNull();
    });

    test('Abrir 3 no corte conta para o limite e dispensa quem não tem família', () => {
      const t = criarMesa({ regras: MINEIRO, decidirBot: semFamilia, tempos: JANELA });
      t.mesa.sentar('a', 'Ana');
      avancarAte(() => !!t.estado('a')?.janelaFamilia, 1);
      const m = t.mesa.partida!.mao!;
      m.abertasNoCorte = [
        { valor: 'Q', naipe: 'ouros' }, { valor: 'J', naipe: 'copas' }, { valor: 'K', naipe: 'espadas' },
      ];
      m.familias = Array.from({ length: 2 }, () => ({
        cadeira: 1 as Cadeira, tipo: 'fechada' as const, cartas: [], conferida: null,
      }));
      m.maos[0] = [
        { valor: '4', naipe: 'ouros' }, { valor: '5', naipe: 'copas' }, { valor: '6', naipe: 'espadas' },
      ];
      t.mesa.semFamilia('a');
      expect(t.estado('a')!.janelaFamilia).toBeNull();
      expect(t.estado('a')!.minhasAcoes.some((a) => a.tipo === 'familia')).toBe(false);
    });

    test('três fechadas e um humano com família verdadeira: mantém sua janela', () => {
      const t = criarMesa({ regras: MINEIRO, decidirBot: semFamilia, tempos: JANELA, humanosEsperados: 2 });
      t.mesa.sentar('a', 'Ana');
      t.mesa.sentar('b', 'Bia');
      avancarAte(() => !!t.estado('a')?.janelaFamilia, 1);
      const m = t.mesa.partida!.mao!;
      m.familias = Array.from({ length: 3 }, () => ({
        cadeira: 1 as Cadeira, tipo: 'fechada' as const, cartas: [], conferida: null,
      }));
      m.maos[0] = [
        { valor: '4', naipe: 'ouros' }, { valor: '5', naipe: 'copas' }, { valor: '6', naipe: 'espadas' },
      ];
      m.maos[2] = [
        { valor: 'Q', naipe: 'ouros' }, { valor: 'J', naipe: 'copas' }, { valor: 'K', naipe: 'espadas' },
      ];
      t.mesa.semFamilia('a');
      expect(t.estado('b')!.janelaFamilia?.decidiram).toContain(0);
      expect(t.estado('b')!.janelaFamilia?.decidiram).not.toContain(2);
      expect(t.estado('b')!.prazo?.cadeiras).toEqual([2]);
      expect(t.estado('b')!.minhasAcoes.some((a) => a.tipo === 'familia')).toBe(true);
      t.mesa.semFamilia('b');
      expect(t.estado('a')!.janelaFamilia).toBeNull();
    });

    test('com dois humanos, só fecha antes quando os dois decidem', () => {
      const t = criarMesa({ regras: MINEIRO, decidirBot: semFamilia, tempos: JANELA, humanosEsperados: 2 });
      t.mesa.sentar('a', 'Ana');
      t.mesa.sentar('b', 'Bia');
      avancarAte(() => !!t.estado('a')?.janelaFamilia, 1);
      t.mesa.semFamilia('a');
      expect(t.estado('a')!.janelaFamilia!.decidiram).toEqual([0]);
      expect(t.estado('a')!.prazo!.cadeiras).toEqual([2]);
      t.mesa.semFamilia('b');
      expect(t.estado('a')!.janelaFamilia).toBeNull();
    });
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
      // Sem a janela de família do servidor: aqui se testa o prazo da vez depois dela.
      const t = criarMesa({ regras: ABERTA, decidirBot: soComFamilia, tempos: { ...TEMPOS, janelaFamiliaMs: 0 } });
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

  test('bot não pede família por humano, nem desconectado', () => {
    const consultas: Cadeira[] = [];
    // Pede família (fechada) sempre que pode; quem roda a mesa é que não pode deixar sair pelo humano.
    const sempre = (s: EstadoPartida, c: Cadeira): AcaoJogador | null => {
      if (janelaDeFamilia(s) && s.mao!.vez !== c) consultas.push(c);
      if (janelaDeFamilia(s) && s.monte.length >= 3) return { tipo: 'familia', cadeira: c };
      return botFacil(s, c);
    };
    const t = criarMesa({ regras: MINEIRO, decidirBot: sempre, humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    t.mesa.desconectar('b');
    avancarAte(() => t.mesa.partida!.fase === 'fimPartida', 10, 3_000_000);
    expect(consultas.filter((c) => c === 0 || c === 2)).toEqual([]);
    expect(t.de('a', 'acao').filter((x) => x.tipo === 'familia' && (x.cadeira === 0 || x.cadeira === 2))).toEqual([]);
    expect(t.de('a', 'acao').some((x) => x.tipo === 'familia')).toBe(true);
  });

  test('cada bot fora da vez decide a família uma vez por mão', () => {
    let mao = 0;
    const vezes = new Map<string, number>();
    const decidir = (s: EstadoPartida, c: Cadeira): AcaoJogador | null => {
      if (janelaDeFamilia(s) && s.mao!.vez !== c) {
        const k = `${mao}:${c}`;
        vezes.set(k, (vezes.get(k) ?? 0) + 1);
        // A 1ª consulta da cadeira 1 na mão pede (fechada): conferência e volta à janela.
        if (c === 1 && vezes.get(k) === 1 && s.monte.length >= 3) return { tipo: 'familia', cadeira: 1 };
        return null;
      }
      const a = botFacil(s, c);
      return a?.tipo === 'familia' ? null : a;
    };
    const t = criarMesa({ regras: MINEIRO, decidirBot: decidir, aoAplicar: (a) => a.tipo === 'distribuir' && mao++ });
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => mao >= 4 || t.mesa.partida!.fase === 'fimPartida', 10, 3_000_000);
    expect(t.de('a', 'acao').some((x) => x.tipo === 'conferir')).toBe(true);
    expect(Object.fromEntries([...vezes].filter(([, n]) => n > 1))).toEqual({});
  });
});
