import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { App } from '../src/App';
import { api, loja, sessao } from '../src/rede/instancia';
import { distribuida, msgEstado, PAULISTA } from './fixtures';
import { SalaFalsa } from './sala-falsa';

afterEach(async () => {
  await act(() => loja.sair());
  if (loja.getSnapshot().status !== 'fora') act(() => loja.falhouConexao());
  const erro = loja.getSnapshot().erro;
  if (erro) act(() => loja.limparErro(erro.id));
  sessionStorage.clear();
  act(() => sessao.definirUsuario(null));
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

const USUARIO = { id: 1, apelido: 'ana', email: 'ana@x.com' };

describe('App: telas conforme o status da loja', () => {
  test('lobby → conectando → entrando → sala de espera → mesa → reconectando → lobby', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Truco' })).toBeInTheDocument();

    act(() => loja.marcarConectando());
    expect(screen.getByText('Conectando…')).toBeInTheDocument();

    const sala = new SalaFalsa();
    act(() => loja.conectar(sala));
    expect(screen.getByText('Entrando na mesa…')).toBeInTheDocument();

    act(() => sala.receber('estado', msgEstado(null)));
    expect(screen.getByRole('heading', { name: 'Sala de espera' })).toBeInTheDocument();

    act(() => sala.receber('estado', msgEstado(distribuida(PAULISTA))));
    expect(screen.getByTestId('minha-mao')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sala de espera' })).toBeNull();

    act(() => sala.emit('drop', 1006));
    expect(screen.getByRole('status')).toHaveTextContent('reconectando');
    expect(screen.getByTestId('minha-mao')).toBeInTheDocument();

    act(() => sala.emit('reconnect'));
    expect(screen.queryByText(/reconectando/)).toBeNull();

    await act(() => loja.sair());
    expect(screen.getByRole('heading', { name: 'Truco' })).toBeInTheDocument();
  });

  test('conexão perdida volta ao lobby com o toast', () => {
    render(<App />);
    const sala = new SalaFalsa();
    act(() => loja.conectar(sala));
    act(() => sala.receber('estado', msgEstado(distribuida(PAULISTA))));
    act(() => sala.emit('leave', 1006));
    expect(screen.getByRole('heading', { name: 'Truco' })).toBeInTheDocument();
    expect(screen.getByText('Conexão com a mesa perdida')).toBeInTheDocument();
  });
});

describe('App: conta', () => {
  test('link mágico: entra e vai ao início substituindo a entrada do histórico', async () => {
    vi.spyOn(api, 'confirmarLink').mockResolvedValue({ usuario: USUARIO });
    window.history.replaceState(null, '', '/#/entrar?token=tok');
    const comprimento = window.history.length;
    render(<App />);
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(api.confirmarLink).toHaveBeenCalledWith('tok');
    expect(window.history.length).toBe(comprimento);
    expect(await screen.findByTestId('usuario-logado')).toHaveTextContent('ana');
  });
});
