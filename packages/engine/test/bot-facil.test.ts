import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import { botFacil } from '../src/bots/facil';
import { baralhoDaMesa } from '../src/cartas';
import { type Cadeira, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { completarSorte } from '../src/ritual';
import { embaralhar, mulberry32 } from '../src/rng';
import { MAOS_DUPLA0_VENCE, MINEIRO, MINEIRO_LIMPA, PAULISTA, distribuida, jogarPrimeiraRodada } from './helpers';

describe('botFacil', () => {
  test('aceita truco com manilha, corre sem', () => {
    // Truco só a partir da 2ª rodada: a dupla 0 vence a 1ª e a cadeira 0 truca.
    // mineiro: cad1 fica com [5e,6e] sem manilha; cad3 com [5c,6c] sem manilha
    const s = reduce(jogarPrimeiraRodada(distribuida(MINEIRO, MAOS_DUPLA0_VENCE)), { tipo: 'truco', cadeira: 0 });
    expect(botFacil(s, 1)).toEqual({ tipo: 'correr', cadeira: 1 });
    // cad1 joga o 5o na 1ª rodada (o 3e da cadeira 0 vence) e guarda o zap 4p
    const r2 = jogarPrimeiraRodada(
      distribuida(MINEIRO, [['3e', '5e', '6e'], ['4p', '5o', '6o'], ['Qo', 'Jo', 'Ko'], ['2e', '5c', '6c']]),
      [0, 1, 0, 0],
    );
    expect(r2.mao!.vez).toBe(0);
    const s2 = reduce(r2, { tipo: 'truco', cadeira: 0 });
    expect(botFacil(s2, 1)).toEqual({ tipo: 'aceitar', cadeira: 1 });
  });

  test('não age fora da vez', () => {
    expect(botFacil(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), 1)).toBeNull();
  });

  test('sempre devolve ação válida e 4 bots terminam a partida', () => {
    for (const regras of [PAULISTA, MINEIRO, MINEIRO_LIMPA]) {
      const rand = mulberry32(123);
      let s = novaPartida(regras);
      for (let passos = 0; s.fase !== 'fimPartida'; passos++) {
        if (passos > 2000) throw new Error('não terminou');
        if (s.fase === 'aguardandoMonte') {
          s = reduce(s, { tipo: 'monte', baralho: embaralhar(baralhoDaMesa(regras), rand) });
          continue;
        }
        const acao = ([0, 1, 2, 3] as Cadeira[]).map((c) => botFacil(s, c)).find((a) => a !== null);
        expect(acao).toBeDefined();
        expect(acoesValidas(s, acao!.cadeira)).toContainEqual(acao);
        s = reduce(s, completarSorte(acao!, s, rand));
      }
      expect(s.vencedor).not.toBeNull();
    }
  });
});
