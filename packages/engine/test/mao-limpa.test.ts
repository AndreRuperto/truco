import { describe, expect, test } from 'vitest';
import { distribuirSemRitual } from '../src/atalhos';
import { amostrarMundo } from '../src/bots/dificil';
import { botFacil } from '../src/bots/facil';
import { baralhoDaMesa, idCarta, novoBaralho } from '../src/cartas';
import { ErroJogada, reduce } from '../src/reducer';
import { REGRAS_RANQUEADA } from '../src/regras';
import { embaralhar, mulberry32 } from '../src/rng';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, MINEIRO_LIMPA, PAULISTA, c, distribuida, jogarSeq, partida } from './helpers';

const ESPERADO_LIMPA = [
  ...['Q', 'J', 'K', 'A', '2', '3'].flatMap((v) => ['o', 'e', 'c', 'p'].map((n) => `${v}${n}`)),
  '4p',
  '7c',
  '7o',
  'Cc',
  'Cp',
].sort();

describe('baralhoDaMesa', () => {
  test('mão limpa no mineiro: Q a 3, as manilhas 4♣/7♥/7♦ e 2 coringas (29 cartas)', () => {
    const b = baralhoDaMesa(MINEIRO_LIMPA);
    expect(b).toHaveLength(29);
    expect(b.map(idCarta).sort()).toEqual(ESPERADO_LIMPA);
  });

  test('sem mão limpa (ou no paulista) é o baralho de 40', () => {
    expect(baralhoDaMesa(MINEIRO)).toEqual(novoBaralho());
    expect(baralhoDaMesa(PAULISTA)).toEqual(novoBaralho());
    expect(baralhoDaMesa({ ...PAULISTA, maoLimpa: true })).toEqual(novoBaralho());
  });

  test('devolve cópia nova a cada chamada', () => {
    const a = baralhoDaMesa(MINEIRO_LIMPA);
    a[0].valor = '4';
    expect(baralhoDaMesa(MINEIRO_LIMPA)[0].valor).not.toBe('4');
  });

  test('ranqueada não usa mão limpa', () => {
    expect(REGRAS_RANQUEADA.mineiro.maoLimpa).toBe(false);
    expect(REGRAS_RANQUEADA.paulista.maoLimpa).toBe(false);
  });
});

describe('o monte valida contra o baralho da mesa', () => {
  test('mão limpa aceita as 29 cartas embaralhadas', () => {
    const b = embaralhar(baralhoDaMesa(MINEIRO_LIMPA), mulberry32(3));
    const s = distribuirSemRitual(partida(MINEIRO_LIMPA), b);
    expect(s.mao!.maos.flat()).toHaveLength(12);
    expect(s.mao!.vira).toBeNull();
  });

  test('mão limpa recusa o baralho de 40; mesa normal recusa o de 29 e o coringa', () => {
    expect(() => reduce(partida(MINEIRO_LIMPA), { tipo: 'monte', baralho: novoBaralho() })).toThrow(ErroJogada);
    expect(() => reduce(partida(MINEIRO), { tipo: 'monte', baralho: baralhoDaMesa(MINEIRO_LIMPA) })).toThrow(ErroJogada);
    const comCoringa = novoBaralho();
    comCoringa[0] = c('Cc');
    expect(() => reduce(partida(MINEIRO), { tipo: 'monte', baralho: comCoringa })).toThrow(ErroJogada);
  });

  test('mão limpa recusa carta que saiu do baralho (4 a 7 comuns)', () => {
    const b = baralhoDaMesa(MINEIRO_LIMPA);
    b[0] = c('5o');
    expect(() => reduce(partida(MINEIRO_LIMPA), { tipo: 'monte', baralho: b })).toThrow(ErroJogada);
  });
});

describe('coringa em jogo', () => {
  test('coringa contra coringa canga; coringa vence o 3', () => {
    const s = jogarSeq(
      distribuida(MINEIRO_LIMPA, [['Cc', 'Qe', 'Je'], ['3o', 'Ke', 'Ae'], ['Qo', 'Jo', 'Ko'], ['Cp', 'Qc', 'Jc']]),
      [[0, 0], [1, 0], [2, 0], [3, 0]],
    );
    expect(s.mao!.rodadas).toEqual(['empate']);
    const t = jogarSeq(
      distribuida(MINEIRO_LIMPA, [['Cc', 'Qe', 'Je'], ['3o', 'Ke', 'Ae'], ['Qo', 'Jo', 'Ko'], ['3e', 'Qc', 'Jc']]),
      [[0, 0], [1, 0], [2, 0], [3, 0]],
    );
    expect(t.mao!.rodadas).toEqual([0]);
  });

  test('qualquer manilha vence o coringa', () => {
    const s = jogarSeq(
      distribuida(MINEIRO_LIMPA, [['Cc', 'Qe', 'Je'], ['7o', 'Ke', 'Ae'], ['Qo', 'Jo', 'Ko'], ['Cp', 'Qc', 'Jc']]),
      [[0, 0], [1, 0], [2, 0], [3, 0]],
    );
    expect(s.mao!.rodadas).toEqual([1]);
  });

  test('coringa pode ir coberto (força 0) a partir da 2ª rodada', () => {
    const s = jogarSeq(
      distribuida(MINEIRO_LIMPA, [['4p', 'Cc', 'Je'], ['3o', 'Ke', 'Ae'], ['Qo', 'Jo', 'Ko'], ['Cp', 'Qc', 'Jc']]),
      [[0, 0], [1, 0], [2, 0], [3, 0]],
    );
    const t = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0, coberta: true });
    expect(t.mao!.mesa[0]).toMatchObject({ carta: c('Cc'), coberta: true, forca: 0 });
    expect(visaoDoJogador(t, 1).mao!.mesa[0].carta).toBeNull();
  });

  test('botFacil corre de truco só com coringa e aceita com manilha', () => {
    const s = reduce(
      distribuida(MINEIRO_LIMPA, [['3e', 'Qe', 'Je'], ['Cc', 'Cp', '3o'], ['Qo', 'Jo', 'Ko'], ['7o', 'Qc', 'Jc']]),
      { tipo: 'truco', cadeira: 0 },
    );
    expect(botFacil(s, 1)).toEqual({ tipo: 'correr', cadeira: 1 });
    expect(botFacil(s, 3)).toEqual({ tipo: 'aceitar', cadeira: 3 });
  });

  test('amostrarMundo só sorteia cartas do baralho da mão limpa', () => {
    const permitidas = new Set(baralhoDaMesa(MINEIRO_LIMPA).map(idCarta));
    for (let seed = 1; seed <= 50; seed++) {
      const rand = mulberry32(seed);
      const s = distribuirSemRitual(partida(MINEIRO_LIMPA), embaralhar(baralhoDaMesa(MINEIRO_LIMPA), rand));
      const mundo = amostrarMundo(visaoDoJogador(s, 0), rand);
      const ids = mundo.mao!.maos.flat().map(idCarta);
      expect(ids.every((id) => permitidas.has(id))).toBe(true);
      expect(new Set(ids).size).toBe(12);
    }
  });
});
