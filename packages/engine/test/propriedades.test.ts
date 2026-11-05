import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { acoesValidas, todasAcoesValidas } from '../src/acoes';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import { type EstadoPartida, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import { embaralhar, mulberry32 } from '../src/rng';
import { MINEIRO, PAULISTA, distribuida, MAOS_DUPLA0_VENCE } from './helpers';

const TODAS_REGRAS: RegrasMesa[] = [
  PAULISTA,
  MINEIRO,
  { ...PAULISTA, pontuacao: '2-4-8-10-12', maoDe10: true, familia: 'aberta' },
  { ...MINEIRO, pontuacao: '1-3-6-9-12', maoDe11: 'onzeAOnze', familia: 'off' },
];

function cartasEmJogo(s: EstadoPartida): Carta[] {
  const m = s.mao;
  if (!m) return [];
  return [
    ...m.maos.flat(),
    ...m.mesa.map((j) => j.carta),
    ...m.rodadasJogadas.flat().map((j) => j.carta),
    ...(m.vira ? [m.vira] : []),
  ];
}

describe('acoesValidas', () => {
  test('início da mão: só quem está na vez joga ou truca', () => {
    const acoes = todasAcoesValidas(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p'));
    expect(acoes.every((a) => a.cadeira === 0)).toBe(true);
    expect(acoes.filter((a) => a.tipo === 'jogar')).toHaveLength(3);
    expect(acoes.some((a) => a.tipo === 'truco')).toBe(true);
  });

  test('por cadeira: só devolve ações da cadeira pedida', () => {
    const s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p');
    expect(acoesValidas(s, 1)).toEqual([]);
    expect(acoesValidas(s, 0)).toEqual(todasAcoesValidas(s));
    const t = reduce(s, { tipo: 'truco', cadeira: 0 });
    expect(acoesValidas(t, 0)).toEqual([]);
    expect(acoesValidas(t, 3).every((a) => a.cadeira === 3)).toBe(true);
    expect(acoesValidas(t, 3).map((a) => a.tipo).sort()).toEqual(['aceitar', 'aumentar', 'correr']);
  });

  test('cadeira é obrigatória', () => {
    const s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p');
    // @ts-expect-error sem cadeira devolveria ações de todos (vazamento)
    expect(() => acoesValidas(s)).toThrow();
  });
});

describe('propriedades: partidas aleatórias', () => {
  test('sempre terminam, sem cartas duplicadas e com placar monotônico', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...TODAS_REGRAS), (seed, regras) => {
        const rand = mulberry32(seed);
        let s = novaPartida(regras);
        let passos = 0;
        while (s.fase !== 'fimPartida') {
          if (++passos > 5000) throw new Error('partida não terminou');
          if (s.fase === 'aguardandoDistribuicao') {
            s = reduce(s, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), rand) });
          } else {
            const acoes = todasAcoesValidas(s);
            expect(acoes.length).toBeGreaterThan(0);
            const antes = [...s.placar];
            s = reduce(s, acoes[Math.floor(rand() * acoes.length)]);
            expect(s.placar[0]).toBeGreaterThanOrEqual(antes[0]);
            expect(s.placar[1]).toBeGreaterThanOrEqual(antes[1]);
          }
          const ids = cartasEmJogo(s).map(idCarta);
          expect(new Set(ids).size).toBe(ids.length);
        }
        expect(Math.max(...s.placar)).toBeGreaterThanOrEqual(12);
        expect(s.vencedor).not.toBeNull();
      }),
      { numRuns: 200 },
    );
  }, 30_000);
});
