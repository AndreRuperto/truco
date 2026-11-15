import { describe, expect, test } from 'vitest';
import { temFloreios } from '../src/logica/lojaApp';

const carteira = (habilidade?: string) => ({ fichas: 0, pila: 0, inventario: [], equipados: habilidade ? { habilidade } : {}, avatar: null, extrato: [], bonus: [] }) as never;

describe('temFloreios (habilidade da loja)', () => {
  test('quem equipou os Floreios tem; sem conta, sem carteira ou com o de série, não', () => {
    expect(temFloreios(null, null)).toBe(false);
    expect(temFloreios({ admin: false }, carteira())).toBe(false);
    expect(temFloreios({ admin: false }, carteira('habilidade-simples'))).toBe(false);
    expect(temFloreios({ admin: false }, carteira('habilidade-floreios'))).toBe(true);
  });

  test('admin tem sempre, sem comprar', () => {
    expect(temFloreios({ admin: true }, null)).toBe(true);
    expect(temFloreios({ admin: true }, carteira())).toBe(true);
  });
});
