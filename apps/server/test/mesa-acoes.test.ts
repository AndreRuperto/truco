import { baralhoDaMesa, idCarta, REGRAS_RANQUEADA } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { avancarAte, criarMesa, vezDeJogar } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function mesaComHumanoNaVez() {
  const t = criarMesa();
  t.mesa.sentar('a', 'Ana');
  avancarAte(() => vezDeJogar(t));
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

  test('mão limpa: distribui do baralho de 29 cartas da mesa', () => {
    const regras = { ...REGRAS_RANQUEADA.mineiro, maoLimpa: true };
    const permitidas = new Set(baralhoDaMesa(regras).map(idCarta));
    const { mesa, estado, de } = criarMesa({ regras });
    mesa.sentar('a', 'Ana');
    avancarAte(() => !!estado('a')?.visao?.mao);
    const mao = estado('a')!.visao!.mao!.minhaMao;
    expect(mao).toHaveLength(3);
    expect(mao.every((c) => c !== null && permitidas.has(idCarta(c)))).toBe(true);
    expect(estado('a')!.regras.maoLimpa).toBe(true);
    expect(de('a', 'erro')).toHaveLength(0);
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

  test('cliente não pode pôr o monte', () => {
    const { mesa, de } = mesaComHumanoNaVez();
    mesa.acao('a', { tipo: 'monte', baralho: [] });
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
