import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mulberry32 } from '@truco/engine';
import { avancarAte, criarMesa, TEMPOS } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Joga sozinho (o tempo da Ana acaba e o servidor joga por ela) até a 1ª rodada cangar. */
function ateCangar() {
  for (let semente = 1; semente < 40; semente++) {
    const t = criarMesa({ tempos: { ...TEMPOS, jogadaMs: 200 }, rand: mulberry32(semente) });
    t.mesa.sentar('a', 'Ana');
    try {
      avancarAte(() => {
        const f = t.estado('a')?.visao?.fase;
        if (f === 'fimPartida') throw new Error('acabou');
        return f === 'empilhando';
      }, 5);
      return t;
    } catch {
      t.mesa.dispose();
    }
  }
  throw new Error('nenhuma cangada em 40 partidas');
}

describe('cangada na Mesa', () => {
  test('todos empilham ao mesmo tempo: os bots logo, a Ana com prazo e as duas opções', () => {
    const t = ateCangar();
    const e = t.estado('a')!;
    expect(e.prazo!.cadeiras).toEqual([0]);
    expect(e.minhasAcoes.map((a) => a.tipo)).toEqual(['empilhar', 'empilhar']);
    vi.advanceTimersByTime(TEMPOS.botMs * 4);
    expect(t.estado('a')!.visao!.mao!.cangada!.empilhou).toEqual([false, true, true, true]);
    // o prazo não reinicia quando os bots empilham
    expect(t.estado('a')!.prazo!.ate).toBe(e.prazo!.ate);
    const [primeira, segunda] = t.estado('a')!.visao!.mao!.minhaMao;
    t.mesa.acao('a', { tipo: 'empilhar', indice: 1 });
    const v = t.estado('a')!.visao!;
    expect(v.fase).toBe('jogando');
    if (v.regras.variante === 'mineiro') {
      // Mineiro: as de cima viram juntas (a 2ª da Ana foi por cima) e fica a de baixo, que decide.
      expect(v.mao!.cangada!.etapa).toBe('baixo');
      expect(v.mao!.rodadasJogadas[1].find((j) => j.cadeira === 0)!.carta).toEqual(segunda);
      expect(v.mao!.minhaMao).toEqual([primeira]);
    } else {
      expect(v.mao!.cangada!.etapa).toBe('cima');
      expect(v.mao!.minhaMao[0]).toEqual(segunda);
    }
  });

  test('o tempo acaba: o servidor empilha pela Ana (a mais forte por cima) e o jogo segue', () => {
    const t = ateCangar();
    const ate = t.estado('a')!.prazo!.ate;
    vi.advanceTimersByTime(ate - Date.now());
    expect(t.estado('a')!.visao!.fase).not.toBe('empilhando');
    expect(t.de('a', 'acao').filter((x) => x.tipo === 'empilhar')).toHaveLength(4);
  });
});
