import { sql } from 'drizzle-orm';
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import type { SalaAberta } from '../api/tipos';
import { emailDoLink } from '../auth/emails';
import { LimiteTaxa } from '../auth/limite';
import { bearer, COOKIE_SESSAO, cookieApagado, cookieSessao, lerCookie } from '../auth/tokens';
import {
  consumirLinkMagico,
  criarLinkMagico,
  criarSessao,
  DURACAO_SESSAO_MS,
  encerrarSessao,
  entrarComEmail,
  entrarComGoogle,
  normalizarEmail,
  trocarApelido,
  type Usuario,
  usuarioDaSessao,
  usuarioPorId,
} from '../repo/usuarios';
import type { Servicos } from '../servicos';

export interface ExtrasApp {
  /** Mesas casuais abertas (o servidor passa `listarSalasAbertas`). */
  listarSalas?: () => Promise<SalaAberta[]>;
  /** Pasta do build do web; ausente/null = não serve estáticos (dev usa o Vite). */
  pastaWeb?: string | null;
  limiteLinkIp?: LimiteTaxa;
  limiteLinkEmail?: LimiteTaxa;
}

const tokenDe = (req: Request): string | null => lerCookie(req.headers.cookie, COOKIE_SESSAO) ?? bearer(req.headers.authorization);

/** Em dev (sem URL pública) o link volta para quem pediu: o Vite em :5173 manda `Origin`. */
function origemDoPedido(req: Request, producao: boolean): string {
  const origem = producao ? undefined : req.get('origin');
  return origem ?? `${req.protocol}://${req.get('host')}`;
}

export function configurarApp(app: Application, s: Servicos, x: ExtrasApp = {}): void {
  const limiteIp = x.limiteLinkIp ?? new LimiteTaxa(5, 15 * 60_000);
  const limiteEmail = x.limiteLinkEmail ?? new LimiteTaxa(3, 15 * 60_000);
  const usuarioDe = (req: Request) => usuarioDaSessao(s.banco, tokenDe(req), s.agora());
  const entrar = async (res: Response, u: Usuario) => {
    const token = await criarSessao(s.banco, u.id, s.agora());
    res.setHeader('Set-Cookie', cookieSessao(token, { seguro: s.producao, maxAgeS: Math.floor(DURACAO_SESSAO_MS / 1000) }));
    res.json({ usuario: u });
  };

  // Railway (e qualquer proxy na frente) manda X-Forwarded-For/Proto: `req.ip` e `req.protocol` corretos.
  app.set('trust proxy', 1);
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
    if (!limiteIp.permitir(req.ip ?? '?') || !limiteEmail.permitir(email)) {
      return void res.status(429).json({ erro: 'muitos pedidos; tente de novo em alguns minutos' });
    }
    const token = await criarLinkMagico(s.banco, email, s.agora());
    const base = s.urlPublica ?? origemDoPedido(req, s.producao);
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
    await entrar(res, await entrarComGoogle(s.banco, perfilGoogle));
  });

  api.post('/auth/sair', async (req, res) => {
    const t = tokenDe(req);
    if (t) await encerrarSessao(s.banco, t);
    res.setHeader('Set-Cookie', cookieApagado(s.producao));
    res.status(204).end();
  });

  // (Tarefa 10: perfil, histórico, ranking, salas e caixa de teste entram aqui.)

  api.use((_req, res) => {
    res.status(404).json({ erro: 'não encontrado' });
  });
  app.use('/api', api);

  // (Tarefa 10: estáticos e fallback da SPA entram aqui.)

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const tipo = (err as { type?: string } | null)?.type;
    if (tipo === 'entity.parse.failed') return void res.status(400).json({ erro: 'JSON inválido' });
    if (tipo === 'entity.too.large') return void res.status(413).json({ erro: 'pedido grande demais' });
    console.error('[http]', err);
    res.status(500).json({ erro: 'erro interno' });
  });
}
