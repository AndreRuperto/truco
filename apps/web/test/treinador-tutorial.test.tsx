import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { TreinadorTutorial } from '../src/componentes/TreinadorTutorial';
import { distribuida, jogar, msgEstado, naSegundaRodada, PAULISTA } from './fixtures';

const nome = (c: number) => `Jogador ${c}`;

describe('treinador do tutorial', () => {
  test('mostra o passo do momento e "Pular tutorial" sempre', async () => {
    const user = userEvent.setup();
    const aoPular = vi.fn();
    render(<TreinadorTutorial msg={msgEstado(distribuida(PAULISTA), 0)} nome={nome} aoPular={aoPular} aoTerminar={vi.fn()} />);
    const painel = screen.getByRole('complementary', { name: 'Tutorial' });
    expect(painel).toHaveAttribute('data-passo', 'primeira-carta');
    expect(screen.getByRole('heading', { name: 'Sua vez de jogar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pular tutorial' }));
    expect(aoPular).toHaveBeenCalledOnce();
  });

  test('no fim da primeira mão: "Terminar tutorial"', async () => {
    const user = userEvent.setup();
    const aoTerminar = vi.fn();
    let s = naSegundaRodada(distribuida(PAULISTA));
    while (!s.ultimaMao) s = jogar(s, [[s.mao!.vez, 0]]);
    render(<TreinadorTutorial msg={msgEstado(s, 0)} nome={nome} aoPular={vi.fn()} aoTerminar={aoTerminar} />);
    await user.click(screen.getByRole('button', { name: 'Terminar tutorial' }));
    expect(aoTerminar).toHaveBeenCalledOnce();
  });
});
