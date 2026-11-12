import type { CarteiraApi, ItemLoja } from '@truco/api';
import { describe, expect, test } from 'vitest';
import { equipadoNoSlot, estadoDoItem, estiloMoldura, estiloVerso, formatarReais, rotuloPreco, vestir } from '../src/logica/lojaItens';

const ITENS: ItemLoja[] = [
  { id: 'verso-classico', slot: 'verso', nome: 'Clássico', preco: null, visual: { cor: '#7a1a22', linha: '#c9767b', estampa: 'losango' } },
  { id: 'verso-chita', slot: 'verso', nome: 'Chita', preco: { moeda: 'pila', valor: 300 }, visual: { cor: '#d9763a', linha: '#2d6a45', estampa: 'chita' } },
  { id: 'moldura-giz', slot: 'moldura', nome: 'Giz', preco: { moeda: 'fichas', valor: 3000 }, visual: { estilo: 'giz' } },
  { id: 'avatar-violeiro', slot: 'avatar', nome: 'Violeiro', preco: { moeda: 'pila', valor: 120 }, visual: { desenho: 'violeiro' } },
];
const carteira = (p: Partial<CarteiraApi> = {}): CarteiraApi => ({ fichas: 1000, pila: 0, inventario: [], equipados: {}, avatar: null, bonus: [], extrato: [], ...p });

describe('lógica da loja', () => {
  test('preços e reais em pt-BR', () => {
    expect(formatarReais(990)).toMatch(/R\$\s9,90/);
    expect(rotuloPreco(ITENS[0])).toBe('De graça');
    expect(rotuloPreco(ITENS[2])).toBe('3.000 Fichas');
  });

  test('estado do item: equipado, equipar, comprar, sem saldo', () => {
    expect(estadoDoItem(ITENS[0], carteira(), ITENS)).toBe('equipado');
    expect(estadoDoItem(ITENS[1], carteira(), ITENS)).toBe('sem-saldo');
    expect(estadoDoItem(ITENS[1], carteira({ pila: 300 }), ITENS)).toBe('comprar');
    expect(estadoDoItem(ITENS[1], carteira({ inventario: ['verso-chita'] }), ITENS)).toBe('equipar');
    expect(estadoDoItem(ITENS[1], carteira({ inventario: ['verso-chita'], equipados: { verso: 'verso-chita' } }), ITENS)).toBe('equipado');
    expect(estadoDoItem(ITENS[0], carteira({ equipados: { verso: 'verso-chita' } }), ITENS)).toBe('equipar');
    // Fichas não pagam item de Pila e vice-versa.
    expect(estadoDoItem(ITENS[1], carteira({ fichas: 99999 }), ITENS)).toBe('sem-saldo');
    expect(estadoDoItem(ITENS[2], carteira({ pila: 99999 }), ITENS)).toBe('sem-saldo');
    expect(estadoDoItem(ITENS[1], null, ITENS)).toBe('sem-saldo');
  });

  test('avatar da loja vem de `loja:` no avatar da conta', () => {
    expect(equipadoNoSlot('avatar', carteira({ avatar: 'loja:avatar-violeiro' }), ITENS)).toBe('avatar-violeiro');
    expect(equipadoNoSlot('avatar', carteira({ avatar: 'pronto:zap' }), ITENS)).toBeNull();
  });

  test('estilos: verso em variáveis CSS, moldura em classe, roupa por cima da paleta', () => {
    expect(estiloVerso(ITENS[1].visual as never)).toEqual({ style: { '--verso': '#d9763a', '--verso-linha': '#2d6a45' }, estampa: 'chita' });
    expect(estiloVerso(null)).toBeNull();
    expect(estiloMoldura('giz')).toBe('moldura-giz');
    expect(estiloMoldura('nenhuma')).toBeUndefined();
    const base = { camisa: '#111', chapeu: undefined as string | undefined, cabelo: '#222' };
    expect(vestir(base, { camisa: '#fff', chapeu: 'palha' })).toEqual({ camisa: '#fff', chapeu: 'palha', cabelo: '#222' });
    expect(vestir(base, {})).toEqual(base);
    expect(vestir(base, null)).toBe(base);
  });
});
