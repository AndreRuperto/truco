import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import { botFacil } from '../src/bots/facil';
import { baralhoDaMesa } from '../src/cartas';
import { type Cadeira, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { embaralhar, mulberry32 } from '../src/rng';
import { MAOS_DUPLA0_VENCE, MINEIRO, MINEIRO_LIMPA, PAULISTA, avancarSemJogadas, distribuida } from './helpers';

describe('botFacil', () => {
  test('aceita truco com manilha, corre sem', () => {
    // mineiro: cad1 = [3e,5e,6e] sem manilha; cad3 = [2e,5c,6c] sem manilha
    const s = reduce(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), { tipo: 'truco', cadeira: 0 });
    expect(botFacil(s, 1)).toEqual({ tipo: 'correr', cadeira: 1 });
    const s2 = reduce(
      distribuida(MINEIRO, [['3e', '5e', '6e'], ['4p', '5o', '6o'], ['Qo', 'Jo', 'Ko'], ['2e', '5c', '6c']]),
      { tipo: 'truco', cadeira: 0 },
    );
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
        const semJogada = avancarSemJogadas(s, rand);
        if (semJogada) {
          s = semJogada;
          continue;
        }
        const acao = ([0, 1, 2, 3] as Cadeira[]).map((c) => botFacil(s, c)).find((a) => a !== null);
        expect(acao).toBeDefined();
        expect(acoesValidas(s, acao!.cadeira)).toContainEqual(acao);
        s = reduce(s, acao!);
      }
      expect(s.vencedor).not.toBeNull();
    }
  });
});
