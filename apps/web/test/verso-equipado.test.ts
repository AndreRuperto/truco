import { describe, expect, test } from 'vitest';
import { versoEquipado } from '../src/logica/lojaApp';

const catalogo = {
  itens: [
    { id: 'verso-boteco', slot: 'verso', nome: 'Vermelho Boteco', preco: null, visual: { cor: '#b8202a', linha: '#fbf3dc', estampa: 'listra' } },
    { id: 'moldura-giz', slot: 'moldura', nome: 'Giz', preco: null, visual: { estilo: 'giz' } },
  ],
} as never;

describe('versoEquipado', () => {
  test('acha o visual do verso equipado no catálogo', () => {
    expect(versoEquipado(catalogo, 'verso-boteco')).toEqual({ cor: '#b8202a', linha: '#fbf3dc', estampa: 'listra' });
  });
  test('sem catálogo, sem id ou id de outro slot: null (fica o clássico)', () => {
    expect(versoEquipado(null, 'verso-boteco')).toBeNull();
    expect(versoEquipado(catalogo, undefined)).toBeNull();
    expect(versoEquipado(catalogo, 'moldura-giz')).toBeNull();
  });
});
