import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { todasAcoesValidas } from '../src/acoes';
import { amostrarMundo } from '../src/bots/dificil';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import { type Cadeira, type EstadoPartida, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { embaralhar, mulberry32 } from '../src/rng';
import { visaoDoJogador } from '../src/visao';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida } from './helpers';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

function cartasDoMundo(s: EstadoPartida): Carta[] {
  const m = s.mao!;
  return [...m.maos.flat(), ...m.mesa.map((j) => j.carta), ...m.rodadasJogadas.flat().map((j) => j.carta), ...(m.vira ? [m.vira] : [])];
}

function estadoAleatorio(seed: number): EstadoPartida | null {
  const rand = mulberry32(seed);
  const regras = rand() < 0.5 ? PAULISTA : MINEIRO;
  let s = reduce(novaPartida(regras), { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), rand) });
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
