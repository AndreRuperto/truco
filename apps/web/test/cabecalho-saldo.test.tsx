import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Cabecalho } from '../src/componentes/Cabecalho';
import { IconeMoeda } from '../src/componentes/IconeMoeda';

const ana = { id: 2, apelido: 'ana', email: null, google: false };

describe('saldo no cabeçalho', () => {
  test('mostra cada saldo com o ícone da moeda, não com letra', () => {
    render(<Cabecalho pronta usuario={ana} aoSair={() => {}} saldos={{ fichas: 1200, pila: 0 }} />);
    const saldo = screen.getByTestId('cabecalho-saldo');
    expect(saldo).toHaveAccessibleName('Saldo: 1.200 Fichas e 0 Pila');
    expect(within(saldo).getByTestId('saldo-cab-fichas')).toHaveTextContent(/^1\.200$/);
    expect(within(saldo).getByTestId('saldo-cab-pila')).toHaveTextContent(/^0$/);
    expect(saldo.querySelector('svg.icone-moeda.moeda-fichas')).not.toBeNull();
    expect(saldo.querySelector('svg.icone-moeda.moeda-pila')).not.toBeNull();
  });

  test('o saldo vem logo antes da conta (lado direito do cabeçalho)', () => {
    render(<Cabecalho pronta usuario={ana} aoSair={() => {}} saldos={{ fichas: 1200, pila: 0 }} />);
    const saldo = screen.getByTestId('cabecalho-saldo');
    expect(saldo.nextElementSibling).toHaveClass('menu-conta');
  });

  test('nenhum link do cabeçalho leva à compra de Pila; o saldo abre a Loja normal', () => {
    const { container } = render(<Cabecalho pronta usuario={ana} aoSair={() => {}} saldos={{ fichas: 1200, pila: 0 }} />);
    expect(screen.getByTestId('cabecalho-saldo')).toHaveAttribute('href', '#/loja');
    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).not.toContain('#/loja/pila');
    expect(screen.queryByText(/comprar (pila|fichas)/i)).toBeNull();
  });

  test('ícone é decorativo (o nome da moeda vem do rótulo)', () => {
    const { container } = render(<IconeMoeda moeda="fichas" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });
});
