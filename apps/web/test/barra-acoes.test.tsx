import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { acoesValidas, reduce, visaoDoJogador } from '@truco/engine';
import { describe, expect, test, vi } from 'vitest';
import { BarraAcoes } from '../src/componentes/BarraAcoes';
import { agruparAcoes } from '../src/logica/acoes';
import { textoPedidoPendente } from '../src/logica/textos';
import { distribuida, PAULISTA } from './fixtures';

describe('BarraAcoes', () => {
  test('mostra o pedido e os botões na ordem; clicar envia a ação de minhasAcoes', async () => {
    const user = userEvent.setup();
    const s = reduce(distribuida(PAULISTA), { tipo: 'truco', cadeira: 0 });
    const v = visaoDoJogador(s, 1);
    const aoEscolher = vi.fn();
    render(<BarraAcoes botoes={agruparAcoes(acoesValidas(s, 1), v).botoes} pedido={textoPedidoPendente(v)} aoEscolher={aoEscolher} />);
    const barra = screen.getByRole('toolbar', { name: 'Ações' });
    expect(within(barra).getAllByRole('button').map((b) => b.textContent)).toEqual(['Aceitar', 'Seis!', 'Correr']);
    expect(barra).toHaveTextContent('Pediram Truco! Vale 3.');
    await user.click(screen.getByRole('button', { name: 'Seis!' }));
    expect(aoEscolher).toHaveBeenCalledWith({ tipo: 'aumentar', cadeira: 1 });
  });

  test('sem botões nem pedido não renderiza nada', () => {
    const { container } = render(<BarraAcoes botoes={[]} pedido={null} aoEscolher={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
