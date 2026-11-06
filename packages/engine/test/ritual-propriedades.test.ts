import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { acoesValidas, todasAcoesValidas } from '../src/acoes';
import { baralhoDaMesa, idCarta } from '../src/cartas';
import { type Cadeira, novaPartida } from '../src/estado';
import { ehFamilia, fechadasUsadas, tipoDaProximaFamilia } from '../src/familia';
import { escada, reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import { cartasDaPartida, completarSorte, LIMITE_FAMILIAS_FECHADAS } from '../src/ritual';
import { embaralhar, mulberry32 } from '../src/rng';
import { quemDeveAgir } from '../src/vez';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, MINEIRO_LIMPA, PAULISTA } from './helpers';

const TODAS_REGRAS: RegrasMesa[] = [
  PAULISTA,
  MINEIRO,
  { ...PAULISTA, pontuacao: '2-4-8-10-12', maoDe10: true, familia: 'aberta' },
  { ...PAULISTA, familia: 'fechada', maoDe11: 'onzeAOnze' },
  { ...MINEIRO, pontuacao: '1-3-6-9-12', maoDe11: 'onzeAOnze', familia: 'off' },
  MINEIRO_LIMPA,
  { ...MINEIRO_LIMPA, familia: 'aberta', maoDe11: 'qualquerDupla' },
];
const CADEIRAS: Cadeira[] = [0, 1, 2, 3];
const conservou = (s: Parameters<typeof cartasDaPartida>[0], regras: RegrasMesa) =>
  expect(cartasDaPartida(s).map(idCarta).sort()).toEqual(baralhoDaMesa(regras).map(idCarta).sort());

