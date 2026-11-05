import { describe, expect, test } from 'vitest';
import { deltaElo, ELO_INICIAL, esperado, K_PADRAO, media, novosPontos, patenteDe, PATENTES, proximaPatente } from '../src/ranking/elo';

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
