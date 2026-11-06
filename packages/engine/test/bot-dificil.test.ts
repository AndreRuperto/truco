import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { distribuirSemRitual } from '../src/testes';
import { acoesValidas, todasAcoesValidas } from '../src/acoes';
import { amostrarMundo, botDificil } from '../src/bots/dificil';
import { baralhoDaMesa, type Carta, idCarta } from '../src/cartas';
import { type Cadeira, type EstadoPartida, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { completarSorte } from '../src/ritual';
import { embaralhar, mulberry32 } from '../src/rng';
import { visaoDoJogador } from '../src/visao';
import { MAOS_DUPLA0_VENCE, MINEIRO, MINEIRO_LIMPA, PAULISTA, c, distribuida, jogarSeq } from './helpers';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

function cartasDoMundo(s: EstadoPartida): Carta[] {
  const m = s.mao!;
  return [...m.maos.flat(), ...m.mesa.map((j) => j.carta), ...m.rodadasJogadas.flat().map((j) => j.carta), ...(m.vira ? [m.vira] : [])];
}

function estadoAleatorio(seed: number): EstadoPartida | null {
  const rand = mulberry32(seed);
  const sorteio = rand();
  const regras = sorteio < 0.34 ? PAULISTA : sorteio < 0.67 ? MINEIRO : MINEIRO_LIMPA;
  let s = distribuirSemRitual(novaPartida(regras), embaralhar(baralhoDaMesa(regras), rand));
  const passos = Math.floor(rand() * 9);
  for (let i = 0; i < passos && s.mao; i++) {
    const acoes = todasAcoesValidas(s);
    if (acoes.length === 0) break;
    s = reduce(s, acoes[Math.floor(rand() * acoes.length)]);
  }
  return s.mao ? s : null;
}

function conferir(s: EstadoPartida, rand: () => number) {
  for (const cad of CADEIRAS) {
    const v = visaoDoJogador(s, cad);
    const mundo = amostrarMundo(v, rand);
    expect(visaoDoJogador(mundo, cad).mao).toEqual(v.mao);
    const ids = cartasDoMundo(mundo).map(idCarta);
    expect(new Set(ids).size).toBe(ids.length);
    expect(mundo.mao!.maos.map((m) => m.length)).toEqual(s.mao!.maos.map((m) => m.length));
  }
}

describe('amostrarMundo', () => {
  test('o mundo amostrado é indistinguível do real para quem olha', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const s = estadoAleatorio(seed);
        if (s) conferir(s, mulberry32(seed ^ 0x5eed));
      }),
      { numRuns: 150 },
    );
  });

  test('mão de 10 (vê o parceiro) e mão de 11 (não vê a própria)', () => {
    conferir(distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 0]), mulberry32(1));
    conferir(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 0]), mulberry32(2));
  });

  test('sem mão em andamento é erro', () => {
    expect(() => amostrarMundo(visaoDoJogador(novaPartida(MINEIRO), 0), mulberry32(1))).toThrow();
  });
});

describe('botDificil', () => {
  test('é determinístico para a mesma visão e seed', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    const v = visaoDoJogador(s, 0);
    expect(botDificil(v, mulberry32(9), { amostras: 6 })).toEqual(botDificil(v, mulberry32(9), { amostras: 6 }));
  });

  test('não age fora da vez', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(botDificil(visaoDoJogador(s, 1), mulberry32(1), { amostras: 4 })).toBeNull();
  });

  test('sempre devolve uma ação legal', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const s = estadoAleatorio(seed);
        if (!s) return;
        for (const cad of CADEIRAS) {
          const a = botDificil(visaoDoJogador(s, cad), mulberry32(seed), { amostras: 3 });
          const legais = acoesValidas(s, cad);
          // Pedir família é opcional: sem outra ação, o bot pode não fazer nada.
          const obrigatorias = legais.filter((x) => x.tipo !== 'familia');
          if (a === null) expect(obrigatorias).toEqual([]);
          else expect(legais).toContainEqual(a);
        }
      }),
      { numRuns: 40 },
    );
  }, 60_000);

  test('orçamento de tempo: para cedo, mas sempre faz o mínimo de amostras e joga legal', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    const v = visaoDoJogador(s, 0);
    const t0 = performance.now();
    const a = botDificil(v, mulberry32(3), { amostras: 100_000, orcamentoMs: 0, chanceBlefe: 0 });
    expect(performance.now() - t0).toBeLessThan(2_000);
    expect(acoesValidas(s, 0)).toContainEqual(a);
  });

  test('sem orçamento continua determinístico', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    const v = visaoDoJogador(s, 0);
    expect(botDificil(v, mulberry32(4), { amostras: 5, minAmostras: 2 })).toEqual(botDificil(v, mulberry32(4), { amostras: 5 }));
  });

  test.each([
    ['mineiro', MINEIRO],
    ['mineiro com mão limpa', MINEIRO_LIMPA],
  ])('quatro bots difíceis terminam uma partida (%s)', (_nome, regras) => {
    const rand = mulberry32(77);
    let s = novaPartida(regras);
    for (let passos = 0; s.fase !== 'fimPartida'; passos++) {
      if (passos > 6000) throw new Error('não terminou');
      if (s.fase === 'aguardandoMonte') {
        s = reduce(s, { tipo: 'monte', baralho: embaralhar(baralhoDaMesa(regras), rand) });
        continue;
      }
      const atual = s;
      const acao = CADEIRAS.map((c) => botDificil(visaoDoJogador(atual, c), rand, { amostras: 3 })).find((a) => a !== null);
      expect(acao).toBeDefined();
      s = reduce(s, completarSorte(acao!, s, rand));
    }
    expect(s.vencedor).not.toBeNull();
  }, 60_000);
});

