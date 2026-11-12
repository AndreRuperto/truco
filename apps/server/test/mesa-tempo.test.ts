import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, avancarAte, criarMesa, vezDeJogar } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const minhaVez = (t: ReturnType<typeof criarMesa>) => vezDeJogar(t);

describe('tempo e bots', () => {
  test('bots jogam sozinhos', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => t.de('a', 'acao').some((x) => x.cadeira !== 0));
  });

  test('prazo informa até quando', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const restante = t.estado('a')!.prazo!.ate - Date.now();
    expect(restante).toBeLessThanOrEqual(TEMPOS.jogadaMs);
    expect(restante).toBeGreaterThan(TEMPOS.jogadaMs - 20);
  });

  test('tempo estourado: joga automaticamente por você', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const antes = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.jogadaMs);
    expect(t.de('a', 'acao')[antes]).toEqual({ cadeira: 0, tipo: 'jogar' });
  });

  // Ciclo 4 (decisão do produto, 2026-11-10): quem cai (troca de app, rede) tem o mesmo prazo de
  // quem está parado; antes o bot jogava por ele em ~botMs, inclusive respondendo truco.
  test('desconectado na vez: espera o prazo normal, sem enviar nada, e então faz a ação padrão', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const ate = t.estado('a')!.prazo!.ate;
    const acoes = t.de('a', 'acao').length;
    t.mesa.desconectar('a');
    const enviados = t.caixa.get('a')!.length;
    // Bem mais que o ritmo do bot: ninguém joga pela cadeira desconectada antes do prazo
    // (o estado da partida é imutável: o mesmo objeto = nenhuma ação aplicada).
    const partidaAntes = t.mesa.partida;
    vi.advanceTimersByTime(ate - Date.now() - 1);
    expect(t.mesa.partida).toBe(partidaAntes);
    expect(t.caixa.get('a')!.length).toBe(enviados);
    vi.advanceTimersByTime(1);
    // A cadeira desconectada não recebe `acao`; a jogada aparece no estado da partida.
    const m = t.mesa.partida!.mao;
    expect(m === null || m.maos[0].length === 2).toBe(true);
    t.mesa.reconectar('a');
    expect(t.de('a', 'acao')).toHaveLength(acoes);
  });

  test('cair e voltar dentro do prazo: a vez continua sua, com o mesmo prazo', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const ate = t.estado('a')!.prazo!.ate;
    t.mesa.desconectar('a');
    vi.advanceTimersByTime(TEMPOS.jogadaMs / 2);
    t.mesa.reconectar('a');
    const e = t.estado('a')!;
    expect(e.prazo!.cadeiras).toEqual([0]);
    expect(e.prazo!.ate).toBe(ate);
    expect(e.minhasAcoes.some((x) => x.tipo === 'jogar')).toBe(true);
    expect(t.mesa.partida!.mao!.maos[0]).toHaveLength(3);
  });

  test('o estado mostra aos outros o prazo da cadeira desconectada', () => {
    const t = criarMesa({ humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    avancarAte(() => minhaVez(t) && t.mesa.partida!.fase === 'jogando');
    t.mesa.desconectar('a');
    const e = t.estado('b')!;
    expect(e.prazo!.cadeiras).toEqual([0]);
    expect(e.cadeiras[0]).toMatchObject({ tipo: 'humano', conectado: false });
  });

  test('reconectar reenvia o estado', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => !!t.estado('a')?.visao?.mao);
    t.mesa.desconectar('a');
    const n = t.de('a', 'estado').length;
    t.mesa.reconectar('a');
    expect(t.de('a', 'estado').length).toBe(n + 1);
    expect(t.estado('a')!.cadeiras[0]).toMatchObject({ tipo: 'humano', conectado: true });
  });

  test('outro jogador cair e voltar não reinicia o prazo de quem está agindo', () => {
    const t = criarMesa({ humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    avancarAte(() => minhaVez(t) && t.mesa.partida!.fase === 'jogando');
    const ate = t.estado('a')!.prazo!.ate;
    vi.advanceTimersByTime(300);
    t.mesa.desconectar('b');
    t.mesa.reconectar('b');
    expect(t.estado('a')!.prazo!.ate).toBe(ate);
    expect(t.estado('b')!.prazo!.ate).toBe(ate);
    const antes = t.de('a', 'acao').length;
    vi.advanceTimersByTime(ate - Date.now() - 1);
    expect(t.de('a', 'acao')).toHaveLength(antes);
    vi.advanceTimersByTime(1);
    expect(t.de('a', 'acao')[antes]).toEqual({ cadeira: 0, tipo: 'jogar' });
  });

  test('sair depois do início: bot permanente', () => {
    const t = criarMesa({ humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    t.mesa.sair('b');
    expect(t.estado('a')!.cadeiras[2].tipo).toBe('bot');
    expect(t.mesa.cadeiraDe('b')).toBeNull();
  });

  test('partida inteira termina e chama aoTerminar uma vez', () => {
    const aoTerminar = vi.fn();
    const t = criarMesa({ aoTerminar });
    t.mesa.sentar('a', 'Ana');
    t.mesa.desconectar('a');
    avancarAte(() => aoTerminar.mock.calls.length > 0, 10, 5_000_000);
    t.mesa.reconectar('a');
    expect(aoTerminar).toHaveBeenCalledTimes(1);
    expect(t.estado('a')!.visao!.fase).toBe('fimPartida');
    expect(t.estado('a')!.visao!.vencedor).not.toBeNull();
  });

  test('bot difícil conduz uma mão inteira', () => {
    const t = criarMesa({ nivelBot: 'dificil' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.desconectar('a');
    avancarAte(() => t.mesa.partida!.ultimaMao !== null, 10, 600_000);
  }, 60_000);
});
