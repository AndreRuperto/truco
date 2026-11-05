import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { extrairLink } from '../src/auth/emails';
import { LimiteTaxa } from '../src/auth/limite';
import { criarUsuario } from '../src/repo/usuarios';
import { type Servicos, servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';
import { cookieDe, subirApp, tokenDoLink } from './http-helpers';

let b: BancoDeTeste;
let s: Servicos;
let app: Awaited<ReturnType<typeof subirApp>>;

beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(async () => {
  await b.limpar();
  s = servicosDeTeste(b.db, {
    google: {
      clientId: 'cid-teste',
      verificar: async (c) => {
        if (c !== 'credencial-boa') throw new Error('assinatura inválida');
        return { sub: 'g-1', email: 'bia@x.com', emailVerificado: true, nome: 'Bia' };
      },
    },
  });
  app = await subirApp(s, { limiteLinkIp: new LimiteTaxa(2, 60_000) });
});
afterEach(() => app.fechar());
afterAll(() => b.fechar());

async function entrarPorLink(email: string): Promise<string> {
  expect((await app.pedir('/api/auth/link', { corpo: { email } })).status).toBe(204);
  const link = extrairLink(s.caixaTeste!.enviados.at(-1)!.texto)!;
  const r = await app.pedir('/api/auth/link/confirmar', { corpo: { token: tokenDoLink(link) } });
  expect(r.status).toBe(200);
  return cookieDe(r.setCookie);
}

describe('config e sessão', () => {
  test('config pública', async () => {
    const r = await app.pedir('/api/config');
    expect(r.json).toEqual({ google: 'cid-teste', emailTeste: true });
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  test('sem cookie: usuário nulo', async () => {
    expect((await app.pedir('/api/eu')).json).toEqual({ usuario: null });
  });
});

describe('link mágico', () => {
  test('pedir → e-mail com link no fragmento → confirmar → cookie de sessão', async () => {
    const r = await app.pedir('/api/auth/link', { corpo: { email: ' Ana@X.com ' } });
    expect(r.status).toBe(204);
    const e = s.caixaTeste!.enviados[0];
    expect(e.para).toBe('ana@x.com');
    const link = extrairLink(e.texto)!;
    expect(link).toMatch(/^http:\/\/truco\.test\/#\/entrar\?token=[A-Za-z0-9_-]{43}$/);

    const c = await app.pedir('/api/auth/link/confirmar', { corpo: { token: tokenDoLink(link) } });
    expect(c.status).toBe(200);
    expect(c.json.usuario).toMatchObject({ apelido: 'ana', email: 'ana@x.com' });
    expect(c.setCookie).toMatch(/^truco_sessao=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/);

    const eu = await app.pedir('/api/eu', { cookie: cookieDe(c.setCookie) });
    expect(eu.json.usuario.apelido).toBe('ana');

    const deNovo = await app.pedir('/api/auth/link/confirmar', { corpo: { token: tokenDoLink(link) } });
    expect(deNovo.status).toBe(400);
    expect(deNovo.json.erro).toMatch(/inválido ou expirado/);
  });

  test('e-mail inválido → 400; limite por IP → 429', async () => {
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'nada' } })).status).toBe(400);
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'a@x.com' } })).status).toBe(204);
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'b@x.com' } })).status).toBe(204);
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'c@x.com' } })).status).toBe(429);
  });

  test('POST sem JSON → 415; JSON quebrado → 400', async () => {
    expect((await app.pedir('/api/auth/link', { corpo: 'email=a@x.com', tipo: 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect((await app.pedir('/api/auth/link', { corpo: '{quebrado' })).status).toBe(400);
  });

  test('falha do provedor de e-mail → 502', async () => {
    await app.fechar();
    app = await subirApp({ ...s, emails: { enviar: async () => Promise.reject(new Error('fora do ar')) } });
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'a@x.com' } })).status).toBe(502);
  });
});

describe('sair, Bearer e apelido', () => {
  test('sair apaga a sessão e o cookie', async () => {
    const cookie = await entrarPorLink('ana@x.com');
    const r = await app.pedir('/api/auth/sair', { corpo: {}, cookie });
    expect(r.status).toBe(204);
    expect(r.setCookie).toMatch(/Max-Age=0/);
    expect((await app.pedir('/api/eu', { cookie })).json.usuario).toBeNull();
  });

  test('token de sessão também vale como Bearer', async () => {
    const cookie = await entrarPorLink('ana@x.com');
    const token = cookie.split('=')[1];
    expect((await app.pedir('/api/eu', { auth: `Bearer ${token}` })).json.usuario.apelido).toBe('ana');
  });

  test('trocar apelido: 401 sem login, 400 inválido, 409 em uso, 200 ok', async () => {
    await criarUsuario(b.db, { apelidoBase: 'bia' });
    expect((await app.pedir('/api/eu', { metodo: 'PATCH', corpo: { apelido: 'Novo' } })).status).toBe(401);
    const cookie = await entrarPorLink('ana@x.com');
    expect((await app.pedir('/api/eu', { metodo: 'PATCH', corpo: { apelido: 'ab' }, cookie })).status).toBe(400);
    expect((await app.pedir('/api/eu', { metodo: 'PATCH', corpo: { apelido: 'bia' }, cookie })).status).toBe(409);
    const ok = await app.pedir('/api/eu', { metodo: 'PATCH', corpo: { apelido: 'Aninha' }, cookie });
    expect(ok.status).toBe(200);
    expect(ok.json.usuario.apelido).toBe('Aninha');
  });
});

describe('Google', () => {
  test('credencial boa cria/entra; ruim → 401; desligado → 404', async () => {
    const r = await app.pedir('/api/auth/google', { corpo: { credencial: 'credencial-boa' } });
    expect(r.status).toBe(200);
    expect(r.json.usuario).toMatchObject({ apelido: 'Bia', email: 'bia@x.com' });
    expect(r.setCookie).toMatch(/^truco_sessao=/);
    expect((await app.pedir('/api/auth/google', { corpo: { credencial: 'falsa' } })).status).toBe(401);
    await app.fechar();
    app = await subirApp({ ...s, google: null });
    expect((await app.pedir('/api/auth/google', { corpo: { credencial: 'credencial-boa' } })).status).toBe(404);
  });

  test('e-mail já ligado a outro Google → 409', async () => {
    await criarUsuario(b.db, { apelidoBase: 'bia', email: 'bia@x.com', googleSub: 'g-outro' });
    const r = await app.pedir('/api/auth/google', { corpo: { credencial: 'credencial-boa' } });
    expect(r.status).toBe(409);
    expect(r.json.erro).toMatch(/outra conta Google/);
  });
});
