import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { cabecalhosCors } from '../src/http/cors';
import { contadoresZerados } from '../src/ranking/estatisticas';
import { iniciarPartida, terminarPartida } from '../src/repo/partidas';
import { criarSessao, criarUsuario } from '../src/repo/usuarios';
import { type Servicos, servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';
import { subirApp } from './http-helpers';

let b: BancoDeTeste;
let s: Servicos;
let app: Awaited<ReturnType<typeof subirApp>>;
let pastaWeb: string;

beforeAll(async () => {
  b = await bancoDeTeste();
  pastaWeb = mkdtempSync(join(tmpdir(), 'truco-web-'));
  writeFileSync(join(pastaWeb, 'index.html'), '<!doctype html><meta property="og:image" content="__ORIGEM__/compartilhar.png"><div id="raiz"></div>');
  mkdirSync(join(pastaWeb, 'assets'));
  writeFileSync(join(pastaWeb, 'assets', 'app.js'), 'console.log(1)');
}, 30_000);
beforeEach(async () => {
  await b.limpar();
  s = servicosDeTeste(b.db);
  app = await subirApp(s, {
    pastaWeb,
    listarSalas: async () => [
      { id: 'abc', modo: 'classica', variante: 'paulista', humanos: 2, nivelBot: 'facil', regras: null, ocupados: 1, dono: 'Ana', cacife: 0 },
    ],
  });
});
afterEach(() => app.fechar());
afterAll(() => b.fechar());

async function partidaRanqueada() {
  const ana = await criarUsuario(b.db, { apelidoBase: 'ana' });
  const bia = await criarUsuario(b.db, { apelidoBase: 'bia' });
  const id = await iniciarPartida(
    b.db,
    {
      variante: 'mineiro',
      modo: 'ranqueada',
      formato: '1x1',
      assentos: [
        { cadeira: 0, usuarioId: ana.id, nome: 'ana', humano: true },
        { cadeira: 1, usuarioId: bia.id, nome: 'bia', humano: true },
        { cadeira: 2, usuarioId: null, nome: 'Bot', humano: false },
        { cadeira: 3, usuarioId: null, nome: 'Bot', humano: false },
      ],
    },
    new Date(),
  );
  await terminarPartida(b.db, id, { placar: [12, 4], vencedora: 0, contadores: [0, 1, 2, 3].map(contadoresZerados) }, { k: 32, agora: new Date() });
  return { ana, bia, cookieAna: `truco_sessao=${await criarSessao(b.db, ana.id, new Date())}` };
}

describe('dados', () => {
  test('perfil próprio exige login; perfil público por id', async () => {
    const { ana, bia, cookieAna } = await partidaRanqueada();
    expect((await app.pedir('/api/perfil')).status).toBe(401);
    const meu = await app.pedir('/api/perfil', { cookie: cookieAna });
    expect(meu.json.usuario).toEqual({ id: ana.id, apelido: 'ana', avatar: null });
    expect(meu.json.variantes.mineiro).toMatchObject({ elo: 1016, pontos: 16, patente: 'Bronze', vitorias: 1 });
    expect((await app.pedir(`/api/perfil/${bia.id}`)).json.variantes.mineiro.elo).toBe(984);
    expect((await app.pedir('/api/perfil/999')).status).toBe(404);
    expect((await app.pedir('/api/perfil/abc')).status).toBe(400);
  });

  test('histórico do usuário logado', async () => {
    const { cookieAna } = await partidaRanqueada();
    expect((await app.pedir('/api/historico')).status).toBe(401);
    const h = await app.pedir('/api/historico', { cookie: cookieAna });
    expect(h.json.partidas).toEqual([expect.objectContaining({ variante: 'mineiro', nos: 12, eles: 4, venceu: true, deltaElo: 16 })]);
  });

  test('ranking por variante', async () => {
    await partidaRanqueada();
    const r = await app.pedir('/api/ranking/mineiro');
    expect(r.json.linhas.map((l: any) => l.apelido)).toEqual(['ana', 'bia']);
    expect((await app.pedir('/api/ranking/gaucho')).status).toBe(400);
  });

  test('salas abertas', async () => {
    expect((await app.pedir('/api/salas')).json.salas).toHaveLength(1);
  });

  test('caixa de teste: só quando ligada', async () => {
    await app.pedir('/api/auth/link', { corpo: { email: 'ana@x.com' } });
    const r = await app.pedir('/api/teste/emails');
    expect(r.json.emails).toEqual([{ para: 'ana@x.com', assunto: 'Seu link para entrar no Truco', link: expect.stringMatching(/#\/entrar\?token=/) }]);
    await app.fechar();
    app = await subirApp({ ...s, caixaTeste: null });
    expect((await app.pedir('/api/teste/emails')).status).toBe(404);
  });

  test('/saude', async () => {
    const r = await app.pedir('/saude');
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
  });
});

describe('limite por IP nas leituras públicas (F4.5, SEC-09)', () => {
  test('o 121º pedido no mesmo minuto volta 429 com mensagem curta', async () => {
    for (let i = 0; i < 120; i++) expect((await app.pedir('/api/salas')).status).toBe(200);
    const r = await app.pedir('/api/salas');
    expect(r.status).toBe(429);
    expect(r.json.erro).toMatch(/muitos pedidos/);
  });

  test('o limite vale para perfil, ranking, salas e catálogo da loja, juntos, por IP', async () => {
    await app.fechar();
    const { LimiteTaxa } = await import('../src/auth/limite');
    app = await subirApp(s, { limiteLeituraIp: new LimiteTaxa(4, 60_000) });
    const u = await criarUsuario(b.db, { apelidoBase: 'ana' });
    expect((await app.pedir(`/api/perfil/${u.id}`)).status).toBe(200);
    expect((await app.pedir('/api/ranking/paulista')).status).toBe(200);
    expect((await app.pedir('/api/salas')).status).toBe(200);
    expect((await app.pedir('/api/loja/catalogo')).status).toBe(200);
    for (const rota of [`/api/perfil/${u.id}`, '/api/ranking/paulista', '/api/salas', '/api/loja/catalogo']) {
      expect((await app.pedir(rota)).status, rota).toBe(429);
    }
  });
});

describe('estáticos da SPA', () => {
  test('/ e rotas desconhecidas servem o index.html; assets e /api seguem seu caminho', async () => {
    const raiz = await app.pedir('/');
    expect(raiz.status).toBe(200);
    expect(raiz.texto).toContain('<div id="raiz">');
    expect(raiz.headers.get('cache-control')).toBe('no-cache');
    expect((await app.pedir('/qualquer/coisa')).texto).toContain('<div id="raiz">');
    expect((await app.pedir('/assets/app.js')).texto).toBe('console.log(1)');
    expect((await app.pedir('/index.html')).headers.get('cache-control')).toBe('no-cache');
    expect((await app.pedir('/assets/app.js')).headers.get('cache-control')).toMatch(/max-age=604800/);
    expect((await app.pedir('/assets/sumiu.js')).status).toBe(404);
    expect((await app.pedir('/favicon.ico')).status).toBe(404);
    expect((await app.pedir('/perfil/7')).texto).toContain('<div id="raiz">');
    // a prévia do link leva o endereço completo do site (nada de __ORIGEM__ cru)
    expect(raiz.texto).toMatch(/content="https?:\/\/[^"]+\/compartilhar\.png"/);
    expect(raiz.texto).not.toContain('__ORIGEM__');
    const api = await app.pedir('/api/nao-existe');
    expect(api.status).toBe(404);
    expect(api.json).toEqual({ erro: 'não encontrado' });
  });
});

describe('cabecalhosCors', () => {
  const PROD = { producao: true, origens: ['https://truco.app'] };
  test('dev reflete só localhost/127.0.0.1/[::1]', () => {
    const DEV = { producao: false, origens: [] };
    expect(cabecalhosCors('http://localhost:5173', 'localhost:2567', DEV)).toEqual({
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      Vary: 'Origin',
    });
    expect(cabecalhosCors('http://127.0.0.1:5173', 'x', DEV)['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:5173');
    expect(cabecalhosCors('http://[::1]:5173', 'x', DEV)['Access-Control-Allow-Origin']).toBe('http://[::1]:5173');
    expect(cabecalhosCors('https://malicioso.com', 'localhost:2567', DEV)).toEqual({});
    expect(cabecalhosCors('http://localhost.malicioso.com', 'x', DEV)).toEqual({});
    expect(cabecalhosCors('lixo', 'x', DEV)).toEqual({});
  });
  test('produção: só a própria origem ou as listadas', () => {
    expect(cabecalhosCors('https://x.up.railway.app', 'x.up.railway.app', PROD)['Access-Control-Allow-Origin']).toBe('https://x.up.railway.app');
    expect(cabecalhosCors('https://truco.app', 'x.up.railway.app', PROD)['Access-Control-Allow-Origin']).toBe('https://truco.app');
    expect(cabecalhosCors('https://malicioso.com', 'x.up.railway.app', PROD)).toEqual({});
    expect(cabecalhosCors('lixo', 'x', PROD)).toEqual({});
    expect(cabecalhosCors(null, 'x', PROD)).toEqual({});
  });
});

// Auditoria de segurança 2026-11-10 (COD-05, baixa): sem URL pública (só fora de produção), o Host
// do pedido ia cru para dentro de um atributo do index.html.
describe('index.html com o Host do pedido', () => {
  test('o Host refletido é escapado (não fecha o atributo)', async () => {
    const semUrl = await subirApp(servicosDeTeste(b.db, { urlPublica: null }), { pastaWeb });
    try {
      const { request } = await import('node:http');
      const url = new URL(semUrl.base);
      const corpo = await new Promise<string>((ok, falha) => {
        const req = request({ host: url.hostname, port: url.port, path: '/', headers: { host: 'x"><img src=y onerror=alert(1)>' } }, (r) => {
          let d = '';
          r.on('data', (c) => (d += c));
          r.on('end', () => ok(d));
        });
        req.on('error', falha);
        req.end();
      });
      expect(corpo).not.toContain('"><img');
      expect(corpo).toContain('&quot;&gt;&lt;img');
    } finally {
      await semUrl.fechar();
    }
  });
});
