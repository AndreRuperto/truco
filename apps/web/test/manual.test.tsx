import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Cabecalho } from '../src/componentes/Cabecalho';
import { Manual, SECOES_MANUAL } from '../src/componentes/Manual';
import { ManualMesa } from '../src/componentes/ManualMesa';
import { TelaComoJogar } from '../src/telas/ComoJogar';

describe('manual de como jogar', () => {
  test('página com título, sumário e todas as seções', () => {
    render(<TelaComoJogar />);
    expect(screen.getByRole('heading', { level: 1, name: 'Como jogar truco' })).toBeInTheDocument();
    const sumario = screen.getByRole('navigation', { name: 'Sumário do manual' });
    expect(within(sumario).getAllByRole('button')).toHaveLength(SECOES_MANUAL.length);
    for (const s of SECOES_MANUAL) expect(screen.getByRole('heading', { level: 2, name: s.titulo })).toBeInTheDocument();
  });

  test('o sumário leva o foco até a seção (sem trocar o hash da tela)', async () => {
    const user = userEvent.setup();
    Element.prototype.scrollIntoView = vi.fn();
    render(<Manual />);
    const antes = window.location.hash;
    await user.click(screen.getByRole('button', { name: 'Família' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Família' })).toHaveFocus();
    expect(window.location.hash).toBe(antes);
  });

  test('conteúdo bate com o motor: ordem comum, manilhas do mineiro e escadas', () => {
    render(<Manual />);
    expect(screen.getByLabelText('3, 2, Ás, Rei, Valete, Dama, 7, 6, 5, 4')).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: /Quanto a mão vale/ });
    expect(within(tabela).getByRole('row', { name: /1, 3, 6, 9, 12 1 3 6 9 12/ })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: /2, 4, 8, 10, 12 2 4 8 10 12/ })).toBeInTheDocument();
    expect(screen.getByText(/paus › copas › espadas › ouros/)).toBeInTheDocument();
  });

  test('cabeçalho tem o ? que leva ao manual', () => {
    render(<Cabecalho pronta usuario={null} aoSair={() => {}} atual="manual" />);
    const ajuda = screen.getByRole('link', { name: 'Como jogar' });
    expect(ajuda).toHaveAttribute('href', '#/como-jogar');
    expect(ajuda).toHaveAttribute('aria-current', 'page');
    expect(ajuda).toHaveTextContent('?');
  });

  test('na mesa: diálogo com o manual, fecha no botão e no Esc', async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    render(<ManualMesa aoFechar={aoFechar} />);
    const dialogo = screen.getByRole('dialog', { name: 'Como jogar' });
    const voltar = within(dialogo).getByRole('button', { name: 'Voltar pra mesa' });
    expect(voltar).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(aoFechar).toHaveBeenCalledTimes(1);
    await user.click(voltar);
    expect(aoFechar).toHaveBeenCalledTimes(2);
  });
});
