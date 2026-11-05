import { describe, expect, test, vi } from 'vitest';
import { criarSessao } from '../src/rede/sessao';

const USUARIO = { id: 1, apelido: 'ana', email: 'ana@x.com' };

describe('sessão', () => {
  test('carregar busca config e usuário', async () => {
    const s = criarSessao({
      config: vi.fn(async () => ({ google: 'cid', emailTeste: false })),
      eu: vi.fn(async () => ({ usuario: USUARIO })),
      sair: vi.fn(),
    });
    expect(s.getSnapshot().pronta).toBe(false);
    const ouvinte = vi.fn();
    s.subscribe(ouvinte);
    await s.carregar();
    expect(s.getSnapshot()).toEqual({ pronta: true, usuario: USUARIO, config: { google: 'cid', emailTeste: false } });
    expect(ouvinte).toHaveBeenCalled();
  });

  test('servidor fora do ar: pronta, sem usuário e sem Google', async () => {
    const s = criarSessao({ config: vi.fn(async () => Promise.reject(new Error('x'))), eu: vi.fn(async () => Promise.reject(new Error('x'))), sair: vi.fn() });
    await s.carregar();
    expect(s.getSnapshot()).toEqual({ pronta: true, usuario: null, config: { google: null, emailTeste: false } });
  });

  test('definirUsuario e sair (mesmo se o pedido falhar)', async () => {
    const s = criarSessao({ config: vi.fn(), eu: vi.fn(), sair: vi.fn(async () => Promise.reject(new Error('rede'))) });
    s.definirUsuario(USUARIO);
    expect(s.getSnapshot().usuario).toEqual(USUARIO);
    await s.sair();
    expect(s.getSnapshot().usuario).toBeNull();
  });
});
