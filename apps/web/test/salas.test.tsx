import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { REGRAS_RANQUEADA } from '@truco/engine';
import { describe, expect, test, vi } from 'vitest';
import { TelaEntrarPrivada } from '../src/telas/EntrarPrivada';
import { TelaSalas } from '../src/telas/Salas';

const SALA = { id: 'abc123', modo: 'desafio', variante: 'mineiro', humanos: 2, nivelBot: 'dificil', regras: REGRAS_RANQUEADA.mineiro, ocupados: 1, dono: 'Ana' } as const;

describe('TelaSalas', () => {
  test('lista mesas abertas e entra pelo id', async () => {
    const user = userEvent.setup();
    const aoEntrar = vi.fn();
    const salas = vi.fn(async () => ({ salas: [{ ...SALA }] }));
    render(<TelaSalas api={{ salas }} aoEntrar={aoEntrar} />);
    const item = await screen.findByRole('listitem');
    expect(item).toHaveTextContent('Desafio · Mineiro');
    expect(item).toHaveTextContent('1/2 humanos');
    expect(item).toHaveTextContent('Ana');
    await user.click(screen.getByRole('button', { name: 'Entrar na mesa de Ana' }));
    expect(aoEntrar).toHaveBeenCalledWith('abc123');
    await user.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(salas).toHaveBeenCalledTimes(2);
  });

  test('atualiza sozinha a cada 12 s e para ao desmontar', async () => {
    vi.useFakeTimers();
    try {
      const salas = vi.fn(async () => ({ salas: [] }));
      const { unmount } = render(<TelaSalas api={{ salas }} aoEntrar={vi.fn()} />);
      expect(salas).toHaveBeenCalledTimes(1);
      await act(async () => vi.advanceTimersByTimeAsync(12_000));
      expect(salas).toHaveBeenCalledTimes(2);
      unmount();
      await act(async () => vi.advanceTimersByTimeAsync(36_000));
      expect(salas).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('vazia', async () => {
    render(<TelaSalas api={{ salas: vi.fn(async () => ({ salas: [] })) }} aoEntrar={vi.fn()} />);
    expect(await screen.findByText(/Nenhuma mesa esperando jogadores/)).toBeInTheDocument();
  });
});

describe('TelaEntrarPrivada', () => {
  test('pede o apelido e entra', async () => {
    const user = userEvent.setup();
    const aoEntrar = vi.fn();
    render(<TelaEntrarPrivada codigo="abcd1234" nomeInicial="Bia" aoEntrar={aoEntrar} />);
    expect(screen.getByText('abcd1234')).toBeInTheDocument();
    expect(screen.getByLabelText('Apelido')).toHaveValue('Bia');
    await user.click(screen.getByRole('button', { name: 'Entrar na mesa' }));
    expect(aoEntrar).toHaveBeenCalledWith('Bia');
  });
});
