import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function mesaComHumanoNaVez() {
  const t = criarMesa();
  t.mesa.sentar('a', 'Ana');
  avancarAte(() => !!t.estado('a')?.prazo?.cadeiras.includes(0));
  return t;
}

describe('ações', () => {
  test('distribui após a pausa e manda só a visão do próprio jogador', () => {
    const { mesa, estado } = criarMesa();
    mesa.sentar('a', 'Ana');
    avancarAte(() => !!estado('a')?.visao?.mao);
    const e = estado('a')!;
    expect(e.minhaCadeira).toBe(0);
    expect(e.visao!.cadeira).toBe(0);
    expect(JSON.stringify(e)).not.toContain('"maos"');
  });

  test('a cadeira enviada pelo cliente é ignorada', () => {
    const { mesa, de } = mesaComHumanoNaVez();
    mesa.acao('a', { tipo: 'jogar', cadeira: 1, indice: 0 });
    expect(de('a', 'erro')).toHaveLength(0);
    expect(de('a', 'acao').at(-1)).toEqual({ cadeira: 0, tipo: 'jogar' });
  });

  test('minhasAcoes lista as jogadas na sua vez', () => {
    const { estado } = mesaComHumanoNaVez();
    const acoes = estado('a')!.minhasAcoes;
    expect(acoes.some((a) => a.tipo === 'jogar')).toBe(true);
    expect(acoes.every((a) => a.cadeira === 0)).toBe(true);
  });

  test('cliente não pode distribuir', () => {
    const { mesa, de } = mesaComHumanoNaVez();
    mesa.acao('a', { tipo: 'distribuir', baralho: [] });
    expect(de('a', 'erro')).toEqual([{ mensagem: 'ação inválida' }]);
  });

  test('jogada fora da vez gera erro só para quem mandou', () => {
    const { mesa, de } = mesaComHumanoNaVez();
    mesa.acao('a', { tipo: 'jogar', indice: 0 });
    // Se `a` venceu a rodada a vez volta para ele; o timer dele acaba jogando e a vez passa.
    avancarAte(() => mesa.partida!.fase === 'jogando' && mesa.partida!.mao!.vez !== 0);
    mesa.acao('a', { tipo: 'jogar', indice: 0 });
    expect(de('a', 'erro')).toEqual([{ mensagem: 'não é sua vez' }]);
  });

  test('lixo não derruba a mesa', () => {
    const { mesa, de } = mesaComHumanoNaVez();
    for (const lixo of [null, 'x', 42, { tipo: 'jogar', indice: 'a' }, { tipo: 'hackear' }]) {
      expect(() => mesa.acao('a', lixo)).not.toThrow();
    }
    expect(de('a', 'erro')).toHaveLength(5);
  });

  test('sincronizar reenvia o estado só para quem pediu', () => {
    const t = criarMesa({ humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    const na = t.de('a', 'estado').length;
    const nb = t.de('b', 'estado').length;
    t.mesa.sincronizar('a');
    expect(t.de('a', 'estado')).toHaveLength(na + 1);
    expect(t.de('b', 'estado')).toHaveLength(nb);
    expect(t.estado('a')!.minhaCadeira).toBe(0);
    t.mesa.sincronizar('intruso');
    expect(t.caixa.has('intruso')).toBe(false);
  });

  test('id desconhecido é ignorado', () => {
    const { mesa, caixa } = mesaComHumanoNaVez();
    mesa.acao('intruso', { tipo: 'jogar', indice: 0 });
    expect(caixa.has('intruso')).toBe(false);
  });
});
