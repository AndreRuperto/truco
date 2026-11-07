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

  test('sem proxy confiável, X-Forwarded-For não muda o IP do limite', async () => {
    for (const ip of ['9.9.9.1', '9.9.9.2']) {
      expect((await app.pedir('/api/auth/link', { corpo: { email: `${ip}@x.com` }, headers: { 'x-forwarded-for': ip } })).status).toBe(204);
    }
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'z@x.com' }, headers: { 'x-forwarded-for': '9.9.9.3' } })).status).toBe(429);
  });

  test('com proxy confiável, o IP vem do X-Forwarded-For (IPv6 agrupado por /64)', async () => {
    await app.fechar();
    app = await subirApp({ ...s, confiarProxy: true }, { limiteLinkIp: new LimiteTaxa(2, 60_000) });
    const pedir = (ip: string, email: string) => app.pedir('/api/auth/link', { corpo: { email }, headers: { 'x-forwarded-for': ip } });
    expect((await pedir('2001:db8:1:2::1', 'a@x.com')).status).toBe(204);
    expect((await pedir('2001:db8:1:2::2', 'b@x.com')).status).toBe(204);
    expect((await pedir('2001:db8:1:2::3', 'c@x.com')).status).toBe(429);
    expect((await pedir('2001:db8:1:3::1', 'd@x.com')).status).toBe(204);
  });

  test('produção sem URL pública não monta link a partir do Host', async () => {
    await app.fechar();
    app = await subirApp({ ...s, producao: true, urlPublica: null });
    const r = await app.pedir('/api/auth/link', { corpo: { email: 'a@x.com' }, headers: { host: 'malicioso.com' } });
    expect(r.status).toBe(500);
    expect(s.caixaTeste!.enviados).toEqual([]);
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

  test('cookie vencido não esconde um Bearer válido', async () => {
    const cookie = await entrarPorLink('ana@x.com');
    const token = cookie.split('=')[1];
    const vencido = 'truco_sessao=sessao-vencida-ou-apagada';
    expect((await app.pedir('/api/eu', { cookie: vencido, auth: `Bearer ${token}` })).json.usuario.apelido).toBe('ana');
    expect((await app.pedir('/api/perfil', { cookie: vencido, auth: `Bearer ${token}` })).status).toBe(200);
    // Sair com os dois encerra a sessão do Bearer também.
    expect((await app.pedir('/api/auth/sair', { corpo: {}, cookie: vencido, auth: `Bearer ${token}` })).status).toBe(204);
    expect((await app.pedir('/api/eu', { auth: `Bearer ${token}` })).json.usuario).toBeNull();
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

describe('foto de perfil', () => {
  // PNG 1x1 de verdade.
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  test('avatar pronto, foto, remover; recusa id desconhecido, tipo trocado e foto grande', async () => {
    expect((await app.pedir('/api/eu/avatar', { metodo: 'PUT', corpo: { avatar: 'pronto:zap' } })).status).toBe(401);
    const cookie = await entrarPorLink('ana@x.com');
    expect((await app.pedir('/api/eu', { cookie })).json.usuario.avatar).toBeNull();
    const r = await app.pedir('/api/eu/avatar', { metodo: 'PUT', corpo: { avatar: 'pronto:galo' }, cookie });
    expect(r.status).toBe(200);
    expect(r.json.usuario.avatar).toBe('pronto:galo');
    expect((await app.pedir('/api/eu/avatar', { metodo: 'PUT', corpo: { avatar: 'pronto:nada' }, cookie })).status).toBe(400);
    const foto = await app.pedir('/api/eu/avatar', { metodo: 'PUT', corpo: { avatar: PNG }, cookie });
    expect(foto.json.usuario.avatar).toBe(PNG);
    expect((await app.pedir('/api/perfil', { cookie })).json.usuario.avatar).toBe(PNG);
    // diz que é jpeg mas é png
    const trocado = PNG.replace('image/png', 'image/jpeg');
    expect((await app.pedir('/api/eu/avatar', { metodo: 'PUT', corpo: { avatar: trocado }, cookie })).status).toBe(400);
    const grande = 'data:image/png;base64,' + 'A'.repeat(70_000);
    expect((await app.pedir('/api/eu/avatar', { metodo: 'PUT', corpo: { avatar: grande }, cookie })).status).toBe(400);
    expect((await app.pedir('/api/eu/avatar', { metodo: 'PUT', corpo: { avatar: 'javascript:alert(1)' }, cookie })).status).toBe(400);
    const sem = await app.pedir('/api/eu/avatar', { metodo: 'PUT', corpo: { avatar: null }, cookie });
    expect(sem.json.usuario.avatar).toBeNull();
  });
});

describe('preferências da mesa', () => {
  const prefs = {
    variante: 'mineiro',
    pontuacao: '1-3-6-9-12',
    maoDe10: true,
    maoDe11: 'qualquerDupla',
    familia: 'fechada',
    maoLimpa: true,
    humanos: 1,
    nivelBot: 'dificil',
    chanceInterceptarSinal: 0.25,
    tempoFamiliaS: 25,
    sinais: true,
  };

  test('401 sem login; nulo antes de salvar; salva, lê de volta e valida', async () => {
    expect((await app.pedir('/api/preferencias')).status).toBe(401);
    expect((await app.pedir('/api/preferencias', { metodo: 'PUT', corpo: { preferencias: prefs } })).status).toBe(401);
    const cookie = await entrarPorLink('ana@x.com');
    expect((await app.pedir('/api/preferencias', { cookie })).json).toEqual({ preferencias: null });
    const salvo = await app.pedir('/api/preferencias', { metodo: 'PUT', corpo: { preferencias: prefs }, cookie });
    expect(salvo.status).toBe(200);
    expect(salvo.json.preferencias).toEqual(prefs);
    expect((await app.pedir('/api/preferencias', { cookie })).json.preferencias).toEqual(prefs);
    expect((await app.pedir('/api/preferencias', { metodo: 'PUT', corpo: { preferencias: 'x' }, cookie })).status).toBe(400);
  });

  test('valores estranhos viram os da regra válida (mão limpa só no mineiro, humanos 1..4)', async () => {
    const cookie = await entrarPorLink('ana@x.com');
    const r = await app.pedir('/api/preferencias', {
      metodo: 'PUT',
      corpo: { preferencias: { ...prefs, variante: 'paulista', humanos: 9, pontuacao: 'xx', modo: 'ranqueada' } },
      cookie,
    });
    expect(r.status).toBe(200);
    expect(r.json.preferencias).toMatchObject({ variante: 'paulista', maoLimpa: false, humanos: 1, pontuacao: '1-3-6-9-12', nivelBot: 'dificil' });
    expect(r.json.preferencias).not.toHaveProperty('modo');
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
  test('conectar Google à conta do link mágico: 401 sem login, liga, vale para entrar e não rouba de outra conta', async () => {
    expect((await app.pedir('/api/eu/google', { corpo: { credencial: 'credencial-boa' } })).status).toBe(401);
    const cookie = await entrarPorLink('ana@x.com');
    expect((await app.pedir('/api/eu', { cookie })).json.usuario).toMatchObject({ email: 'ana@x.com', google: false });
    expect((await app.pedir('/api/eu/google', { corpo: { credencial: 'falsa' }, cookie })).status).toBe(401);
    const r = await app.pedir('/api/eu/google', { corpo: { credencial: 'credencial-boa' }, cookie });
    expect(r.status).toBe(200);
    expect(r.json.usuario).toMatchObject({ email: 'ana@x.com', google: true });
    // Entrar pelo Google agora cai na mesma conta (mesmo com o e-mail do Google sendo outro).
    const g = await app.pedir('/api/auth/google', { corpo: { credencial: 'credencial-boa' } });
    expect(g.json.usuario).toMatchObject({ id: r.json.usuario.id, google: true });
    // Outra conta não consegue pegar o mesmo Google.
    const outro = await entrarPorLink('caio@x.com');
    expect((await app.pedir('/api/eu/google', { corpo: { credencial: 'credencial-boa' }, cookie: outro })).status).toBe(409);
  });
});
