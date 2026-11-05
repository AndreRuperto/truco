import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ModoMesa, type MsgEstado, SAIDA_PARTIDA_CANCELADA } from '@truco/protocolo';
import { describe, expect, test, vi } from 'vitest';
import { criarLoja, type EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { SalaEspera } from '../src/telas/SalaEspera';
import { distribuida, msgEstado, PAULISTA } from './fixtures';
import { SalaFalsa } from './sala-falsa';

// TEMPORÁRIO: enquanto `MsgEstado` não tem `modo` (Tarefa 11 do server), o extra passa por cast.
const comModo = (modo: ModoMesa) => ({ modo }) as unknown as Partial<MsgEstado>;

const acoesFalsas = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn(async () => {}) });
const snap = (modo: 'classica' | 'privada' | 'ranqueada'): EstadoLoja => ({
  status: 'na-mesa',
  msg: msgEstado(distribuida(PAULISTA), 0, comModo(modo)),
  eventos: [],
  erro: null,
  chat: [{ de: 1, nome: 'Bia', texto: 'bora' }],
  salaId: 'abcd1234',
});

describe('loja: chat, sala e cancelamento', () => {
  test('guarda mensagens de chat, envia e esquece ao sair', async () => {
    const loja = criarLoja();
    const sala = new SalaFalsa();
    loja.conectar(sala);
    expect(loja.getSnapshot().salaId).toBe('r1');
    sala.receber('chat', { de: 2, nome: 'Cid', texto: 'oi' });
    expect(loja.getSnapshot().chat).toEqual([{ de: 2, nome: 'Cid', texto: 'oi' }]);
    loja.enviarChat('olá');
    expect(sala.enviados.at(-1)).toEqual(['chat', 'olá']);
    await loja.sair();
    expect(loja.getSnapshot()).toMatchObject({ chat: [], salaId: null });
  });

  test('ranqueada cancelada volta ao lobby com aviso', () => {
    const loja = criarLoja();
    const sala = new SalaFalsa();
    loja.conectar(sala);
    sala.emit('leave', SAIDA_PARTIDA_CANCELADA);
    expect(loja.getSnapshot().status).toBe('fora');
    expect(loja.getSnapshot().erro?.mensagem).toBe('Partida ranqueada cancelada: nem todos entraram a tempo');
  });
});

describe('SalaEspera', () => {
  test('privada mostra o link de convite e o chat', async () => {
    const user = userEvent.setup();
    const aoChat = vi.fn();
    render(
      <SalaEspera
        msg={msgEstado(null, 0, comModo('privada'))}
        aoIniciar={vi.fn()}
        aoSair={vi.fn()}
        salaId="abcd1234"
        origem="https://truco.app"
        chat={[]}
        aoChat={aoChat}
      />,
    );
    expect(screen.getByLabelText('Link de convite')).toHaveValue('https://truco.app/#/privada/abcd1234');
    await user.type(screen.getByLabelText('Mensagem'), 'vem logo{Enter}');
    expect(aoChat).toHaveBeenCalledWith('vem logo');
    expect(screen.getByLabelText('Mensagem')).toHaveValue('');
  });

  test('ranqueada não tem "Começar com bots" nem convite', () => {
    render(<SalaEspera msg={msgEstado(null, 0, comModo('ranqueada'))} aoIniciar={vi.fn()} aoSair={vi.fn()} salaId="x1234" />);
    expect(screen.queryByRole('button', { name: 'Começar com bots' })).toBeNull();
    expect(screen.queryByLabelText('Link de convite')).toBeNull();
    expect(screen.getByText(/começa quando todos entrarem/)).toBeInTheDocument();
  });
});

describe('TelaMesa', () => {
  test('Sair pede confirmação; na ranqueada avisa da derrota e do bloqueio', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    render(<TelaMesa snap={snap('ranqueada')} acoes={acoes} />);
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Sair da mesa' });
    expect(dialogo).toHaveTextContent('conta como derrota');
    await user.click(within(dialogo).getByRole('button', { name: 'Continuar jogando' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(acoes.sair).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    await user.click(screen.getByRole('button', { name: 'Sair da mesa' }));
    expect(acoes.sair).toHaveBeenCalled();
  });

  test('chat só aparece na privada', async () => {
    const user = userEvent.setup();
    const aoChat = vi.fn();
    const { unmount } = render(<TelaMesa snap={snap('classica')} acoes={acoesFalsas()} aoChat={aoChat} />);
    expect(screen.queryByRole('button', { name: 'Chat' })).toBeNull();
    unmount();
    render(<TelaMesa snap={snap('privada')} acoes={acoesFalsas()} aoChat={aoChat} />);
    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(within(screen.getByRole('region', { name: 'Chat da mesa' })).getByText('bora')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mensagem'), 'truco!{Enter}');
    expect(aoChat).toHaveBeenCalledWith('truco!');
  });
});