describe('propriedades do ritual', () => {
  test('partidas inteiras com ritual aleatório: as cartas se conservam, ninguém vê o monte, terminam', () => {
    const vistas = new Map<string, number>();
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...TODAS_REGRAS), (seed, regras) => {
        const rand = mulberry32(seed);
        const baralho = baralhoDaMesa(regras).map(idCarta).sort();
        let s = reduce(novaPartida(regras, (Math.abs(seed) % 4) as Cadeira), {
          tipo: 'monte',
          baralho: embaralhar(baralhoDaMesa(regras), rand),
        });
        for (let passos = 0; s.fase !== 'fimPartida'; passos++) {
          if (passos > 20_000) throw new Error('partida não terminou');
          const acoes = todasAcoesValidas(s);
          expect(acoes.length).toBeGreaterThan(0);
          expect(quemDeveAgir(s).length).toBeGreaterThan(0);
          const antes = [...s.placar];
          // Família e conferir saem com mais frequência que o sorteio uniforme, para a amostra
          // passar pelo limite de fechadas, pela conferência e pelo fim de partida por família.
          const especiais = acoes.filter((x) => x.tipo === 'familia' || (x.tipo === 'conferir' && x.conferir));
          const a =
            especiais.length > 0 && rand() < 0.8
              ? especiais[Math.floor(rand() * especiais.length)]
              : acoes[Math.floor(rand() * acoes.length)];
          const ver = (k: string) => vistas.set(k, (vistas.get(k) ?? 0) + 1);
          ver(`${a.tipo}:${regras.maoLimpa ? 'limpa' : 'cheia'}`);
          if (a.tipo === 'conferir') {
            const m = s.mao!;
            ver(a.conferir ? `conferir:true:${ehFamilia(m.familias[m.familiaPendente!].cartas) ? 'real' : 'blefe'}` : 'conferir:false');
          }
          if (a.tipo === 'familia' && regras.familia === 'fechada' && tipoDaProximaFamilia(s) === 'aberta') ver('familia:aberta');
          s = reduce(s, completarSorte(a, s, rand));
          if (a.tipo === 'conferir' && !s.mao && s.ultimaMao?.motivo === 'familia') ver('fim:familia');
          for (const d of [0, 1] as const) {
            const delta = s.placar[d] - antes[d];
            if (delta !== 0) expect(escada(s)).toContain(delta);
          }
          expect(cartasDaPartida(s).map(idCarta).sort()).toEqual(baralho);
          if (s.mao) {
            const m = s.mao;
            expect(fechadasUsadas(m)).toBeLessThanOrEqual(LIMITE_FAMILIAS_FECHADAS);
            expect(m.maos.flat().length + m.mesa.length + m.rodadasJogadas.flat().length).toBe(12);
          }
          if (passos % 7 === 0) {
            for (const c of CADEIRAS) {
              const v = visaoDoJogador(s, c);
              expect('monte' in v).toBe(false);
              expect(v.qtdMonte).toBe(s.monte.length);
            }
          }
        }
        expect(s.vencedor).not.toBeNull();
        expect(Math.max(...s.placar)).toBeGreaterThanOrEqual(12);
        expect(cartasDaPartida(s).map(idCarta).sort()).toEqual(baralho);
      }),
      // Semente fixa: a amostra precisa cobrir casos raros (abaixo); sem ela o teste poderia oscilar.
      { numRuns: 80, seed: 20261105 },
    );
    // A amostra precisa ter passado por abrir 3 / dar 3 e pela família, com baralho cheio e com mão limpa.
    for (const tipo of ['abrir3', 'dar3', 'familia']) {
      expect(vistas.get(`${tipo}:cheia`) ?? 0).toBeGreaterThan(0);
      expect(vistas.get(`${tipo}:limpa`) ?? 0).toBeGreaterThan(0);
    }
    // Conferência (real e blefe), deixar passar, aberta depois do limite e fim de partida por família.
    for (const k of ['conferir:true:real', 'conferir:true:blefe', 'conferir:false', 'familia:aberta', 'fim:familia']) {
      expect(vistas.get(k) ?? 0, k).toBeGreaterThan(0);
    }
  }, 180_000);

  test.each([
    ['baralho cheio', MINEIRO],
    ['mão limpa', MINEIRO_LIMPA],
  ])('abrir 3 e dar 3 conservam as cartas em cada passo até a mão seguinte (%s)', (_nome, regras) => {
    for (const corte of ['abrir3', 'dar3'] as const) {
      const rand = mulberry32(corte === 'abrir3' ? 5 : 6);
      let s = reduce(novaPartida(regras, 3), { tipo: 'monte', baralho: embaralhar(baralhoDaMesa(regras), rand) });
      const passos = [
        { tipo: 'embaralhar', cadeira: 3 },
        { tipo: 'passarCorte', cadeira: 3 },
        { tipo: corte, cadeira: 2 },
        { tipo: 'distribuir', cadeira: 3, modo: 'porBaixo' },
      ] as const;
      for (const a of passos) {
        s = reduce(s, completarSorte(a, s, rand));
        conservou(s, regras);
      }
      if (corte === 'abrir3') expect(s.mao!.abertasNoCorte).toHaveLength(3);
      else expect(s.mao!.pulada).toBe(0);
      expect(s.mao!.maos.flat()).toHaveLength(12);
      // Truco só a partir da 2ª rodada: joga a 1ª (primeira carta válida de cada um), conferindo as cartas.
      for (let k = 0; k < 4; k++) {
        const jogada = acoesValidas(s, s.mao!.vez).find((a) => a.tipo === 'jogar')!;
        s = reduce(s, jogada);
        conservou(s, regras);
      }
      expect(s.mao!.rodadas).toHaveLength(1);
      // Cangou: todos empilham (a carta de índice 0 por cima).
      if (s.fase === 'empilhando') {
        for (const c of [0, 1, 2, 3] as Cadeira[]) s = reduce(s, { tipo: 'empilhar', cadeira: c, indice: 0 });
        conservou(s, regras);
      }
      s = reduce(reduce(s, { tipo: 'truco', cadeira: s.mao!.vez }), { tipo: 'correr', cadeira: ((s.mao!.vez + 1) % 4) as Cadeira });
      expect(s.mao).toBeNull();
      conservou(s, regras);
    }
  });
});
