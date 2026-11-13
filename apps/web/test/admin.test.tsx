import type { UsuarioAdmin } from '@truco/api';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ErroApi } from '../src/rede/api';
import { TelaAdmin } from '../src/telas/Admin';

const ANA: UsuarioAdmin = {
  id: 2,
  apelido: 'ana',
  email: 'ana@x.com',
  google: false,
  avatar: null,
  criadoEm: '2026-11-01T10:00:00Z',
  banidoEm: null,
  admin: false,
  partidas: 3,
};

function apiFalsa(extra: Partial<Record<string, unknown>> = {}) {
  return {
    admin: {
      resumo: vi.fn(async () => ({
        usuarios: 7,
        banidos: 1,
        partidas: 40,
        mesasAtivas: 2,
        porDia: Array.from({ length: 14 }, (_, i) => ({ dia: `2026-11-${String(i + 1).padStart(2, '0')}`, usuarios: i % 2, partidas: i })),
      })),
      usuarios: vi.fn(async () => ({ usuarios: [ANA] })),
      trocarApelido: vi.fn(async () => ({ usuario: { id: 2, apelido: 'ana2', email: null, google: false } })),
      banir: vi.fn(async () => undefined),
      desbanir: vi.fn(async () => undefined),
      mesas: vi.fn(async () => ({ mesas: [] })),
      partidas: vi.fn(async () => ({ partidas: [] })),
      ...extra,
    },
  } as any;
}

