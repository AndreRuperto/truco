import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PerfilApi } from '@truco/api';
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

const USUARIO = { id: 1, apelido: 'ana', email: 'ana@x.com', google: false };
const RV = { elo: 1000, pontos: 0, patente: 'Bronze', proxima: null, partidasRanqueadas: 0, jogos: 0, vitorias: 0, pctTrucoAceito: null, corridas: 0 };
const PERFIL: PerfilApi = { usuario: { id: 1, apelido: 'ana' }, variantes: { paulista: RV, mineiro: RV } };

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
    expect(screen.getByText('Conexão caiu — reconectando…')).toHaveAttribute('role', 'status');
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

  test('sair da conta volta ao início e não deixa dados do usuário anterior na tela', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'config').mockResolvedValue({ google: null, emailTeste: false });
    vi.spyOn(api, 'eu').mockResolvedValue({ usuario: USUARIO });
    vi.spyOn(api, 'perfil').mockResolvedValue(PERFIL);
    vi.spyOn(api, 'sair').mockResolvedValue(undefined);
    window.history.replaceState(null, '', '/#/perfil');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'ana' })).toBeInTheDocument();
    await user.click(screen.getByTestId('usuario-logado'));
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(screen.queryByRole('heading', { name: 'ana' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  });

  test('convidado em Perfil/Histórico (ou sessão expirada) recebe link para entrar', async () => {
    vi.spyOn(api, 'config').mockResolvedValue({ google: null, emailTeste: false });
    vi.spyOn(api, 'eu').mockResolvedValue({ usuario: null });
    const historico = vi.spyOn(api, 'historico').mockResolvedValue({ partidas: [] });
    window.history.replaceState(null, '', '/#/historico');
    render(<App />);
    expect(await screen.findByRole('link', { name: 'entre na sua conta' })).toHaveAttribute('href', '#/entrar');
    expect(historico).not.toHaveBeenCalled();
    act(() => {
      window.location.hash = '#/perfil';
    });
    expect(await screen.findByRole('link', { name: 'entre na sua conta' })).toHaveAttribute('href', '#/entrar');
    act(() => sessao.definirUsuario(USUARIO));
    act(() => {
      window.location.hash = '#/historico';
    });
    expect(await screen.findByText('Nenhuma partida ainda.')).toBeInTheDocument();
    act(() => sessao.definirUsuario(null)); // o que o 401 faz
    expect(await screen.findByRole('link', { name: 'entre na sua conta' })).toBeInTheDocument();
  });
});
