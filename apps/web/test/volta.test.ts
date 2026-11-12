import { describe, expect, test } from 'vitest';
import { resumoDaVolta } from '../src/logica/volta';
import { distribuida, jogar, msgEstado, PAULISTA } from './fixtures';

/**
 * Ciclo 4 (aviso na volta): depois de uma queda, a mesa pulava para o estado novo sem contar o
 * que aconteceu. O resumo compara o último estado visto com o novo e diz uma frase só, a mais
 * importante, ou nada.
 */
describe('resumoDaVolta', () => {
  const inicio = distribuida(PAULISTA, undefined, [2, 4]);

  test('nada mudou: sem aviso', () => {
    expect(resumoDaVolta(msgEstado(inicio), msgEstado(inicio))).toBeNull();
  });

  test('placar mudou: mostra o antes e o depois, do ponto de vista de quem volta', () => {
    const depois = distribuida(PAULISTA, undefined, [3, 4]);
    expect(resumoDaVolta(msgEstado(inicio), msgEstado(depois))).toBe('Enquanto você esteve fora: Nós 2 → 3, Eles 4 → 4.');
    // Cadeira 1 é da outra dupla: o mesmo placar lido ao contrário.
    expect(resumoDaVolta(msgEstado(inicio, 1), msgEstado(depois, 1))).toBe('Enquanto você esteve fora: Nós 4 → 4, Eles 2 → 3.');
  });

  test('mesma mão com cartas a menos: o prazo correu e jogou por você', () => {
    const depois = jogar(inicio, [[inicio.mao!.vez, 0]]);
    const quem = inicio.mao!.vez;
    expect(resumoDaVolta(msgEstado(inicio, quem), msgEstado(depois, quem))).toBe(
      'Enquanto você esteve fora, o prazo da sua vez acabou e 1 carta foi jogada por você.',
    );
  });

  test('a partida terminou fora: diz isso, e não o placar', () => {
    const fim = { ...distribuida(PAULISTA, undefined, [12, 4]), fase: 'fimPartida' as const, vencedor: 0 as const };
    expect(resumoDaVolta(msgEstado(inicio), msgEstado(fim))).toBe('A partida terminou enquanto você esteve fora.');
  });

  test('sem partida em algum dos lados (sala de espera): sem aviso', () => {
    expect(resumoDaVolta(msgEstado(null), msgEstado(inicio))).toBeNull();
    expect(resumoDaVolta(msgEstado(inicio), msgEstado(null))).toBeNull();
  });
});
