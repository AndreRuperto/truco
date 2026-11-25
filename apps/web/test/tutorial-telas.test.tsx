import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CHAVE_TUTORIAL } from '../src/logica/tutorial';
import type { EstadoLoja } from '../src/rede/loja';
import { Lobby } from '../src/telas/Lobby';
import { TelaMesa } from '../src/telas/Mesa';
import { distribuida, msgEstado, PAULISTA } from './fixtures';

vi.mock('../src/som/sintese', () => ({ destravarAudio: vi.fn(), sintetizar: vi.fn() }));
beforeEach(() => localStorage.clear());

const acoes = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() });
const snap = (msg: NonNullable<EstadoLoja['msg']>): EstadoLoja => ({ status: 'na-mesa', msg, eventos: [], erro: null, chat: [], salaId: 'r1' });

describe('tutorial no lobby', () => {
  test('1ª visita: oferece o tutorial; "Começar" abre a mesa guiada (sozinho, bots fáceis, sem relógio, com família para ensinar)', async () => {
    const user = userEvent.setup();
    const aoTutorial = vi.fn();
    render(<Lobby aoJogar={vi.fn()} aoTutorial={aoTutorial} />);
    // O convite é o último passo do tour da 1ª visita (tour-lobby.test.tsx).
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    const convite = screen.getByRole('dialog', { name: 'Primeira vez por aqui?' });
    await user.click(screen.getByRole('button', { name: 'Começar tutorial' }));
    expect(aoTutorial).toHaveBeenCalledWith(
      expect.objectContaining({ tutorial: true, semLimiteDeTempo: true, humanos: 1, nivelBot: 'facil', modo: 'classica', sinais: false }),
    );
    expect(aoTutorial.mock.calls[0][0].regras.familia).toBe('fechada');
    expect(convite).toBeInTheDocument();
  });

  test('"Agora não" some com o convite e não volta; o botão de tutorial continua', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Lobby aoJogar={vi.fn()} aoTutorial={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    await user.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(screen.queryByRole('dialog', { name: 'Primeira vez por aqui?' })).toBeNull();
    expect(localStorage.getItem(CHAVE_TUTORIAL)).toBe('pulado');
    unmount();
    render(<Lobby aoJogar={vi.fn()} aoTutorial={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tutorial' })).toBeInTheDocument();
  });
});

describe('tutorial na mesa', () => {
  test('o treinador entra no lugar das dicas, e "Pular tutorial" chama quem abriu', async () => {
    const user = userEvent.setup();
    const aoPular = vi.fn();
    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={acoes()} tutorial={{ aoPular, aoTerminar: vi.fn() }} />);
    expect(screen.getByRole('complementary', { name: 'Tutorial' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Dica' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Pular tutorial' }));
    expect(aoPular).toHaveBeenCalledOnce();
  });

  test('sem tutorial, a mesa continua com as dicas de sempre', () => {
    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={acoes()} />);
    expect(screen.queryByRole('complementary', { name: 'Tutorial' })).toBeNull();
  });
});
