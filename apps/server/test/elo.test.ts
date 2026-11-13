import { describe, expect, test } from 'vitest';
import { deltaElo, ELO_INICIAL, esperado, K_PADRAO, media, novosPontos, patenteDe, PATENTES, proximaPatente } from '../src/ranking/elo';
import { deltasDoFim } from '../src/ranking/resultado';

describe('Elo', () => {
  test('constantes', () => {
    expect(ELO_INICIAL).toBe(1000);
    expect(K_PADRAO).toBe(32);
  });

  test('esperado: 0,5 entre iguais e simétrico', () => {
    expect(esperado(1000, 1000)).toBe(0.5);
    expect(esperado(1200, 1000)).toBeCloseTo(0.7597, 4);
    expect(esperado(1200, 1000) + esperado(1000, 1200)).toBeCloseTo(1, 10);
  });

  test('delta arredondado: ±16 entre iguais; favorito ganha pouco e perde muito', () => {
    expect(deltaElo(1000, 1000, 1)).toBe(16);
    expect(deltaElo(1000, 1000, 0)).toBe(-16);
    expect(deltaElo(1200, 1000, 1)).toBe(8);
    expect(deltaElo(1200, 1000, 0)).toBe(-24);
    expect(deltaElo(1000, 1200, 1)).toBe(24);
    expect(deltaElo(1000, 1000, 1, 16)).toBe(8);
  });

  test('soma zero mesmo com meio ponto (Elos iguais, K ímpar)', () => {
    expect(deltaElo(1000, 1000, 1, 25)).toBe(13);
    expect(deltaElo(1000, 1000, 0, 25)).toBe(-13);
    for (const [a, b] of [[1000, 1000], [1234, 987], [900, 1500]]) {
      for (const k of [25, 31, 33]) expect(deltaElo(a, b, 1, k) + deltaElo(b, a, 0, k)).toBe(0);
    }
  });

  test('propriedade (F4.3): para qualquer par de Elos e K, o que um ganha o outro perde', () => {
    // Varredura determinística ampla (sem fast-check no servidor): 0 a 3000, passos primos, K de 1 a 64.
    let casos = 0;
    for (let a = 0; a <= 3000; a += 37) {
      for (let b = 0; b <= 3000; b += 41) {
        for (const k of [1, 7, 16, 25, 32, 33, 64]) {
          expect(deltaElo(a, b, 1, k) + deltaElo(b, a, 0, k), `${a} x ${b}, K ${k}`).toBe(0);
          casos++;
        }
      }
    }
    expect(casos).toBeGreaterThan(30_000);
  });

  test('propriedade (F4.3): no fim 1x1 e 2x2 a soma dos deltas das duplas é zero', () => {
    for (let a = 200; a <= 2800; a += 173) {
      for (let b = 200; b <= 2800; b += 211) {
        const umXum = deltasDoFim([{ usuarioId: 1, dupla: 0, elo: a }, { usuarioId: 2, dupla: 1, elo: b }], [1, 2], 0);
        expect(umXum.get(1)! + umXum.get(2)!).toBe(0);
        const doisXdois = deltasDoFim([
          { usuarioId: 1, dupla: 0, elo: a }, { usuarioId: 3, dupla: 0, elo: b },
          { usuarioId: 2, dupla: 1, elo: b }, { usuarioId: 4, dupla: 1, elo: a + 50 },
        ], [1, 2, 3, 4], 1);
        // Cada dupla ganha/perde o mesmo delta por jogador: soma por dupla é zero.
        expect(doisXdois.get(1)! + doisXdois.get(2)!).toBe(0);
        expect(doisXdois.get(1)).toBe(doisXdois.get(3));
      }
    }
  });

  test('media', () => {
    expect(media([1100, 900])).toBe(1000);
    expect(() => media([])).toThrow();
  });

  test('pontos nunca ficam negativos', () => {
    expect(novosPontos(10, -16)).toBe(0);
    expect(novosPontos(10, 16)).toBe(26);
  });
});

describe('patentes', () => {
  test('faixas do design', () => {
    expect(PATENTES.map((p) => [p.nome, p.minimo])).toEqual([
      ['Bronze', 0],
      ['Prata', 300],
      ['Ouro', 600],
      ['Diamante', 900],
      ['Mestre', 1200],
      ['Grão-Mestre', 1500],
    ]);
    expect(patenteDe(0)).toBe('Bronze');
    expect(patenteDe(299)).toBe('Bronze');
    expect(patenteDe(300)).toBe('Prata');
    expect(patenteDe(1499)).toBe('Mestre');
    expect(patenteDe(1500)).toBe('Grão-Mestre');
    expect(patenteDe(9999)).toBe('Grão-Mestre');
  });

  test('próxima patente e quanto falta', () => {
    expect(proximaPatente(250)).toEqual({ nome: 'Prata', faltam: 50 });
    expect(proximaPatente(600)).toEqual({ nome: 'Diamante', faltam: 300 });
    expect(proximaPatente(1600)).toBeNull();
  });
});