describe('dica do parceiro', () => {
  // MAOS_DUPLA0_VENCE no mineiro: ninguém recebeu o 7♥ (copas); a cadeira 1 tem 3e 5e 6e; o parceiro dela é a 3.
  const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
  const v = visaoDoJogador(s, 1);

  test('a carta sinalizada vai para a mão do parceiro', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const mundo = amostrarMundo(v, mulberry32(seed), { parceiroTem: c('7c') });
      expect(mundo.mao!.maos[3].map(idCarta)).toContain('7c');
      expect(visaoDoJogador(mundo, 1).mao).toEqual(v.mao);
    }
  });

  test('sem dica, a carta só cai com o parceiro por acaso', () => {
    let vezes = 0;
    for (let seed = 1; seed <= 30; seed++) {
      if (amostrarMundo(v, mulberry32(seed)).mao!.maos[3].some((x) => idCarta(x) === '7c')) vezes++;
    }
    expect(vezes).toBeLessThan(30);
  });

  test('dica impossível é ignorada', () => {
    const naMinhaMao = amostrarMundo(v, mulberry32(1), { parceiroTem: c('3e') });
    expect(naMinhaMao.mao!.maos[1].map(idCarta)).toEqual(['3e', '5e', '6e']);
    expect(naMinhaMao.mao!.maos[3].map(idCarta)).not.toContain('3e');

    const s2 = jogarSeq(s, [[0, 0]]); // a cadeira 0 joga o zap (4p) aberto
    const jaJogada = amostrarMundo(visaoDoJogador(s2, 1), mulberry32(2), { parceiroTem: c('4p') });
    expect(jaJogada.mao!.maos[3].map(idCarta)).not.toContain('4p');
  });

  test('dica é ignorada se o parceiro já jogou carta coberta (pode ter sido a sinalizada)', () => {
    const coberta = (cadeira: Cadeira) => ({ cadeira, carta: null, coberta: true, forca: 0 });
    const comCoberta = (cadeira: Cadeira, onde: 'mesa' | 'rodadasJogadas') => {
      const x = structuredClone(v);
      x.mao!.qtdCartas[cadeira] -= 1;
      if (onde === 'mesa') x.mao!.mesa = [coberta(cadeira)];
      else x.mao!.rodadasJogadas = [[coberta(cadeira)]];
      return x;
    };
    const dica = { parceiroTem: c('7c') };
    for (const onde of ['mesa', 'rodadasJogadas'] as const) {
      const vp = comCoberta(3, onde);
      for (let seed = 1; seed <= 10; seed++) {
        expect(amostrarMundo(vp, mulberry32(seed), dica)).toEqual(amostrarMundo(vp, mulberry32(seed)));
      }
      // coberta de adversário não muda nada: a dica continua valendo
      const va = comCoberta(0, onde);
      for (let seed = 1; seed <= 10; seed++) {
        expect(amostrarMundo(va, mulberry32(seed), dica).mao!.maos[3].map(idCarta)).toContain('7c');
      }
    }
  });

  test('botDificil aceita a dica e continua legal e determinístico', () => {
    const v0 = visaoDoJogador(s, 0);
    const opcoes = { amostras: 8, dica: { parceiroTem: c('7c') } };
    const a = botDificil(v0, mulberry32(5), opcoes);
    expect(botDificil(v0, mulberry32(5), opcoes)).toEqual(a);
    expect(acoesValidas(s, 0)).toContainEqual(a);
  });
});
