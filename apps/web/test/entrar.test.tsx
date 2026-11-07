import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BotaoGoogle, type GoogleId } from '../src/componentes/BotaoGoogle';
import { Cabecalho } from '../src/componentes/Cabecalho';
import { ErroApi } from '../src/rede/api';
import { TelaEntrar } from '../src/telas/Entrar';

const USUARIO = { id: 1, apelido: 'ana', email: 'ana@x.com', google: false };
const SEM_GOOGLE = { google: null, emailTeste: false };

function apiFalsa() {
  return {
    pedirLink: vi.fn(async () => undefined),
    confirmarLink: vi.fn(async () => ({ usuario: USUARIO })),
    entrarGoogle: vi.fn(async () => ({ usuario: USUARIO })),
  };
}

describe('TelaEntrar', () => {
  test('pede o link e avisa para abrir neste navegador', async () => {
    const user = userEvent.setup();
    const api = apiFalsa();
    render(<TelaEntrar token={null} config={SEM_GOOGLE} api={api} aoEntrar={vi.fn()} />);
    await user.type(screen.getByLabelText('E-mail'), 'ana@x.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(api.pedirLink).toHaveBeenCalledWith('ana@x.com');
    expect(await screen.findByText(/Enviamos um link/)).toHaveTextContent('ana@x.com');
    expect(screen.queryByTestId('botao-google')).toBeNull();
  });

  test('depois de enviado dá para corrigir o e-mail ou reenviar', async () => {
    const user = userEvent.setup();
    const api = apiFalsa();
    render(<TelaEntrar token={null} config={SEM_GOOGLE} api={api} aoEntrar={vi.fn()} />);
    await user.type(screen.getByLabelText('E-mail'), 'ana@x.co');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    await user.click(await screen.findByRole('button', { name: 'Reenviar link' }));
    expect(api.pedirLink).toHaveBeenCalledTimes(2);
    await user.click(await screen.findByRole('button', { name: 'Corrigir e-mail' }));
    const campo = screen.getByLabelText('E-mail');
    expect(campo).toHaveValue('ana@x.co');
    await user.type(campo, 'm');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(api.pedirLink).toHaveBeenLastCalledWith('ana@x.com');
  });

  test('erro do servidor aparece como alerta', async () => {
    const user = userEvent.setup();
    const api = { ...apiFalsa(), pedirLink: vi.fn(async () => Promise.reject(new ErroApi(429, 'muitos pedidos; tente de novo em alguns minutos'))) };
    render(<TelaEntrar token={null} config={SEM_GOOGLE} api={api} aoEntrar={vi.fn()} />);
    await user.type(screen.getByLabelText('E-mail'), 'ana@x.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('muitos pedidos');
  });

  test('com token na rota, confirma uma vez só e entra', async () => {
    const api = apiFalsa();
    const aoEntrar = vi.fn();
    const { rerender } = render(<TelaEntrar token="tok" config={SEM_GOOGLE} api={api} aoEntrar={aoEntrar} />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando…');
    await waitFor(() => expect(aoEntrar).toHaveBeenCalledWith(USUARIO));
    rerender(<TelaEntrar token="tok" config={SEM_GOOGLE} api={api} aoEntrar={aoEntrar} />);
    expect(api.confirmarLink).toHaveBeenCalledTimes(1);
  });

  test('tira o token da URL (sem novo item no histórico) antes de confirmar', async () => {
    window.history.replaceState({ marca: 1 }, '', '/?x=1#/entrar?token=tok');
    const comprimento = window.history.length;
    let hashNaHora = '';
    const api = {
      ...apiFalsa(),
      confirmarLink: vi.fn(async () => {
        hashNaHora = window.location.hash;
        return { usuario: USUARIO };
      }),
    };
    const aoEntrar = vi.fn();
    render(<TelaEntrar token="tok" config={SEM_GOOGLE} api={api} aoEntrar={aoEntrar} />);
    await waitFor(() => expect(aoEntrar).toHaveBeenCalledWith(USUARIO));
    expect(api.confirmarLink).toHaveBeenCalledWith('tok');
    expect(hashNaHora).toBe('#/entrar');
    expect(window.location.search).toBe('?x=1');
    expect(window.history.state).toEqual({ marca: 1 });
    expect(window.history.length).toBe(comprimento);
    window.history.replaceState(null, '', '/');
  });

  test('token inválido mostra o erro e volta ao formulário', async () => {
    const api = { ...apiFalsa(), confirmarLink: vi.fn(async () => Promise.reject(new ErroApi(400, 'link inválido ou expirado; peça outro'))) };
    render(<TelaEntrar token="velho" config={SEM_GOOGLE} api={api} aoEntrar={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('link inválido');
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });
});

describe('BotaoGoogle', () => {
  test('inicializa com o client ID, desenha o botão e repassa a credencial', async () => {
    const capturado: { cb?: (r: { credential: string }) => void } = {};
    const g: GoogleId = {
      initialize: vi.fn((o: Parameters<GoogleId['initialize']>[0]) => {
        capturado.cb = o.callback;
      }),
      renderButton: vi.fn(),
    };
    const aoCredencial = vi.fn();
    render(<BotaoGoogle clientId="cid" aoCredencial={aoCredencial} carregar={async () => g} />);
    await waitFor(() => expect(g.renderButton).toHaveBeenCalledWith(screen.getByTestId('botao-google'), expect.objectContaining({ locale: 'pt-BR' })));
    expect(g.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'cid' }));
    capturado.cb!({ credential: 'jwt' });
    expect(aoCredencial).toHaveBeenCalledWith('jwt');
  });

  test('se o script do Google não carregar, avisa em texto curto', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<BotaoGoogle clientId="cid" aoCredencial={vi.fn()} carregar={async () => Promise.reject(new Error('rede'))} />);
    expect(await screen.findByText('Login com Google indisponível agora.')).toBeInTheDocument();
  });

  test('aparece na tela Entrar quando o servidor tem Google', () => {
    render(<TelaEntrar token={null} config={{ google: 'cid', emailTeste: false }} api={apiFalsa()} aoEntrar={vi.fn()} carregarGoogle={() => new Promise(() => {})} />);
    expect(screen.getByTestId('botao-google')).toBeInTheDocument();
  });

  test('409 do server (e-mail ligado a outra conta Google) mostra a mensagem com o link mágico', async () => {
    const msg = 'este e-mail já está ligado a outra conta Google; entre pelo link mágico';
    let credencial: ((r: { credential: string }) => void) | null = null;
    const g: GoogleId = {
      initialize: vi.fn((o: Parameters<GoogleId['initialize']>[0]) => {
        credencial = o.callback;
      }),
      renderButton: vi.fn(),
    };
    const api = { ...apiFalsa(), entrarGoogle: vi.fn(async () => Promise.reject(new ErroApi(409, msg))) };
    const aoEntrar = vi.fn();
    render(<TelaEntrar token={null} config={{ google: 'cid', emailTeste: false }} api={api} aoEntrar={aoEntrar} carregarGoogle={async () => g} />);
    await waitFor(() => expect(credencial).not.toBeNull());
    credencial!({ credential: 'jwt' });
    expect(await screen.findByRole('alert')).toHaveTextContent(msg);
    expect(api.entrarGoogle).toHaveBeenCalledWith('jwt');
    expect(aoEntrar).not.toHaveBeenCalled();
  });
});

describe('Cabecalho', () => {
  test('convidado vê Entrar; logado vê o apelido, que abre Meu perfil, Editar perfil, Histórico e Sair da conta', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Cabecalho pronta usuario={null} aoSair={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '#/entrar');
    expect(screen.queryByRole('link', { name: 'Perfil' })).toBeNull();
    const aoSair = vi.fn();
    rerender(<Cabecalho pronta usuario={USUARIO} aoSair={aoSair} />);
    const conta = screen.getByTestId('usuario-logado');
    expect(conta).toHaveTextContent('ana');
    expect(conta).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Sair da conta' })).toBeNull();
    await user.click(conta);
    expect(conta).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('href', '#/perfil');
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', '#/perfil?editar');
    expect(screen.getByRole('link', { name: 'Histórico' })).toHaveAttribute('href', '#/historico');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: 'Meu perfil' })).toBeNull();
    expect(conta).toHaveFocus();
    await user.click(conta);
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(aoSair).toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });

  test('só admin vê o item Admin no menu da conta', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Cabecalho pronta usuario={{ ...USUARIO, admin: false }} aoSair={vi.fn()} />);
    await user.click(screen.getByTestId('usuario-logado'));
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    rerender(<Cabecalho pronta usuario={{ ...USUARIO, admin: true }} aoSair={vi.fn()} atual="admin" />);
    const link = screen.getByRole('link', { name: 'Admin' });
    expect(link).toHaveAttribute('href', '#/admin');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  test('antes de a sessão ficar pronta não mostra Entrar nem a conta (sem piscar)', () => {
    render(<Cabecalho pronta={false} usuario={null} aoSair={vi.fn()} />);
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sair da conta' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Início' })).toBeInTheDocument();
  });
});
