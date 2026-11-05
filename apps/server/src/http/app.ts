import type { Variante } from '@truco/engine';
import { sql } from 'drizzle-orm';
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import type { SalaAberta } from '../api/tipos';
import { emailDoLink, extrairLink } from '../auth/emails';
import { chaveDeIp, LimiteTaxa } from '../auth/limite';
import { VARIANTES } from '../banco/schema';
import { bearer, COOKIE_SESSAO, cookieApagado, cookieSessao, lerCookie } from '../auth/tokens';
import {
  consumirLinkMagico,
  criarLinkMagico,
  criarSessao,
  DURACAO_SESSAO_MS,
  encerrarSessao,
  entrarComEmail,
  entrarComGoogle,
  ErroGoogleOutraConta,
  normalizarEmail,
  trocarApelido,
  type Usuario,
  usuarioDaSessao,
  usuarioPorId,
} from '../repo/usuarios';
import { historico, perfil, ranking } from '../repo/partidas';
import type { Servicos } from '../servicos';

export interface ExtrasApp {
  /** Mesas casuais abertas (o servidor passa `listarSalasAbertas`). */
  listarSalas?: () => Promise<SalaAberta[]>;
  /** Pasta do build do web; ausente/null = não serve estáticos (dev usa o Vite). */
  pastaWeb?: string | null;
  limiteLinkIp?: LimiteTaxa;
  limiteLinkEmail?: LimiteTaxa;
}

/** Cookie e depois Bearer (sem repetir): um cookie vencido não pode esconder um Bearer válido. */
function tokensDe(req: Request): string[] {
  const ts = [lerCookie(req.headers.cookie, COOKIE_SESSAO), bearer(req.headers.authorization)];
  return [...new Set(ts.filter((t): t is string => !!t))];
}

/** Só fora de produção (sem URL pública): o link volta para quem pediu (o Vite em :5173 manda `Origin`). */
function origemDoPedido(req: Request): string {
  return req.get('origin') ?? `${req.protocol}://${req.get('host')}`;
}

/** Caminho com extensão no último segmento (ex.: /assets/x.js, /favicon.ico). */
const temExtensao = (caminho: string) => /\.[^/]+$/.test(caminho);

