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
