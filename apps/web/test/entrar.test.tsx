import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BotaoGoogle, type GoogleId } from '../src/componentes/BotaoGoogle';
import { Cabecalho } from '../src/componentes/Cabecalho';
import { ErroApi } from '../src/rede/api';
import { TelaEntrar } from '../src/telas/Entrar';

const USUARIO = { id: 1, apelido: 'ana', email: 'ana@x.com' };
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

  test('aparece na tela Entrar quando o servidor tem Google', () => {
    render(<TelaEntrar token={null} config={{ google: 'cid', emailTeste: false }} api={apiFalsa()} aoEntrar={vi.fn()} carregarGoogle={() => new Promise(() => {})} />);
    expect(screen.getByTestId('botao-google')).toBeInTheDocument();
  });
});

describe('Cabecalho', () => {
  test('convidado vê Entrar; logado vê apelido, Perfil, Histórico e Sair da conta', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Cabecalho usuario={null} aoSair={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '#/entrar');
    expect(screen.queryByRole('link', { name: 'Perfil' })).toBeNull();
    const aoSair = vi.fn();
    rerender(<Cabecalho usuario={USUARIO} aoSair={aoSair} />);
    expect(screen.getByTestId('usuario-logado')).toHaveTextContent('ana');
    expect(screen.getByRole('link', { name: 'Histórico' })).toHaveAttribute('href', '#/historico');
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(aoSair).toHaveBeenCalled();
  });
});
