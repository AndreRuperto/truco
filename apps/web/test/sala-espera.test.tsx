import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InfoCadeira } from '@truco/protocolo';
import { describe, expect, test, vi } from 'vitest';
import { SalaEspera } from '../src/telas/SalaEspera';
import { msgEstado } from './fixtures';

const cadeiras: InfoCadeira[] = [
  { tipo: 'humano', nome: 'Ana', conectado: true },
  { tipo: 'vazia', nome: null, conectado: true },
  { tipo: 'humano', nome: 'Bia', conectado: true },
  { tipo: 'vazia', nome: null, conectado: true },
];

describe('SalaEspera', () => {
  test('o dono vê "Começar com bots"; os outros não', async () => {
    const user = userEvent.setup();
    const aoIniciar = vi.fn();
    const { rerender } = render(<SalaEspera msg={msgEstado(null, 0, { cadeiras })} aoIniciar={aoIniciar} aoSair={vi.fn()} />);
    expect(screen.getByText('Esperando 2 jogadores…')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Começar com bots' }));
    expect(aoIniciar).toHaveBeenCalledTimes(1);

    rerender(<SalaEspera msg={msgEstado(null, 2, { cadeiras })} aoIniciar={aoIniciar} aoSair={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Começar com bots' })).toBeNull();
    expect(screen.getByText('Bia (você)')).toBeInTheDocument();
  });

  test('sair', async () => {
    const user = userEvent.setup();
    const aoSair = vi.fn();
    render(<SalaEspera msg={msgEstado(null, 0, { cadeiras })} aoIniciar={vi.fn()} aoSair={aoSair} />);
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(aoSair).toHaveBeenCalled();
  });
});
