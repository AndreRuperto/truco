import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { chaveRegras, opcoesDaSala } from '../src/mesa/protocolo';
import { REGRAS_RANQUEADA } from '@truco/engine';
import { criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const VISUAL = (moldura: string) => ({ verso: { cor: '#000', linha: '#fff', estampa: 'losango' }, roupa: {}, moldura }) as never;

describe('regra "Provocações" (opções da sala)', () => {
  test('padrão ligada; a mesa pode desligar; na ranqueada sempre desligada', () => {
    expect(opcoesDaSala({}).provocacoes).toBe(true);
    expect(opcoesDaSala({ provocacoes: false }).provocacoes).toBe(false);
    expect(opcoesDaSala({ modo: 'ranqueada', provocacoes: true }).provocacoes).toBe(false);
  });

  test('chave: igual à de hoje quando ligada; prov:0 quando desligada', () => {
    const r = REGRAS_RANQUEADA.paulista;
    expect(chaveRegras(r, 0, 20, true, true)).toBe(chaveRegras(r, 0, 20, true));
    expect(chaveRegras(r, 0, 20, true, false)).toBe(`${chaveRegras(r, 0, 20, true)}|prov:0`);
  });
});

describe('Mesa.provocar', () => {
  function mesaCom2(extra = {}) {
    const t = criarMesa({ humanosEsperados: 2, modo: 'privada', ...extra });
    t.mesa.sentar('a', 'Ana', undefined, null, null, VISUAL('corda'));
    t.mesa.sentar('b', 'Bia');
    return t;
  }

  test('manda a todos os humanos quem provocou, o alvo e o efeito da moldura de quem provocou', () => {
    const t = mesaCom2();
    const bia = t.estado('a')!.cadeiras.findIndex((c) => c.nome === 'Bia');
    t.mesa.provocar('a', bia as never);
    const esperado = { de: t.estado('a')!.minhaCadeira, para: bia, efeito: 'laco' };
    expect(t.de('a', 'provocacao').at(-1)).toMatchObject(esperado);
    expect(t.de('b', 'provocacao').at(-1)).toMatchObject(esperado);
    expect(typeof t.de('a', 'provocacao').at(-1).id).toBe('number');
  });

  test('efeito de cada moldura; sem moldura (e convidado) é o guardanapo', () => {
    const efeitos: Record<string, string> = { nenhuma: 'guardanapo', corda: 'laco', madeira: 'farpa', neon: 'ofusca', giz: 'po-de-giz' };
    for (const [moldura, efeito] of Object.entries(efeitos)) {
      const t = criarMesa({ humanosEsperados: 2, modo: 'privada' });
      t.mesa.sentar('a', 'Ana', undefined, null, null, VISUAL(moldura));
      t.mesa.sentar('b', 'Bia');
      t.mesa.provocar('a', 1);
      expect(t.de('b', 'provocacao').at(-1)?.efeito, moldura).toBe(efeito);
    }
    const t = mesaCom2();
    t.mesa.provocar('b', 0);
    expect(t.de('a', 'provocacao').at(-1)?.efeito).toBe('guardanapo');
  });

  test('não provoca a si mesmo, cadeira vazia, alvo inválido nem quem não está sentado', () => {
    // Sala de espera com lugar sobrando (3 humanos esperados, 2 sentados).
    const t = criarMesa({ humanosEsperados: 3, modo: 'privada' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    const ana = t.estado('a')!.minhaCadeira;
    const vazia = t.estado('a')!.cadeiras.findIndex((c) => c.tipo === 'vazia');
    expect(vazia).toBeGreaterThanOrEqual(0);
    t.mesa.provocar('a', ana);
    t.mesa.provocar('a', vazia as never);
    t.mesa.provocar('a', 7 as never);
    t.mesa.provocar('a', 'x' as never);
    t.mesa.provocar('zz', 1);
    expect(t.de('a', 'provocacao')).toEqual([]);
  });

  test('provoca bot (na partida, o resto das cadeiras é bot)', () => {
    const t = criarMesa({ humanosEsperados: 1 });
    t.mesa.sentar('a', 'Ana');
    vi.advanceTimersByTime(50);
    t.mesa.provocar('a', 1);
    expect(t.de('a', 'provocacao').at(-1)).toMatchObject({ de: 0, para: 1 });
  });

  test('regra desligada: nada sai e avisa quem tentou', () => {
    const t = mesaCom2({ provocacoes: false });
    t.mesa.provocar('a', 1);
    expect(t.de('b', 'provocacao')).toEqual([]);
    expect(t.de('a', 'erro').at(-1)).toEqual({ mensagem: 'provocações desligadas nesta mesa' });
  });

  test('ranqueada: nunca', () => {
    const t = mesaCom2({ modo: 'ranqueada', provocacoes: true });
    t.mesa.provocar('a', 1);
    expect(t.de('b', 'provocacao')).toEqual([]);
  });

  test('limite: uma a cada 8 s por jogador', () => {
    const t = mesaCom2();
    t.mesa.provocar('a', 1);
    vi.advanceTimersByTime(7_999);
    t.mesa.provocar('a', 1);
    expect(t.de('b', 'provocacao')).toHaveLength(1);
    expect(t.de('a', 'erro').at(-1)).toEqual({ mensagem: 'calma: espere um pouco para provocar de novo' });
    vi.advanceTimersByTime(1);
    t.mesa.provocar('a', 1);
    expect(t.de('b', 'provocacao')).toHaveLength(2);
  });

  test('limite: no máximo 3 por minuto no mesmo alvo vindas da mesma pessoa', () => {
    const t = criarMesa({ humanosEsperados: 3, modo: 'privada' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    t.mesa.sentar('c', 'Cid');
    const bia = t.estado('a')!.cadeiras.findIndex((c) => c.nome === 'Bia');
    const cid = t.estado('a')!.cadeiras.findIndex((c) => c.nome === 'Cid');
    for (let i = 0; i < 4; i++) {
      t.mesa.provocar('a', bia as never);
      vi.advanceTimersByTime(8_000);
    }
    expect(t.de('b', 'provocacao').filter((p) => p.para === bia)).toHaveLength(3);
    t.mesa.provocar('a', cid as never);
    expect(t.de('c', 'provocacao').filter((p) => p.para === cid)).toHaveLength(1);
    vi.advanceTimersByTime(60_000);
    t.mesa.provocar('a', bia as never);
    expect(t.de('b', 'provocacao').filter((p) => p.para === bia)).toHaveLength(4);
  });

  test('o estado conta a regra para o cliente esconder o botão', () => {
    expect(mesaCom2().estado('a')!.provocacoes).toBe(true);
    expect(mesaCom2({ provocacoes: false }).estado('a')!.provocacoes).toBe(false);
    expect(mesaCom2({ modo: 'ranqueada' }).estado('a')!.provocacoes).toBe(false);
  });
});
