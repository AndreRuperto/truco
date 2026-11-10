import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { extrairLink } from '../src/auth/emails';
import { LimiteTaxa } from '../src/auth/limite';
import { participacoes, partidas } from '../src/banco/schema';
import { type Servicos, servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';
import { cookieDe, subirApp, tokenDoLink } from './http-helpers';

let b: BancoDeTeste;
let s: Servicos;
let app: Awaited<ReturnType<typeof subirApp>>;

const AGORA = new Date('2026-11-07T15:00:00Z');

// Segurança (auditoria 2026-11-10): o ban derruba também as conexões em tempo real.
let derrubadas: number[] = [];
let liberadas: number[] = [];

beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(async () => {
  await b.limpar();
  s = servicosDeTeste(b.db, { admins: ['chefe@x.com'], agora: () => AGORA });
  derrubadas = [];
  liberadas = [];
  app = await subirApp(s, {
    limiteLinkIp: new LimiteTaxa(100, 60_000),
    limiteLinkEmail: new LimiteTaxa(100, 60_000),
    derrubarConta: (id) => void derrubadas.push(id),
    liberarConta: (id) => void liberadas.push(id),
    listarMesas: async () => [
      { id: 'abc', modo: 'privada', variante: 'mineiro', ocupados: 2, lugares: 4, privada: true, trancada: true, dono: 'chefe', criadaEm: AGORA.toISOString() },
    ],
  });
});
afterEach(() => app.fechar());
afterAll(() => b.fechar());

async function entrarPorLink(email: string) {
  expect((await app.pedir('/api/auth/link', { corpo: { email } })).status).toBe(204);
  const link = extrairLink(s.caixaTeste!.enviados.at(-1)!.texto)!;
  return app.pedir('/api/auth/link/confirmar', { corpo: { token: tokenDoLink(link) } });
}
const cookieDeQuem = async (email: string) => cookieDe((await entrarPorLink(email)).setCookie);

const ROTAS_GET = ['/api/admin/resumo', '/api/admin/usuarios', '/api/admin/mesas', '/api/admin/partidas'];

describe('porteiro do admin', () => {
  test('sem sessão: 401 em todas as rotas', async () => {
    for (const r of ROTAS_GET) expect((await app.pedir(r)).status, r).toBe(401);
    expect((await app.pedir('/api/admin/usuarios/1/banir', { corpo: {} })).status).toBe(401);
    expect((await app.pedir('/api/admin/usuarios/1', { metodo: 'PATCH', corpo: { apelido: 'xyz' } })).status).toBe(401);
  });

  test('logado sem ser admin: 403 em todas as rotas', async () => {
    const cookie = await cookieDeQuem('ana@x.com');
    for (const r of ROTAS_GET) expect((await app.pedir(r, { cookie })).status, r).toBe(403);
    expect((await app.pedir('/api/admin/usuarios/1/banir', { corpo: {}, cookie })).status).toBe(403);
    expect((await app.pedir('/api/admin/usuarios/1', { metodo: 'PATCH', corpo: { apelido: 'xyz' }, cookie })).status).toBe(403);
  });

  test('/api/eu diz quem é admin', async () => {
    const r = await entrarPorLink('Chefe@X.com');
    expect(r.json.usuario.admin).toBe(true);
    expect((await app.pedir('/api/eu', { cookie: cookieDe(r.setCookie) })).json.usuario.admin).toBe(true);
    const ana = await entrarPorLink('ana@x.com');
    expect(ana.json.usuario.admin).toBe(false);
  });
});

describe('painel', () => {
  test('resumo: totais, mesas ativas e série de 14 dias', async () => {
    const cookie = await cookieDeQuem('chefe@x.com');
    await cookieDeQuem('ana@x.com');
    await b.db.insert(partidas).values({ variante: 'paulista', modo: 'classica', iniciadaEm: AGORA });
    const r = await app.pedir('/api/admin/resumo', { cookie });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ usuarios: 2, banidos: 0, partidas: 1, mesasAtivas: 1 });
    expect(r.json.porDia).toHaveLength(14);
    expect(r.json.porDia.at(-1)).toEqual({ dia: '2026-11-07', usuarios: expect.any(Number), partidas: 1 });
    expect(r.json.porDia[0].dia).toBe('2026-10-25');
  });

  test('usuários: lista, busca por apelido ou e-mail, marca o admin', async () => {
    const cookie = await cookieDeQuem('chefe@x.com');
    await cookieDeQuem('ana@x.com');
    await cookieDeQuem('bruno@y.com');
    const todos = await app.pedir('/api/admin/usuarios', { cookie });
    expect(todos.json.usuarios).toHaveLength(3);
    expect(todos.json.usuarios.find((u: any) => u.email === 'chefe@x.com').admin).toBe(true);
    const busca = await app.pedir('/api/admin/usuarios?busca=Y.CO', { cookie });
    expect(busca.json.usuarios.map((u: any) => u.apelido)).toEqual(['bruno']);
    expect((await app.pedir('/api/admin/usuarios?busca=%25', { cookie })).json.usuarios).toEqual([]);
  });

  test('trocar apelido de outra pessoa', async () => {
    const cookie = await cookieDeQuem('chefe@x.com');
    const ana = (await entrarPorLink('ana@x.com')).json.usuario;
    const r = await app.pedir(`/api/admin/usuarios/${ana.id}`, { metodo: 'PATCH', corpo: { apelido: 'Ana_Nova' }, cookie });
    expect(r.status).toBe(200);
    expect(r.json.usuario.apelido).toBe('Ana_Nova');
    expect((await app.pedir(`/api/admin/usuarios/${ana.id}`, { metodo: 'PATCH', corpo: { apelido: 'chefe' }, cookie })).status).toBe(409);
    expect((await app.pedir(`/api/admin/usuarios/${ana.id}`, { metodo: 'PATCH', corpo: { apelido: 'x' }, cookie })).status).toBe(400);
    expect((await app.pedir('/api/admin/usuarios/999', { metodo: 'PATCH', corpo: { apelido: 'zeca' }, cookie })).status).toBe(404);
  });

  test('banir derruba a sessão e recusa o login; desbanir libera', async () => {
    const cookie = await cookieDeQuem('chefe@x.com');
    const ana = await entrarPorLink('ana@x.com');
    const cookieAna = cookieDe(ana.setCookie);
    const id = ana.json.usuario.id;

    expect((await app.pedir(`/api/admin/usuarios/${id}/banir`, { corpo: {}, cookie })).status).toBe(204);
    // Sessões HTTP apagadas não bastam: as salas abertas (WebSocket) também são derrubadas.
    expect(derrubadas).toEqual([id]);
    expect((await app.pedir(`/api/admin/usuarios/${id}/banir`, { corpo: {}, cookie })).status).toBe(409);
    expect(derrubadas).toEqual([id]);
    expect((await app.pedir('/api/eu', { cookie: cookieAna })).json.usuario).toBeNull();
    const deNovo = await entrarPorLink('ana@x.com');
    expect(deNovo.status).toBe(403);
    expect(deNovo.json.erro).toBe('conta suspensa');
    expect(deNovo.setCookie).toBeNull();
    const lista = await app.pedir('/api/admin/usuarios?busca=ana', { cookie });
    expect(lista.json.usuarios[0].banidoEm).toBe(AGORA.toISOString());
    expect((await app.pedir('/api/admin/resumo', { cookie })).json.banidos).toBe(1);

    expect((await app.pedir(`/api/admin/usuarios/${id}/desbanir`, { corpo: {}, cookie })).status).toBe(204);
    expect(liberadas).toEqual([id]);
    expect((await app.pedir(`/api/admin/usuarios/${id}/desbanir`, { corpo: {}, cookie })).status).toBe(409);
    expect((await entrarPorLink('ana@x.com')).status).toBe(200);
  });

  test('admin não pode ser banido; id inválido e inexistente', async () => {
    const chefe = await entrarPorLink('chefe@x.com');
    const cookie = cookieDe(chefe.setCookie);
    expect((await app.pedir(`/api/admin/usuarios/${chefe.json.usuario.id}/banir`, { corpo: {}, cookie })).status).toBe(400);
    expect((await app.pedir('/api/admin/usuarios/abc/banir', { corpo: {}, cookie })).status).toBe(400);
    expect((await app.pedir('/api/admin/usuarios/999/banir', { corpo: {}, cookie })).status).toBe(404);
  });

  test('mesas e partidas recentes', async () => {
    const chefe = await entrarPorLink('chefe@x.com');
    const cookie = cookieDe(chefe.setCookie);
    expect((await app.pedir('/api/admin/mesas', { cookie })).json.mesas).toHaveLength(1);
    const [p] = await b.db
      .insert(partidas)
      .values({ variante: 'mineiro', modo: 'privada', placar0: 12, placar1: 4, vencedora: 0, iniciadaEm: AGORA, terminadaEm: AGORA })
      .returning();
    await b.db.insert(participacoes).values([
      { partidaId: p.id, usuarioId: chefe.json.usuario.id, nome: 'chefe', humano: true, cadeira: 0, dupla: 0 },
      { partidaId: p.id, nome: 'Bot 1', humano: false, cadeira: 1, dupla: 1 },
    ]);
    const r = await app.pedir('/api/admin/partidas', { cookie });
    expect(r.json.partidas).toHaveLength(1);
    expect(r.json.partidas[0]).toMatchObject({ placar: [12, 4], vencedora: 0, modo: 'privada' });
    expect(r.json.partidas[0].jogadores.map((j: any) => j.nome)).toEqual(['chefe', 'Bot 1']);
    const us = (await app.pedir('/api/admin/usuarios', { cookie })).json.usuarios;
    expect(us.find((u: any) => u.apelido === 'chefe').partidas).toBe(1);
  });
});
