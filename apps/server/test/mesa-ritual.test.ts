import { idCarta } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { randCripto } from '../src/mesa/Mesa';
import { TEMPOS, ateEtapa, avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type T = ReturnType<typeof criarMesa>;
const novas = (t: T, desde: number) => t.de('a', 'acao').slice(desde);
const comAna = (extra: Parameters<typeof criarMesa>[0] = {}) => {
  const t = criarMesa(extra);
  t.mesa.sentar('a', 'Ana');
  return t;
};

describe('ritual na Mesa', () => {
  test('a sorte é do servidor: bits que o cliente manda são ignorados', () => {
    const t = comAna();
    ateEtapa(t, 'embaralhando');
    const antes = t.mesa.partida!.monte.map(idCarta);
    t.mesa.acao('a', { tipo: 'embaralhar', bits: antes.map(() => 0) });
    expect(t.de('a', 'erro')).toEqual([]);
    expect(t.mesa.partida!.ritual!.embaralhadas).toBe(1);
    // Bits todos 0 deixariam o monte igual; os do servidor mexem.
    expect(t.mesa.partida!.monte.map(idCarta)).not.toEqual(antes);
  });

  test('as mensagens acao nunca levam a sorte; distribuir leva modo e ordem; cortar, a fração', () => {
    const t = comAna();
    avancarAte(() => t.de('a', 'acao').some((a) => a.tipo === 'distribuir'));
    const msgs = t.de('a', 'acao');
    expect(JSON.stringify(msgs)).not.toMatch(/bits|ponto/);
    const d = msgs.find((a) => a.tipo === 'distribuir')!;
    expect(d.modo).toBe('porCima');
    expect(d.ordem).toHaveLength(4);
    for (const c of msgs.filter((a) => a.tipo === 'cortar')) {
      expect(c.fracao).toBeGreaterThanOrEqual(0.3);
      expect(c.fracao).toBeLessThanOrEqual(0.7);
    }
  });

  test('prazo do ritual é ritualMs; tempo esgotado embaralha 3 vezes e passa', () => {
    const t = comAna();
    ateEtapa(t, 'embaralhando');
    const restante = t.estado('a')!.prazo!.ate - Date.now();
    expect(restante).toBeLessThanOrEqual(TEMPOS.ritualMs);
    expect(restante).toBeGreaterThan(TEMPOS.ritualMs - 20);
    const n = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.ritualMs);
    expect(novas(t, n).slice(0, 4)).toEqual([
      { cadeira: 0, tipo: 'embaralhar' },
      { cadeira: 0, tipo: 'embaralhar' },
      { cadeira: 0, tipo: 'embaralhar' },
      { cadeira: 0, tipo: 'passarCorte' },
    ]);
  });

  test('mão nova: a 1ª embaralhada do humano ganha a pausa do resumo da mão anterior', () => {
    const t = comAna();
    avancarAte(() => {
      const r = t.mesa.partida?.ritual;
      return t.mesa.partida?.fase === 'embaralhando' && !!t.mesa.partida.ultimaMao && r?.embaralhador === 0 && r.embaralhadas === 0;
    }, 1);
    const restante = t.estado('a')!.prazo!.ate - Date.now();
    expect(restante).toBeGreaterThan(TEMPOS.ritualMs);
    expect(restante).toBeLessThanOrEqual(TEMPOS.ritualMs + TEMPOS.pausaMaoMs);
  });

  test('o prazo é da etapa: embaralhar de novo não reinicia o relógio', () => {
    const t = comAna();
    ateEtapa(t, 'embaralhando');
    const ate = t.estado('a')!.prazo!.ate;
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(100);
      t.mesa.acao('a', { tipo: 'embaralhar' });
      expect(t.estado('a')!.prazo).toEqual({ cadeiras: [0], ate });
    }
    const n = t.de('a', 'acao').length;
    vi.advanceTimersByTime(ate - Date.now() - 1);
    expect(t.de('a', 'acao')).toHaveLength(n);
    vi.advanceTimersByTime(1);
    // Já embaralhou 5 vezes: o tempo esgotado só passa para o corte.
    expect(novas(t, n)[0]).toEqual({ cadeira: 0, tipo: 'passarCorte' });
  });

  test('o prazo é da etapa: cortar várias vezes não reinicia o relógio', () => {
    const t = comAna();
    ateEtapa(t, 'cortando');
    const ate = t.estado('a')!.prazo!.ate;
    // Dois movimentos (o 3º encerraria o corte).
    for (let i = 0; i < 2; i++) {
      vi.advanceTimersByTime(100);
      t.mesa.acao('a', { tipo: 'cortar' });
      expect(t.de('a', 'erro')).toEqual([]);
      expect(t.estado('a')!.prazo).toEqual({ cadeiras: [0], ate });
    }
    const n = t.de('a', 'acao').length;
    vi.advanceTimersByTime(ate - Date.now());
    expect(novas(t, n)[0]).toEqual({ cadeira: 0, tipo: 'devolver' });
  });

  test('cortador humano: tempo esgotado corta e devolve', () => {
    const t = comAna();
    ateEtapa(t, 'cortando');
    const n = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.ritualMs);
    const [corte, devolveu] = novas(t, n);
    expect(corte).toMatchObject({ cadeira: 0, tipo: 'cortar' });
    expect(devolveu).toEqual({ cadeira: 0, tipo: 'devolver' });
  });

  test('quem dá escolhe por baixo; tempo esgotado na escolha dá por cima', () => {
    const t = comAna();
    ateEtapa(t, 'escolhendoDistribuicao');
    t.mesa.acao('a', { tipo: 'distribuir', modo: 'porBaixo' });
    expect(t.de('a', 'acao').at(-1)).toEqual({ cadeira: 0, tipo: 'distribuir', modo: 'porBaixo', ordem: [1, 2, 3, 0] });
    expect(t.estado('a')!.visao!.mao!.modo).toBe('porBaixo');
    ateEtapa(t, 'escolhendoDistribuicao');
    const n = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.ritualMs);
    expect(novas(t, n)[0]).toMatchObject({ cadeira: 0, tipo: 'distribuir', modo: 'porCima' });
  });

  test('humano cai no meio do ritual: a etapa espera o prazo dele e a mão sai (não trava)', () => {
    const t = comAna();
    ateEtapa(t, 'embaralhando');
    t.mesa.acao('a', { tipo: 'embaralhar' });
    t.mesa.desconectar('a');
    const antes = Date.now();
    // Dentro do prazo do ritual a etapa continua dele.
    vi.advanceTimersByTime(TEMPOS.ritualMs - 1);
    expect(t.mesa.partida!.fase).toBe('embaralhando');
    avancarAte(() => t.mesa.partida!.fase === 'jogando');
    expect(Date.now() - antes).toBeGreaterThanOrEqual(TEMPOS.ritualMs);
    expect(t.mesa.partida!.mao!.maos.every((m) => m.length === 3)).toBe(true);
  });

  test('humano volta no meio do ritual: estado e prazo coerentes com a etapa', () => {
    const t = comAna();
    ateEtapa(t, 'cortando');
    t.mesa.acao('a', { tipo: 'cortar' });
    t.mesa.desconectar('a');
    const n = t.de('a', 'estado').length;
    t.mesa.reconectar('a');
    const e = t.estado('a')!;
    expect(t.de('a', 'estado').length).toBe(n + 1);
    expect(e.visao!.fase).toBe('cortando');
    expect(e.visao!.ritual).toMatchObject({ cortador: 0, movimentos: 1 });
    expect(e.minhasAcoes.map((a) => a.tipo)).toContain('devolver');
    expect(e.prazo!.cadeiras).toEqual([0]);
    expect(e.prazo!.ate - Date.now()).toBe(TEMPOS.ritualMs);
    // O prazo novo vale: no fim dele o servidor devolve por ela.
    const k = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.ritualMs);
    expect(novas(t, k)[0]).toEqual({ cadeira: 0, tipo: 'devolver' });
  });

  test('dispose no meio do ritual não deixa timer pendente', () => {
    const t = comAna();
    ateEtapa(t, 'embaralhando');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    t.mesa.dispose();
    expect(vi.getTimerCount()).toBe(0);
    const n = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.ritualMs * 10);
    expect(t.de('a', 'acao')).toHaveLength(n);
  });

  test('aoAplicar recebe as ações sem a sorte', () => {
    const vistas: unknown[] = [];
    const t = comAna({ aoAplicar: (a) => vistas.push(a) });
    avancarAte(() => !!t.estado('a')?.visao?.mao);
    expect(vistas.length).toBeGreaterThan(0);
    expect(JSON.stringify(vistas)).not.toMatch(/bits|ponto/);
  });

  test('a sorte padrão é CSPRNG e a mesa joga com ela', () => {
    for (let i = 0; i < 100; i++) {
      const x = randCripto();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const t = comAna({ rand: undefined });
    avancarAte(() => !!t.estado('a')?.visao?.mao);
    expect(t.de('a', 'erro')).toEqual([]);
  });
});
