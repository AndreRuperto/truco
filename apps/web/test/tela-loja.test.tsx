import type { CarteiraApi, CatalogoApi } from '@truco/api';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { aparenciaPermitida } from '../src/logica/aparenciaMesa';
import { TelaLoja, TelaLojaObrigado } from '../src/telas/Loja';

const CATALOGO: CatalogoApi = {
  pagamentoAtivo: true,
  pacotes: [{ id: 'bolso', nome: 'Bolso', centavos: 990, pila: 220 }],
  itens: [
    { id: 'verso-classico', slot: 'verso', nome: 'Clássico', preco: null, visual: { cor: '#7a1a22', linha: '#c9767b', estampa: 'losango' } },
    { id: 'verso-chita', slot: 'verso', nome: 'Chita', preco: { moeda: 'pila', valor: 300 }, visual: { cor: '#d9763a', linha: '#2d6a45', estampa: 'chita' } },
    { id: 'verso-cartola', slot: 'verso', nome: 'Cartola de Ouro', preco: { moeda: 'fichas', valor: 6000 }, visual: { cor: '#1c1410', linha: '#e9b02c', estampa: 'cartola' } },
  ],
};
const CARTEIRA: CarteiraApi = { fichas: 1100, pila: 300, inventario: [], equipados: {}, avatar: null, bonus: [], extrato: [] };
const USUARIO = { id: 1, apelido: 'ana', email: 'ana@x.com', google: false, avatar: null, admin: false };

function apiFalsa() {
  return {
    loja: {
      catalogo: vi.fn(),
      eu: vi.fn(),
      comprarItem: vi.fn(async () => undefined),
      equipar: vi.fn(async () => undefined),
      criarPedido: vi.fn(async () => ({ pedido: { id: 'p1', pacoteId: 'bolso', pila: 220, valorCentavos: 990, status: 'criado' as const }, url: 'https://checkout.infinitepay.io/x' })),
      pedido: vi.fn(async () => ({ pedido: { id: 'p1', pacoteId: 'bolso', pila: 220, valorCentavos: 990, status: 'pago' as const } })),
    },
  };
}

describe('TelaLoja', () => {
  test('mostra saldos, estados dos itens e compra com confirmação', async () => {
    const user = userEvent.setup();
    const api = apiFalsa();
    const aoMudar = vi.fn(async () => {});
    render(<TelaLoja aba="verso" api={api} usuario={USUARIO} catalogo={CATALOGO} carteira={CARTEIRA} aoMudar={aoMudar} />);
    expect(screen.getByTestId('saldo-fichas')).toHaveTextContent('1.100');
    expect(screen.getByTestId('saldo-pila')).toHaveTextContent('300');
    expect(within(screen.getByTestId('item-verso-classico')).getByText('Em uso')).toBeInTheDocument();
    expect(within(screen.getByTestId('item-verso-cartola')).getByRole('button', { name: 'Faltam Fichas' })).toBeDisabled();
    await user.click(within(screen.getByTestId('item-verso-chita')).getByRole('button', { name: 'Comprar' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Seu saldo fica em 0 Pila');
    await user.click(screen.getByRole('button', { name: 'Comprar e equipar' }));
    expect(api.loja.comprarItem).toHaveBeenCalledWith('verso-chita');
    expect(api.loja.equipar).toHaveBeenCalledWith('verso', 'verso-chita');
    expect(aoMudar).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Chita é seu');
  });

  test('visitante vê o catálogo, mas não compra', () => {
    render(<TelaLoja aba="verso" api={apiFalsa()} usuario={null} catalogo={CATALOGO} carteira={null} aoMudar={async () => {}} />);
    expect(screen.getByText(/entre na sua conta/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comprar' })).toBeNull();
  });

  test('pacote de Pila abre o checkout; desligado, avisa "em breve"', async () => {
    const user = userEvent.setup();
    const api = apiFalsa();
    const ir = vi.fn();
    const { unmount } = render(<TelaLoja aba="pila" api={api} usuario={USUARIO} catalogo={CATALOGO} carteira={CARTEIRA} aoMudar={async () => {}} aoIrParaPagamento={ir} />);
    await user.click(screen.getByRole('button', { name: /Comprar Bolso/ }));
    expect(api.loja.criarPedido).toHaveBeenCalledWith('bolso');
    expect(ir).toHaveBeenCalledWith('https://checkout.infinitepay.io/x');
    unmount();
    render(<TelaLoja aba="pila" api={api} usuario={USUARIO} catalogo={{ ...CATALOGO, pagamentoAtivo: false }} carteira={CARTEIRA} aoMudar={async () => {}} />);
    expect(screen.getByText(/abre em breve/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Comprar Bolso/ })).toBeDisabled();
  });

  test('obrigado: confere o pedido e avisa quando pagou', async () => {
    const api = apiFalsa();
    const aoPago = vi.fn();
    render(<TelaLojaObrigado pedido="0b6f0c1e-9a51-4a0b-8f53-2f6f2c4f9a10" api={api} aoPago={aoPago} />);
    expect(await screen.findByText(/Pagamento confirmado: 220 Pila/)).toBeInTheDocument();
    expect(aoPago).toHaveBeenCalled();
  });
});

describe('tampos da loja', () => {
  test('mármore e fórmica só com o item; feltro só com conta', () => {
    expect(aparenciaPermitida('marmore', true, [])).toBe('madeira');
    expect(aparenciaPermitida('marmore', true, ['tampo-marmore'])).toBe('marmore');
    expect(aparenciaPermitida('formica', false, ['tampo-formica'])).toBe('madeira');
    expect(aparenciaPermitida('feltro', false)).toBe('madeira');
    expect(aparenciaPermitida('feltro', true)).toBe('feltro');
  });
});
