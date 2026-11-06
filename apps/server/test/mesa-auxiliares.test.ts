import { type EstadoPartida, novaPartida, novoBaralho, reduce, REGRAS_RANQUEADA } from '@truco/engine';
import { distribuirSemRitual } from '@truco/engine/testes';
import { describe, expect, test } from 'vitest';
import { jogadaAutomatica } from '../src/mesa/Mesa';

/**
 * Baralho na ordem de novoBaralho() com pe = 3:
 * cad0 = 4o 5o 6o, cad1 = 4e 5e 6e, cad2 = 4c 5c 6c, cad3 = 4p(zap) 5p 6p.
 */
function inicio(placar: [number, number] = [0, 0]): EstadoPartida {
  const s = novaPartida(REGRAS_RANQUEADA.mineiro, 3);
  s.placar = placar;
  return distribuirSemRitual(s, novoBaralho());
}

describe('jogadaAutomatica', () => {
  test('no ritual: embaralha até 3 vezes e passa; corta e devolve; dá por cima; não confere', () => {
    let s = reduce(novaPartida(REGRAS_RANQUEADA.mineiro, 3), { tipo: 'monte', baralho: novoBaralho() });
    expect(jogadaAutomatica(s, 3)).toEqual({ tipo: 'embaralhar', cadeira: 3 });
    s.ritual!.embaralhadas = 3;
    expect(jogadaAutomatica(s, 3)).toEqual({ tipo: 'passarCorte', cadeira: 3 });
    s = reduce(s, { tipo: 'passarCorte', cadeira: 3 });
    expect(jogadaAutomatica(s, 2)).toEqual({ tipo: 'cortar', cadeira: 2 });
    s = reduce(s, { tipo: 'cortar', cadeira: 2, ponto: 20 });
    expect(jogadaAutomatica(s, 2)).toEqual({ tipo: 'devolver', cadeira: 2 });
    s = reduce(s, { tipo: 'devolver', cadeira: 2 });
    expect(jogadaAutomatica(s, 3)).toEqual({ tipo: 'distribuir', cadeira: 3, modo: 'porCima' });
    const f = reduce(inicio(), { tipo: 'familia', cadeira: 0 });
    expect(jogadaAutomatica(f, 1)).toEqual({ tipo: 'conferir', cadeira: 1, conferir: false });
  });

  test('joga a carta mais fraca', () => {
    let s = inicio();
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 2 }); // 6o
    s = reduce(s, { tipo: 'jogar', cadeira: 1, indice: 0 }); // 4e
    s = reduce(s, { tipo: 'jogar', cadeira: 2, indice: 0 }); // 4c
    // cad3 tem 4p (zap, 14), 5p (2), 6p (3) → mais fraca é 5p (índice 1)
    expect(jogadaAutomatica(s, 3)).toEqual({ tipo: 'jogar', cadeira: 3, indice: 1 });
  });
  test('corre do truco e da mão de 10', () => {
    expect(jogadaAutomatica(reduce(inicio(), { tipo: 'truco', cadeira: 0 }), 1)).toEqual({ tipo: 'correr', cadeira: 1 });
    expect(jogadaAutomatica(inicio([4, 10]), 3)).toEqual({ tipo: 'mao10', cadeira: 3, jogar: false });
  });
});
