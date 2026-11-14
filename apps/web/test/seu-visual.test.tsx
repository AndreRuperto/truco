import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { SeuVisual } from '../src/componentes/SeuVisual';

const itens = [
  { id: 'verso-classico', slot: 'verso', nome: 'Clássico', preco: null, visual: { cor: '#7a1a22', linha: '#c9767b', estampa: 'losango' } },
  { id: 'verso-boteco', slot: 'verso', nome: 'Vermelho Boteco', preco: { moeda: 'pila', valor: 120 }, visual: { cor: '#b8202a', linha: '#fbf3dc', estampa: 'listra' } },
  { id: 'verso-azulejo', slot: 'verso', nome: 'Azulejo', preco: { moeda: 'pila', valor: 200 }, visual: { cor: '#f4efe2', linha: '#2f68b8', estampa: 'azulejo' } },
  { id: 'moldura-nenhuma', slot: 'moldura', nome: 'Sem moldura', preco: null, visual: { estilo: 'nenhuma' } },
  { id: 'moldura-giz', slot: 'moldura', nome: 'Giz de Lousa', preco: { moeda: 'fichas', valor: 800 }, visual: { estilo: 'giz' } },
  { id: 'roupa-camisa', slot: 'roupa', nome: 'Camisa de série', preco: null, visual: {} },
  { id: 'tampo-feltro', slot: 'tampo', nome: 'Feltro', preco: null, visual: { superficie: 'feltro' } },
  { id: 'tampo-madeira', slot: 'tampo', nome: 'Madeira', preco: { moeda: 'pila', valor: 150 }, visual: { superficie: 'madeira' } },
  { id: 'avatar-galo', slot: 'avatar', nome: 'Galo', preco: { moeda: 'pila', valor: 90 }, visual: {} },
] as never[];

const carteira = {
  fichas: 100,
  pila: 0,
  inventario: ['verso-boteco', 'tampo-madeira'],
  equipados: { verso: 'verso-boteco' },
  avatar: null,
  extrato: [],
  bonus: [],
} as never;

const ana = { id: 2, apelido: 'ana', email: null, google: false };

function montar(equipar = vi.fn(async () => {}), aoMudar = vi.fn(async () => {})) {
  render(<SeuVisual usuario={ana} catalogo={{ itens } as never} carteira={carteira} api={{ loja: { equipar } } as never} aoMudar={aoMudar} />);
  return { equipar, aoMudar };
}

describe('SeuVisual (perfil)', () => {
  test('mostra por tipo só o que a pessoa tem, com o equipado marcado', () => {
    montar();
    const baralho = screen.getByRole('radiogroup', { name: 'Baralho' });
    const opcoes = within(baralho).getAllByRole('radio');
    expect(opcoes.map((o) => o.getAttribute('aria-label'))).toEqual(['Clássico', 'Vermelho Boteco']);
    expect(within(baralho).getByRole('radio', { name: 'Vermelho Boteco' })).toBeChecked();
    expect(within(screen.getByRole('radiogroup', { name: 'Moldura' })).getAllByRole('radio')).toHaveLength(1);
    expect(within(screen.getByRole('radiogroup', { name: 'Mesa' })).getAllByRole('radio')).toHaveLength(2);
    // Avatar da loja que não tem: o grupo não aparece, só o convite da loja.
    expect(screen.queryByRole('radiogroup', { name: 'Avatar' })).toBeNull();
    expect(screen.getByRole('link', { name: /Mais molduras na Loja/ })).toHaveAttribute('href', '#/loja/moldura');
  });

  test('escolher equipa na hora, com as regras da loja (de série = null, exceto mesa)', async () => {
    const { equipar, aoMudar } = montar();
    await userEvent.click(screen.getByRole('radio', { name: 'Clássico' }));
    expect(equipar).toHaveBeenLastCalledWith('verso', null);
    await userEvent.click(screen.getByRole('radio', { name: 'Madeira' }));
    expect(equipar).toHaveBeenLastCalledWith('tampo', 'tampo-madeira');
    expect(aoMudar).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('status')).toHaveTextContent('Madeira equipado.');
    // O que já está em uso (Feltro, de série) não chama o servidor de novo.
    expect(screen.getByRole('radio', { name: 'Feltro' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Feltro' }));
    expect(equipar).toHaveBeenCalledTimes(2);
  });

  test('erro do servidor aparece e o escolhido volta', async () => {
    montar(vi.fn(async () => {
      throw new Error('você ainda não tem esse item');
    }));
    await userEvent.click(screen.getByRole('radio', { name: 'Clássico' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('você ainda não tem esse item');
    expect(screen.getByRole('radio', { name: 'Vermelho Boteco' })).toBeChecked();
  });
});