describe('TelaAdmin', () => {
  test('resumo mostra os números e as abas', async () => {
    render(<TelaAdmin aba="resumo" api={apiFalsa()} />);
    expect(await screen.findByText('40')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Resumo' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '#/admin/usuarios');
    expect(screen.getByText('Partidas por dia')).toBeInTheDocument();
  });

  test('resumo mostra a saúde do servidor: jogadores conectados, versão e tempo do banco (F5.4)', async () => {
    const resumo = vi.fn(async () => ({ usuarios: 7, banidos: 1, partidas: 40, mesasAtivas: 2, jogadoresConectados: 5, versao: 'abc1234', bancoMs: 3, porDia: [] }));
    render(<TelaAdmin aba="resumo" api={apiFalsa({ resumo })} />);
    const numeros = await screen.findByRole('group', { name: 'Saúde do servidor' });
    expect(numeros).toHaveTextContent('Jogadores conectados5');
    expect(numeros).toHaveTextContent('Versãoabc1234');
    expect(numeros).toHaveTextContent('Banco3 ms');
  });

  test('quem não é admin vê o recado do 403', async () => {
    const api = apiFalsa({ resumo: vi.fn(async () => Promise.reject(new ErroApi(403, 'só para admin'))) });
    render(<TelaAdmin aba="resumo" api={api} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('só para quem administra');
  });

  test('usuários: buscar, banir com confirmação e trocar apelido', async () => {
    const user = userEvent.setup();
    const api = apiFalsa();
    render(<TelaAdmin aba="usuarios" api={api} />);
    const cartao = await screen.findByRole('listitem', { name: 'ana' });
    await user.type(screen.getByRole('searchbox'), 'ana');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(api.admin.usuarios).toHaveBeenLastCalledWith('ana');

    await user.click(within(cartao).getByRole('button', { name: 'Banir…' }));
    expect(api.admin.banir).not.toHaveBeenCalled();
    await user.click(within(cartao).getByRole('button', { name: 'Banir' }));
    expect(api.admin.banir).toHaveBeenCalledWith(2);

    await user.click(within(screen.getByRole('listitem', { name: 'ana' })).getByRole('button', { name: 'Trocar apelido' }));
    const campo = screen.getByLabelText('Novo apelido');
    await user.clear(campo);
    await user.type(campo, 'ana2');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(api.admin.trocarApelido).toHaveBeenCalledWith(2, 'ana2');
  });
});

describe('admin da loja e auditoria (F4.7)', () => {
  const PEDIDOS = [
    { id: 'p-pago', pacoteId: 'bolso', pila: 220, valorCentavos: 990, status: 'pago', usuarioId: 2, apelido: 'ana', captureMethod: 'pix', criadoEm: '2026-11-10T12:00:00Z', pagoEm: '2026-11-10T12:01:00Z' },
    { id: 'p-criado', pacoteId: 'punhado', pila: 90, valorCentavos: 490, status: 'criado', usuarioId: 3, apelido: 'bia', captureMethod: null, criadoEm: '2026-11-10T13:00:00Z', pagoEm: null },
  ];

  test('pedidos: tabela com data, usuário, pacote, valor e status; estorno só no pago e com confirmação', async () => {
    const user = userEvent.setup();
    const estorno = vi.fn(async () => ({ resultado: 'estornado', debitado: 220, faltou: 0 }));
    const api = apiFalsa({ pedidos: vi.fn(async () => ({ pedidos: PEDIDOS })), estorno });
    render(<TelaAdmin aba="pedidos" api={api} />);
    const tabela = await screen.findByRole('table', { name: 'Pedidos de Pila' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toHaveTextContent('ana');
    expect(linhas[1]).toHaveTextContent('bolso');
    expect(linhas[1]).toHaveTextContent('R$ 9,90');
    expect(linhas[1]).toHaveTextContent('pago');
    expect(within(linhas[2]).queryByRole('button', { name: /estornado/ })).toBeNull();
    await user.click(within(linhas[1]).getByRole('button', { name: 'Marcar estornado…' }));
    expect(estorno).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar estorno' }));
    expect(estorno).toHaveBeenCalledWith('p-pago');
    expect(await screen.findByRole('status')).toHaveTextContent('Estornado: 220 Pila tirados.');
  });

  test('usuários: ajuste de saldo exige motivo e confirmação antes de enviar', async () => {
    const user = userEvent.setup();
    const ajuste = vi.fn(async () => ({ saldo: 1050 }));
    render(<TelaAdmin aba="usuarios" api={apiFalsa({ ajuste })} />);
    const cartao = await screen.findByRole('listitem', { name: 'ana' });
    await user.click(within(cartao).getByRole('button', { name: 'Ajustar saldo…' }));
    await user.selectOptions(within(cartao).getByLabelText('Moeda'), 'fichas');
    await user.type(within(cartao).getByLabelText('Quanto (use - para tirar)'), '50');
    await user.click(within(cartao).getByRole('button', { name: 'Revisar' }));
    expect(within(cartao).getByRole('alert')).toHaveTextContent('Diga o motivo');
    await user.type(within(cartao).getByLabelText('Motivo'), 'compensação');
    await user.click(within(cartao).getByRole('button', { name: 'Revisar' }));
    expect(ajuste).not.toHaveBeenCalled();
    expect(within(cartao).getByText(/\+50 Fichas para ana/)).toBeInTheDocument();
    await user.click(within(cartao).getByRole('button', { name: 'Confirmar ajuste' }));
    expect(ajuste).toHaveBeenCalledWith(2, 'fichas', 50, 'compensação');
  });

  test('auditoria: lista o que os admins fizeram, mais nova primeiro', async () => {
    const auditoria = vi.fn(async () => ({
      auditoria: [
        { id: 2, adminId: 1, admin: 'chefe', acao: 'ajuste_saldo', alvoId: 2, detalhe: { moeda: 'fichas', delta: 50, motivo: 'compensação' }, criadoEm: '2026-11-10T12:00:00Z' },
        { id: 1, adminId: 1, admin: 'chefe', acao: 'banir', alvoId: 3, detalhe: null, criadoEm: '2026-11-10T11:00:00Z' },
      ],
    }));
    render(<TelaAdmin aba="auditoria" api={apiFalsa({ auditoria })} />);
    const itens = await screen.findAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('chefe');
    expect(itens[0]).toHaveTextContent('ajustou o saldo de #2');
    expect(itens[0]).toHaveTextContent('+50 Fichas');
    expect(itens[0]).toHaveTextContent('compensação');
    expect(itens[1]).toHaveTextContent('baniu #3');
  });
});