export function configurarApp(app: Application, s: Servicos, x: ExtrasApp = {}): void {
  const limiteIp = x.limiteLinkIp ?? new LimiteTaxa(5, 15 * 60_000);
  const limiteEmail = x.limiteLinkEmail ?? new LimiteTaxa(3, 15 * 60_000);
  const usuarioDe = async (req: Request): Promise<Usuario | null> => {
    for (const t of tokensDe(req)) {
      const u = await usuarioDaSessao(s.banco, t, s.agora());
      if (u) return u;
    }
    return null;
  };
  const entrar = async (res: Response, u: Usuario) => {
    const token = await criarSessao(s.banco, u.id, s.agora());
    res.setHeader('Set-Cookie', cookieSessao(token, { seguro: s.producao, maxAgeS: Math.floor(DURACAO_SESSAO_MS / 1000) }));
    res.json({ usuario: u });
  };

  // Railway (e qualquer proxy na frente) manda X-Forwarded-For/Proto: `req.ip` e `req.protocol`
  // corretos. Sem proxy (dev), confiar nisso deixaria qualquer um forjar o IP do limite de taxa.
  app.set('trust proxy', s.producao || s.confiarProxy ? 1 : false);
  app.disable('x-powered-by');

  app.get('/saude', async (_req, res) => {
    await s.banco.execute(sql`select 1`);
    res.json({ ok: true });
  });

  const api = express.Router();
  api.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Exigir JSON força preflight em pedidos de outra origem (junto com SameSite=Lax, contra CSRF).
    if (req.method !== 'GET' && req.method !== 'HEAD' && !req.is('application/json')) {
      res.status(415).json({ erro: 'use Content-Type: application/json' });
      return;
    }
    next();
  });
  api.use(express.json({ limit: '16kb' }));

  api.get('/config', (_req, res) => {
    res.json({ google: s.google?.clientId ?? null, emailTeste: s.caixaTeste !== null });
  });

  api.get('/eu', async (req, res) => {
    res.json({ usuario: await usuarioDe(req) });
  });

  api.patch('/eu', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    const r = await trocarApelido(s.banco, u.id, req.body?.apelido);
    if (r === 'invalido') return void res.status(400).json({ erro: 'o apelido precisa ter de 3 a 20 caracteres' });
    if (r === 'em-uso') return void res.status(409).json({ erro: 'esse apelido já tem dono' });
    res.json({ usuario: await usuarioPorId(s.banco, u.id) });
  });

  api.post('/auth/link', async (req, res) => {
    const email = normalizarEmail(req.body?.email);
    if (!email) return void res.status(400).json({ erro: 'e-mail inválido' });
    if (!limiteIp.permitir(chaveDeIp(req.ip)) || !limiteEmail.permitir(email)) {
      return void res.status(429).json({ erro: 'muitos pedidos; tente de novo em alguns minutos' });
    }
    if (s.producao && !s.urlPublica) {
      console.error('[auth] produção sem URL pública: link mágico recusado');
      return void res.status(500).json({ erro: 'servidor sem URL pública configurada' });
    }
    const token = await criarLinkMagico(s.banco, email, s.agora());
    const base = s.urlPublica ?? origemDoPedido(req);
    try {
      await s.emails.enviar(emailDoLink(`${base}/#/entrar?token=${token}`, email));
    } catch (e) {
      console.error('[auth] falha ao enviar o e-mail', e);
      return void res.status(502).json({ erro: 'não foi possível enviar o e-mail agora' });
    }
    res.status(204).end();
  });

  api.post('/auth/link/confirmar', async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const email = await consumirLinkMagico(s.banco, token, s.agora());
    if (!email) return void res.status(400).json({ erro: 'link inválido ou expirado; peça outro' });
    await entrar(res, await entrarComEmail(s.banco, email));
  });

  api.post('/auth/google', async (req, res) => {
    if (!s.google) return void res.status(404).json({ erro: 'login com Google desligado' });
    const credencial = typeof req.body?.credencial === 'string' ? req.body.credencial : '';
    let perfilGoogle;
    try {
      perfilGoogle = await s.google.verificar(credencial);
    } catch {
      return void res.status(401).json({ erro: 'não foi possível validar o login do Google' });
    }
    let u: Usuario;
    try {
      u = await entrarComGoogle(s.banco, perfilGoogle);
    } catch (e) {
      if (e instanceof ErroGoogleOutraConta) return void res.status(409).json({ erro: `${e.message}; entre pelo link mágico` });
      throw e;
    }
    await entrar(res, u);
  });

  api.post('/auth/sair', async (req, res) => {
    for (const t of tokensDe(req)) await encerrarSessao(s.banco, t);
    res.setHeader('Set-Cookie', cookieApagado(s.producao));
    res.status(204).end();
  });

  api.get('/perfil', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    res.json(await perfil(s.banco, u.id));
  });

  api.get('/perfil/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return void res.status(400).json({ erro: 'id inválido' });
    const p = await perfil(s.banco, id);
    if (!p) return void res.status(404).json({ erro: 'jogador não encontrado' });
    res.json(p);
  });

  api.get('/historico', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    res.json({ partidas: await historico(s.banco, u.id) });
  });

  api.get('/ranking/:variante', async (req, res) => {
    const v = req.params.variante;
    if (!(VARIANTES as readonly string[]).includes(v)) return void res.status(400).json({ erro: 'variante inválida' });
    res.json({ linhas: await ranking(s.banco, v as Variante) });
  });

  api.get('/salas', async (_req, res) => {
    res.json({ salas: x.listarSalas ? await x.listarSalas() : [] });
  });

  api.get('/teste/emails', (_req, res) => {
    if (!s.caixaTeste) return void res.status(404).json({ erro: 'não encontrado' });
    res.json({ emails: s.caixaTeste.enviados.map((e) => ({ para: e.para, assunto: e.assunto, link: extrairLink(e.texto) })) });
  });

  api.use((_req, res) => {
    res.status(404).json({ erro: 'não encontrado' });
  });
  app.use('/api', api);

  if (x.pastaWeb) {
    const pasta = x.pastaWeb;
    // Os arquivos do Vite em /assets têm hash no nome: podem ficar em cache. O index.html não.
    app.use(
      express.static(pasta, {
        index: false,
        maxAge: '7d',
        setHeaders: (res, caminho) => {
          if (caminho.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    // `/{*caminho}` (Express 5) casa também "/": sem isso o Colyseus responderia "/" com a própria versão.
    // Arquivo que não existe (tem extensão) é 404, não o index.html (evita JS/ícone virar HTML em cache).
    app.get('/{*caminho}', (req, res) => {
      if (temExtensao(req.path)) return void res.status(404).type('text/plain').send('não encontrado');
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile('index.html', { root: pasta });
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const tipo = (err as { type?: string } | null)?.type;
    if (tipo === 'entity.parse.failed') return void res.status(400).json({ erro: 'JSON inválido' });
    if (tipo === 'entity.too.large') return void res.status(413).json({ erro: 'pedido grande demais' });
    console.error('[http]', err);
    res.status(500).json({ erro: 'erro interno' });
  });
}
