import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CHAVE_TUTORIAL } from '../src/logica/tutorial';
import { Lobby } from '../src/telas/Lobby';

beforeEach(() => localStorage.clear());

const tour = () => screen.queryByRole('dialog');

// Pedido do André (2026-11-22): na 1ª visita, o lobby destaca uma coisa de cada vez e escurece o
// resto para explicar; o convite do tutorial vira o último passo; dá para pular a qualquer hora.
describe('tour da 1ª visita no lobby', () => {
  test('passa por Jogar agora, Regras da mesa, Mesa privada e termina oferecendo o tutorial', async () => {
    const user = userEvent.setup();
    const aoTutorial = vi.fn();
    render(<Lobby aoJogar={vi.fn()} aoCriarPrivada={vi.fn()} aoTutorial={aoTutorial} />);
    const titulos: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = tour()!;
      titulos.push(d.querySelector('h2')!.textContent!);
      expect(d).toHaveTextContent(`${i + 1} de 4`);
      expect(screen.getByRole('button', { name: 'Próximo' })).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Próximo' }));
    }
    expect(titulos).toEqual(['Jogar agora', 'Regras da mesa', 'Mesa privada']);
    expect(screen.getByRole('dialog', { name: 'Primeira vez por aqui?' })).toHaveTextContent('4 de 4');
    expect(screen.getByRole('button', { name: 'Começar tutorial' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Começar tutorial' }));
    expect(aoTutorial).toHaveBeenCalledWith(expect.objectContaining({ tutorial: true, humanos: 1, nivelBot: 'facil' }));
  });

  test('cada passo marca o que está em destaque', async () => {
    const user = userEvent.setup();
    render(<Lobby aoJogar={vi.fn()} aoCriarPrivada={vi.fn()} aoTutorial={vi.fn()} />);
    const destacado = () => document.querySelector('[data-tour-ativo]');
    expect(destacado()).toBe(screen.getByRole('button', { name: 'Jogar agora' }));
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(destacado()).toBe(document.querySelector('details.regras-mesa > summary'));
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(destacado()).toBe(document.querySelector('.alternar-privada-linha'));
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(destacado()).toBe(screen.getByRole('button', { name: 'Tutorial' }));
  });

  test('"Pular" (ou Esc) fecha o tour de vez; o botão Tutorial continua no menu', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Lobby aoJogar={vi.fn()} aoTutorial={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Pular' }));
    expect(tour()).toBeNull();
    expect(document.querySelector('[data-tour-ativo]')).toBeNull();
    expect(localStorage.getItem(CHAVE_TUTORIAL)).toBe('pulado');
    unmount();
    render(<Lobby aoJogar={vi.fn()} aoTutorial={vi.fn()} />);
    expect(tour()).toBeNull();
    expect(screen.getByRole('button', { name: 'Tutorial' })).toBeInTheDocument();
  });

  test('Esc também pula; "Agora não" no último passo também', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Lobby aoJogar={vi.fn()} aoTutorial={vi.fn()} />);
    await user.keyboard('{Escape}');
    expect(tour()).toBeNull();
    expect(localStorage.getItem(CHAVE_TUTORIAL)).toBe('pulado');
    unmount();
    localStorage.clear();
    render(<Lobby aoJogar={vi.fn()} aoTutorial={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    await user.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(tour()).toBeNull();
    expect(localStorage.getItem(CHAVE_TUTORIAL)).toBe('pulado');
  });

  test('o foco fica preso no balão enquanto o tour está aberto', async () => {
    const user = userEvent.setup();
    render(<Lobby aoJogar={vi.fn()} aoTutorial={vi.fn()} />);
    const d = tour()!;
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(d.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(d.contains(document.activeElement)).toBe(true);
  });

  test('sem mesa privada, são 3 passos', async () => {
    render(<Lobby aoJogar={vi.fn()} aoTutorial={vi.fn()} />);
    expect(tour()).toHaveTextContent('1 de 3');
  });

  test('quem já viu (ou pulou) não vê de novo', () => {
    localStorage.setItem(CHAVE_TUTORIAL, 'feito');
    render(<Lobby aoJogar={vi.fn()} aoTutorial={vi.fn()} />);
    expect(tour()).toBeNull();
  });
});
