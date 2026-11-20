import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type Cadeira, quemDeveAgir } from '@truco/engine';
import { jogadaAutomatica } from '../src/mesa/Mesa';
import { opcoesDaSala } from '../src/mesa/protocolo';
import { TEMPOS, ateEtapa, avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * Vez de 'a' (cadeira 0) jogar carta. Sem limite de tempo ninguém age pelos humanos: a cada passo
 * os humanos de `humanos` (id → cadeira) fazem a ação padrão quando devem agir, menos 'a' jogando.
 */
const vezDeA = (t: ReturnType<typeof criarMesa>, humanos: Record<string, Cadeira> = { a: 0 }) => {
  const e = t.estado('a');
  if (e?.visao?.fase === 'jogando' && e.visao.mao?.vez === 0 && e.minhasAcoes.some((x) => x.tipo === 'jogar')) return true;
  const s = t.mesa.partida;
  if (s) for (const [id, c] of Object.entries(humanos)) if (quemDeveAgir(s).includes(c)) t.mesa.acao(id, jogadaAutomatica(s, c));
  return false;
};

describe('opção "sem limite de tempo" (só na mesa privada)', () => {
  test('a mesa privada aceita; o padrão continua com limite', () => {
    expect(opcoesDaSala({ modo: 'privada', semLimiteDeTempo: true }).semLimiteDeTempo).toBe(true);
    expect(opcoesDaSala({ modo: 'privada' }).semLimiteDeTempo).toBe(false);
    expect(opcoesDaSala({ modo: 'privada', semLimiteDeTempo: 'sim' }).semLimiteDeTempo).toBe(false);
  });

  test('salas públicas e ranqueada ignoram a opção', () => {
    expect(opcoesDaSala({ modo: 'classica', semLimiteDeTempo: true }).semLimiteDeTempo).toBe(false);
    expect(opcoesDaSala({ modo: 'desafio', semLimiteDeTempo: true }).semLimiteDeTempo).toBe(false);
    expect(opcoesDaSala({ modo: 'ranqueada', semLimiteDeTempo: true }).semLimiteDeTempo).toBe(false);
  });
});

// Tutorial (2026-11-20): partida guiada, sozinho contra bots fáceis, sem relógio para quem aprende.
describe('tutorial: mesa solo sem limite de tempo', () => {
  test('só com o pedido de tutorial, sozinho, na clássica', () => {
    expect(opcoesDaSala({ modo: 'classica', humanos: 1, tutorial: true, semLimiteDeTempo: true }).semLimiteDeTempo).toBe(true);
    // Com gente na mesa, ou fora da clássica, o relógio continua.
    expect(opcoesDaSala({ modo: 'classica', humanos: 2, tutorial: true, semLimiteDeTempo: true }).semLimiteDeTempo).toBe(false);
    expect(opcoesDaSala({ modo: 'desafio', humanos: 1, tutorial: true, semLimiteDeTempo: true }).semLimiteDeTempo).toBe(false);
    expect(opcoesDaSala({ modo: 'ranqueada', humanos: 2, tutorial: true, semLimiteDeTempo: true }).semLimiteDeTempo).toBe(false);
    expect(opcoesDaSala({ modo: 'classica', humanos: 1, tutorial: 'sim', semLimiteDeTempo: true }).semLimiteDeTempo).toBe(false);
  });
});

describe('mesa sem limite de tempo', () => {
  test('o estado avisa todos que a mesa é sem limite (desde a sala de espera)', () => {
    const t = criarMesa({ humanosEsperados: 2, semLimiteDeTempo: true, modo: 'privada' });
    t.mesa.sentar('a', 'Ana');
    expect(t.estado('a')!.semLimiteDeTempo).toBe(true);
    const c = criarMesa();
    c.mesa.sentar('a', 'Ana');
    expect(c.estado('a')!.semLimiteDeTempo).toBe(false);
  });

  test('na vez de jogar: sem prazo e ninguém joga por você, por mais que demore', () => {
    const t = criarMesa({ semLimiteDeTempo: true, modo: 'privada' });
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => vezDeA(t));
    expect(t.estado('a')!.prazo).toBeNull();
    const partida = t.mesa.partida;
    vi.advanceTimersByTime(TEMPOS.jogadaMs * 100);
    expect(t.mesa.partida).toBe(partida);
    const jogar = t.estado('a')!.minhasAcoes.find((x) => x.tipo === 'jogar')!;
    t.mesa.acao('a', jogar);
    expect(t.mesa.partida!.mao?.maos[0].length ?? 2).toBeLessThan(3);
  });

  test('no ritual (embaralhar) também não há prazo', () => {
    const t = criarMesa({ semLimiteDeTempo: true, modo: 'privada' });
    t.mesa.sentar('a', 'Ana');
    ateEtapa(t, 'embaralhando');
    expect(t.estado('a')!.prazo).toBeNull();
    const partida = t.mesa.partida;
    vi.advanceTimersByTime(TEMPOS.ritualMs * 100);
    expect(t.mesa.partida).toBe(partida);
  });

  test('desconectado na vez: vale o prazo normal e a ação padrão (a mesa não trava)', () => {
    const t = criarMesa({ humanosEsperados: 2, semLimiteDeTempo: true, modo: 'privada' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    avancarAte(() => vezDeA(t, { a: 0, b: 2 }));
    t.mesa.desconectar('a');
    const e = t.estado('b')!;
    expect(e.prazo!.cadeiras).toEqual([0]);
    expect(e.prazo!.ate - Date.now()).toBeLessThanOrEqual(TEMPOS.jogadaMs);
    vi.advanceTimersByTime(TEMPOS.jogadaMs);
    const m = t.mesa.partida!.mao;
    expect(m === null || m.maos[0].length === 2).toBe(true);
  });

  test('voltou antes do prazo: a vez segue sem limite', () => {
    const t = criarMesa({ humanosEsperados: 2, semLimiteDeTempo: true, modo: 'privada' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    avancarAte(() => vezDeA(t, { a: 0, b: 2 }));
    t.mesa.desconectar('a');
    vi.advanceTimersByTime(TEMPOS.jogadaMs / 2);
    t.mesa.reconectar('a');
    expect(t.estado('a')!.prazo).toBeNull();
    const partida = t.mesa.partida;
    vi.advanceTimersByTime(TEMPOS.jogadaMs * 10);
    expect(t.mesa.partida).toBe(partida);
  });

  test('saiu de vez (fim da reconexão): um bot assume e a partida segue', () => {
    const t = criarMesa({ humanosEsperados: 2, semLimiteDeTempo: true, modo: 'privada' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    avancarAte(() => vezDeA(t, { a: 0, b: 2 }));
    t.mesa.sair('a');
    avancarAte(() => (t.mesa.partida!.mao?.maos[0].length ?? 3) < 3 || t.mesa.partida!.mao === null, 10, 5_000);
  });
});
