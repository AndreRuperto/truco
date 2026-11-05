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
  test('carregar termina pronta mesmo se a api lançar de forma síncrona', async () => {
    const s = criarSessao({
      config: vi.fn(() => {
        throw new Error('quebrou');
      }),
      eu: vi.fn(async () => ({ usuario: USUARIO })),
      sair: vi.fn(),
    });
    await s.carregar().catch(() => undefined);
    expect(s.getSnapshot().pronta).toBe(true);
  });
  test('login durante o carregar não é desfeito pela resposta atrasada de /api/eu', async () => {
    let soltar!: (v: { usuario: null }) => void;
    const s = criarSessao({ config: vi.fn(async () => ({ google: null, emailTeste: false })), eu: vi.fn(() => new Promise<{ usuario: null }>((ok) => (soltar = ok))), sair: vi.fn() });
    const p = s.carregar();
    s.definirUsuario(USUARIO);
    soltar({ usuario: null });
    await p;
    expect(s.getSnapshot()).toMatchObject({ pronta: true, usuario: USUARIO });
  });
});
