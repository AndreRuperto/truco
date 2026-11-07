import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SalaEspera } from '../src/telas/SalaEspera';
import { msgEstado } from './fixtures';

const privada = () => msgEstado(null, 0, { modo: 'privada' });
const renderizar = (aoIniciar = vi.fn()) =>
  render(<SalaEspera msg={privada()} aoIniciar={aoIniciar} aoSair={vi.fn()} />);

afterEach(() => vi.useRealTimers());

describe('Baralho de treino na sala privada', () => {
  test('aparece apenas em mesa privada e oferece quatro truques', () => {
    const { rerender } = renderizar();
    const grupo = screen.getByRole('group', { name: 'Truques de embaralhamento' });
    expect(grupo.querySelectorAll('button')).toHaveLength(4);
    expect(screen.getByTestId('baralho-treino').querySelectorAll('.baralho-treino-carta')).toHaveLength(24);
    expect(screen.getByText(/não mexe nas cartas da partida/i)).toBeInTheDocument();

    rerender(<SalaEspera msg={msgEstado(null, 0, { modo: 'ranqueada' })} aoIniciar={vi.fn()} aoSair={vi.fn()} />);
    expect(screen.queryByTestId('baralho-treino')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Truques de embaralhamento' })).toBeNull();

    rerender(<SalaEspera msg={msgEstado(null, 0, { modo: 'classica' })} aoIniciar={vi.fn()} aoSair={vi.fn()} />);
    expect(screen.queryByTestId('baralho-treino')).toBeNull();
  });

  test('corte, leque, mola e toque no baralho são interativos, sem iniciar partida', () => {
    const iniciarPartida = vi.fn();
    renderizar(iniciarPartida);
    const baralho = screen.getByTestId('baralho-treino');

    fireEvent.click(screen.getByRole('button', { name: 'Corte triplo' }));
    expect(baralho).toHaveAttribute('data-movimento', 'corte');
    expect(screen.getByText('Corte triplo · 1 movimento')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Leque de cartas' }));
    expect(baralho).toHaveAttribute('data-movimento', 'leque');
    expect(screen.getByText('Leque de cartas · 2 movimentos')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mola de cartas' }));
    expect(baralho).toHaveAttribute('data-movimento', 'mola');

    fireEvent.click(screen.getByRole('button', { name: 'Embaralhar o baralho em cascata' }));
    expect(baralho).toHaveAttribute('data-movimento', 'cascata');
    expect(screen.getByText('Cascata com ponte · 4 movimentos')).toBeInTheDocument();
    expect(iniciarPartida).not.toHaveBeenCalled();
  });

  test('permite repetir rápido o mesmo truque; limpa animações e mantém estado quando alguém chega', () => {
    vi.useFakeTimers();
    const aoIniciar = vi.fn();
    const { rerender, unmount } = renderizar(aoIniciar);
    const baralho = screen.getByTestId('baralho-treino');
    const botao = screen.getByRole('button', { name: 'Cascata com ponte' });

    fireEvent.click(botao);
    const pilhaPrimeira = baralho.querySelector('.baralho-treino-pilha');
    fireEvent.click(botao);
    expect(baralho).toHaveAttribute('data-movimento', 'cascata');
    expect(baralho.querySelector('.baralho-treino-pilha')).not.toBe(pilhaPrimeira);
    expect(screen.getByText('Cascata com ponte · 2 movimentos')).toBeInTheDocument();

    rerender(<SalaEspera msg={msgEstado(null, 0, { modo: 'privada', humanosEsperados: 3 })} aoIniciar={aoIniciar} aoSair={vi.fn()} />);
    expect(screen.getByText('Cascata com ponte · 2 movimentos')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1800));
    expect(baralho).toHaveAttribute('data-movimento', 'parado');
    unmount();
    act(() => vi.runOnlyPendingTimers());
    expect(aoIniciar).not.toHaveBeenCalled();
  });
});
