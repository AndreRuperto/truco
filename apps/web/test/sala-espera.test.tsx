import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InfoCadeira } from '@truco/protocolo';
import { describe, expect, test, vi } from 'vitest';
import { SalaEspera } from '../src/telas/SalaEspera';
import { MINEIRO, msgEstado } from './fixtures';

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
    const { rerender } = render(<SalaEspera msg={msgEstado(null, 0, { cadeiras, humanosEsperados: 4 })} aoIniciar={aoIniciar} aoSair={vi.fn()} />);
    expect(screen.getByText('Esperando 2 jogadores…')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Começar com bots' }));
    expect(aoIniciar).toHaveBeenCalledTimes(1);

    rerender(<SalaEspera msg={msgEstado(null, 2, { cadeiras })} aoIniciar={aoIniciar} aoSair={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Começar com bots' })).toBeNull();
    expect(screen.getByText('Bia (você)')).toBeInTheDocument();
  });

  test('mostra um resumo das regras da mesa', () => {
    const regras = { ...MINEIRO, maoDe11: 'onzeAOnze' as const, familia: 'aberta' as const };
    render(<SalaEspera msg={msgEstado(null, 0, { cadeiras, regras, chanceInterceptarSinal: 0.25 })} aoIniciar={vi.fn()} aoSair={vi.fn()} />);
    const lista = screen.getByRole('list', { name: 'Regras da mesa' });
    expect(lista).toHaveTextContent('Mineiro');
    expect(lista).toHaveTextContent('Pontos 2 · 4 · 8 · 10 · 12');
    expect(lista).toHaveTextContent('Mão de 10 ligada');
    expect(lista).toHaveTextContent('Mão de 11 só no 11 a 11');
    expect(lista).toHaveTextContent('Família aberta');
    expect(lista).toHaveTextContent('Adversários às vezes interceptam sinais');
  });

  test('mão limpa aparece nas regras da sala; mesa comum não fala nela', () => {
    const { rerender } = render(
      <SalaEspera msg={msgEstado(null, 0, { cadeiras, regras: { ...MINEIRO, maoLimpa: true } })} aoIniciar={vi.fn()} aoSair={vi.fn()} />,
    );
    expect(screen.getByRole('list', { name: 'Regras da mesa' })).toHaveTextContent('Mão limpa (sem 4 a 7, com 2 coringas)');
    rerender(<SalaEspera msg={msgEstado(null, 0, { cadeiras, regras: MINEIRO })} aoIniciar={vi.fn()} aoSair={vi.fn()} />);
    expect(screen.getByRole('list', { name: 'Regras da mesa' })).not.toHaveTextContent('Mão limpa');
  });

  test('conta os humanos que faltam, não as cadeiras vazias (bots completam o resto)', () => {
    const so: InfoCadeira[] = [
      { tipo: 'humano', nome: 'Ana', conectado: true },
      { tipo: 'vazia', nome: null, conectado: true },
      { tipo: 'vazia', nome: null, conectado: true },
      { tipo: 'vazia', nome: null, conectado: true },
    ];
    const { rerender } = render(<SalaEspera msg={msgEstado(null, 0, { cadeiras: so, humanosEsperados: 2 })} aoIniciar={vi.fn()} aoSair={vi.fn()} />);
    expect(screen.getByText('Esperando 1 jogador…')).toBeInTheDocument();
    rerender(<SalaEspera msg={msgEstado(null, 0, { cadeiras: so, humanosEsperados: 3 })} aoIniciar={vi.fn()} aoSair={vi.fn()} />);
    expect(screen.getByText('Esperando 2 jogadores…')).toBeInTheDocument();
    rerender(<SalaEspera msg={msgEstado(null, 0, { cadeiras: so, humanosEsperados: 1 })} aoIniciar={vi.fn()} aoSair={vi.fn()} />);
    expect(screen.getByText('Começando…')).toBeInTheDocument();
  });

  test('sair', async () => {
    const user = userEvent.setup();
    const aoSair = vi.fn();
    render(<SalaEspera msg={msgEstado(null, 0, { cadeiras })} aoIniciar={vi.fn()} aoSair={aoSair} />);
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(aoSair).toHaveBeenCalled();
  });
});
