import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Cabecalho } from '../src/componentes/Cabecalho';
import { Manual, secoesManual } from '../src/componentes/Manual';
import { ManualMesa } from '../src/componentes/ManualMesa';
import { TelaComoJogar } from '../src/telas/ComoJogar';

describe('manual de como jogar', () => {
  test('página com título, sumário e todas as seções', () => {
    render(<TelaComoJogar />);
    expect(screen.getByRole('heading', { level: 1, name: 'Como jogar truco' })).toBeInTheDocument();
    const sumario = screen.getByRole('navigation', { name: 'Sumário do manual' });
    // Sem nada salvo, abre no guia do mineiro (o padrão da casa).
    expect(screen.getByRole('button', { name: 'Guia do Mineiro' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sumario).getAllByRole('button')).toHaveLength(secoesManual('mineiro').length);
    for (const s of secoesManual('mineiro')) expect(screen.getByRole('heading', { level: 2, name: s.titulo })).toBeInTheDocument();
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

  test('um guia para cada variante: escada completa, vira e mão limpa só onde existem', async () => {
    const user = userEvent.setup();
    render(<Manual varianteInicial="mineiro" />);
    const escadaMineiro = screen.getByRole('list', { name: 'Da mais fraca para a mais forte, no mineiro' });
    const nomes = within(escadaMineiro).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));
    // Sobe do 4 comum até o zap.
    expect(nomes[0]).toBe('4 de espadas');
    expect(nomes.slice(-5)).toEqual(['3 de ouros', '7 de ouros, manilha', 'Ás de espadas, manilha', '7 de copas, manilha', '4 de paus, manilha']);
    expect(nomes).toHaveLength(14);
    expect(screen.getByRole('heading', { level: 2, name: 'Resumo do Mineiro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Mão limpa' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No paulista: depende da vira' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Guia do Paulista' }));
    expect(screen.getByRole('button', { name: 'Guia do Paulista' })).toHaveAttribute('aria-pressed', 'true');
    const escadaPaulista = screen.getByRole('list', { name: 'Da mais fraca para a mais forte, com a vira 7 de ouros' });
    const itens = within(escadaPaulista).getAllByRole('listitem');
    expect(itens).toHaveLength(13);
    expect(itens.at(-1)).toHaveAccessibleName('Dama de paus, manilha');
    expect(itens[0]).toHaveAccessibleName('4 de espadas');
    expect(itens.some((li) => /^Dama/.test(li.getAttribute('aria-label') ?? '') && !/manilha/.test(li.getAttribute('aria-label') ?? ''))).toBe(false);
    expect(screen.getByRole('heading', { name: 'No paulista: depende da vira' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Mão limpa' })).toBeNull();
    expect(screen.queryByText(/Piscar os dois olhos/)).toBeNull();
  });

  test('conteúdo bate com o motor: manilhas por naipe e escadas', () => {
    render(<Manual varianteInicial="paulista" />);
    const tabela = screen.getByRole('table', { name: /Quanto a mão vale/ });
    expect(within(tabela).getByRole('row', { name: /1, 3, 6, 9, 12 1 3 6 9 12/ })).toBeInTheDocument();
    expect(within(tabela).getByRole('row', { name: /2, 4, 8, 10, 12 2 4 8 10 12/ })).toBeInTheDocument();
    expect(screen.getAllByText(/paus › copas › espadas › ouros/).length).toBeGreaterThan(0);
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
