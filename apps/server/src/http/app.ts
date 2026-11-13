import type { Variante } from '@truco/engine';
import { sql } from 'drizzle-orm';
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { MesaAdmin, SalaAberta, UsuarioApi } from '../api/tipos';
import { emailDoLink, extrairLink } from '../auth/emails';
import { chaveDeIp, LimiteTaxa } from '../auth/limite';
import { VARIANTES } from '../banco/schema';
import { bearer, COOKIE_SESSAO, cookieApagado, cookieSessao, lerCookie } from '../auth/tokens';
import {
  conectarGoogle,
  consumirLinkMagico,
  contaBanida,
  criarLinkMagico,
  criarSessao,
  DURACAO_SESSAO_MS,
  encerrarSessao,
  entrarComEmail,
  entrarComGoogle,
  ErroEmailCanonico,
  excluirConta,
  ErroGoogleOutraConta,
  gravarPreferencias,
  lerPreferencias,
  normalizarEmail,
  trocarApelido,
  trocarAvatar,
  type Usuario,
  usuarioDaSessao,
  usuarioPorId,
} from '../repo/usuarios';
import { banirUsuario, desbanirUsuario, listarUsuariosAdmin, partidasRecentesAdmin, resumoAdmin } from '../repo/admin';
import { historico, perfil, ranking } from '../repo/partidas';
import type { Servicos } from '../servicos';
import { cabecalhosSeguranca, hashesDeScriptsInline } from './cabecalhos';
import { rotasAdminLoja, rotasLoja } from './loja';
import { auditoriaRecente, registrarAuditoria } from '../repo/auditoria';
import { log } from '../log';

export interface ExtrasApp {
  /** Mesas casuais abertas (o servidor passa `listarSalasAbertas`). */
  listarSalas?: () => Promise<SalaAberta[]>;
  /** Todas as mesas vivas, para o painel de admin (o servidor passa `listarMesasAdmin`). */
  listarMesas?: () => Promise<MesaAdmin[]>;
  /** Pasta do build do web; ausente/null = não serve estáticos (dev usa o Vite). */
  pastaWeb?: string | null;
  limiteLinkIp?: LimiteTaxa;
  limiteLinkEmail?: LimiteTaxa;
  /** Por IP, em confirmar link e login com Google (padrão: 30 a cada 15 min). */
  limiteAuthIp?: LimiteTaxa;
  /** Commit em produção (RAILWAY_GIT_COMMIT_SHA, 7 letras), para /saude e o resumo do admin. */
  versao?: string | null;
  /** Salas vivas e jogadores conectados agora (o servidor conta no Colyseus). */
  contarSalas?: () => Promise<{ salas: number; jogadores: number }>;
  /** Por IP, em POST /api/erro-cliente (padrão: 10 por minuto). */
  limiteErroClienteIp?: LimiteTaxa;
  /** Por IP, somando perfil público, ranking, salas e catálogo (padrão: 120 por minuto). */
  limiteLeituraIp?: LimiteTaxa;
  /** Banimento: derruba a conta das salas em tempo real (o servidor passa MesaRoom/FilaRoom). */
  derrubarConta?: (usuarioId: number) => void;
  /** Desbanimento: a conta volta a poder reconectar. */
  liberarConta?: (usuarioId: number) => void;
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

const escaparAtributo = (t: string) =>
  t.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Caminho com extensão no último segmento (ex.: /assets/x.js, /favicon.ico). */
const temExtensao = (caminho: string) => /\.[^/]+$/.test(caminho);

/** O banco respondeu a um `select 1` dentro de `limiteMs`? (e quanto levou). */
async function bancoResponde(s: Servicos, limiteMs: number): Promise<{ ok: boolean; ms: number }> {
  const inicio = Date.now();
  try {
    await Promise.race([
      s.banco.execute(sql`select 1`),
      new Promise((_, falha) => setTimeout(() => falha(new Error('tempo esgotado')), limiteMs).unref?.()),
    ]);
    return { ok: true, ms: Date.now() - inicio };
  } catch {
    return { ok: false, ms: Date.now() - inicio };
  }
}

export function configurarApp(app: Application, s: Servicos, x: ExtrasApp = {}): void {
  const limiteIp = x.limiteLinkIp ?? new LimiteTaxa(5, 15 * 60_000);
  const limiteEmail = x.limiteLinkEmail ?? new LimiteTaxa(3, 15 * 60_000);
  const limiteAuth = x.limiteAuthIp ?? new LimiteTaxa(30, 15 * 60_000);
  /** Confirmar link e Google: cada pedido custa banco e chamada ao Google; limitar por IP. */
  const passouLimiteAuth = (req: Request, res: Response): boolean => {
    if (limiteAuth.permitir(chaveDeIp(req.ip))) return false;
    res.status(429).json({ erro: 'muitos pedidos; tente de novo em alguns minutos' });
    return true;
  };
  const usuarioDe = async (req: Request): Promise<Usuario | null> => {
    for (const t of tokensDe(req)) {
      const u = await usuarioDaSessao(s.banco, t, s.agora());
      if (u) return u;
    }
    return null;
  };
  const admins = s.admins ?? [];
  const ehAdmin = (u: Usuario) => !!u.email && admins.includes(u.email);
  /** O que vai para o navegador: o usuário mais o atalho `admin` do menu. */
  const paraApi = (u: Usuario | null): UsuarioApi | null => (u ? { ...u, admin: ehAdmin(u) } : null);
  const entrar = async (res: Response, u: Usuario) => {
    if (await contaBanida(s.banco, u.id)) return void res.status(403).json({ erro: 'conta suspensa' });
    const token = await criarSessao(s.banco, u.id, s.agora());
    res.setHeader('Set-Cookie', cookieSessao(token, { seguro: s.producao, maxAgeS: Math.floor(DURACAO_SESSAO_MS / 1000) }));
    res.json({ usuario: paraApi(u) });
  };

  // Railway (e qualquer proxy na frente) manda X-Forwarded-For/Proto: `req.ip` e `req.protocol`
  // corretos. Sem proxy (dev), confiar nisso deixaria qualquer um forjar o IP do limite de taxa.
  app.set('trust proxy', s.producao || s.confiarProxy ? 1 : false);
  app.disable('x-powered-by');
  // Antes de qualquer rota: vale para a página, os estáticos e a API.
  app.use(
    cabecalhosSeguranca({
      producao: s.producao,
      urlPublica: s.urlPublica,
      hashesScript: () => {
        if (!x.pastaWeb) return [];
        try {
          return hashesDeScriptsInline(readFileSync(join(x.pastaWeb, 'index.html'), 'utf8'));
        } catch {
          return [];
        }
      },
    }),
  );

  // Saúde (F5.4): versão (commit do Railway), salas vivas, jogadores conectados e se o banco
  // respondeu a um `select 1` em até 1 s. Nada sensível. Banco fora: 503, para o healthcheck perceber.
  app.get('/saude', async (_req, res) => {
    const banco = await bancoResponde(s, 1_000);
    const vivas = x.contarSalas ? await x.contarSalas().catch(() => null) : null;
    res.status(banco.ok ? 200 : 503).json({
      ok: banco.ok,
      versao: x.versao ?? null,
      salas: vivas?.salas ?? null,
      jogadores: vivas?.jogadores ?? null,
      banco,
    });
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
  // A foto (já reduzida no navegador) passa do limite geral: rota própria antes do leitor de 16 kb.
  api.put('/eu/avatar', express.json({ limit: '80kb' }), async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    const novo = await trocarAvatar(s.banco, u.id, req.body?.avatar);
    if (!novo) return void res.status(400).json({ erro: 'imagem inválida: use JPG, PNG ou WebP' });
    res.json({ usuario: paraApi(novo) });
  });
  api.use(express.json({ limit: '16kb' }));

  // Leituras públicas (perfil de qualquer um, ranking, salas, catálogo): 120 por IP por minuto,
  // somadas (SEC-09 da auditoria de 2026-11-10). Antes das rotas, para valer em todas.
  const limiteLeitura = x.limiteLeituraIp ?? new LimiteTaxa(120, 60_000);
  api.get(['/perfil/:id', '/ranking/:variante', '/salas', '/loja/catalogo'], (req, res, next) => {
    if (limiteLeitura.permitir(chaveDeIp(req.ip))) return next();
    res.status(429).json({ erro: 'muitos pedidos; tente de novo em um minuto' });
  });

  // Erros do navegador (window.onerror / unhandledrejection): só para o log do operador. 10 por IP por
  // minuto, corpo de até 2 kB, só mensagem, pilha curta, rota sem query (pode ter token) e versão.
  const limiteErroCliente = x.limiteErroClienteIp ?? new LimiteTaxa(10, 60_000);
  api.post('/erro-cliente', (req, res) => {
    if (Number(req.headers['content-length'] ?? 0) > 2_048) return void res.status(413).json({ erro: 'relato grande demais' });
    if (!limiteErroCliente.permitir(chaveDeIp(req.ip))) return void res.status(429).json({ erro: 'muitos pedidos; tente de novo em um minuto' });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
    log.aviso('erro_cliente', {
      mensagem: texto(b.mensagem, 300),
      pilha: texto(b.pilha, 1_000),
      rota: texto(b.rota, 100)?.split('?')[0] ?? null,
      versao: texto(b.versao, 40),
    });
    res.status(204).end();
  });

  api.get('/config', (_req, res) => {
    res.json({ google: s.google?.clientId ?? null, emailTeste: s.caixaTeste !== null });
  });

  api.get('/eu', async (req, res) => {
    res.json({ usuario: paraApi(await usuarioDe(req)) });
  });

  api.patch('/eu', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    const r = await trocarApelido(s.banco, u.id, req.body?.apelido);
    if (r === 'invalido') return void res.status(400).json({ erro: 'o apelido precisa ter de 3 a 20 caracteres' });
    if (r === 'em-uso') return void res.status(409).json({ erro: 'esse apelido já tem dono' });
    res.json({ usuario: paraApi(await usuarioPorId(s.banco, u.id)) });
  });

  // Excluir a conta (F6.4): só logado, e digitando o apelido para confirmar.
  api.delete('/eu', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    const digitado = typeof req.body?.apelido === 'string' ? req.body.apelido.trim().toLowerCase() : '';
    if (digitado !== u.apelido.toLowerCase()) return void res.status(400).json({ erro: 'digite o seu apelido para confirmar' });
    await excluirConta(s.banco, u.id, s.agora());
    log.info('conta_removida', { usuarioId: u.id });
    res.setHeader('Set-Cookie', cookieApagado(s.producao));
    res.status(204).end();
  });

  api.get('/preferencias', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    res.json({ preferencias: await lerPreferencias(s.banco, u.id) });
  });

  api.put('/preferencias', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    const p = await gravarPreferencias(s.banco, u.id, req.body?.preferencias);
    if (!p) return void res.status(400).json({ erro: 'preferências inválidas' });
    res.json({ preferencias: p });
  });

  api.post('/auth/link', async (req, res) => {
    const email = normalizarEmail(req.body?.email);
    if (!email) return void res.status(400).json({ erro: 'e-mail inválido' });
    if (!limiteIp.permitir(chaveDeIp(req.ip)) || !limiteEmail.permitir(email)) {
      return void res.status(429).json({ erro: 'muitos pedidos; tente de novo em alguns minutos' });
    }
    if (s.producao && !s.urlPublica) {
      log.erro('auth_sem_url_publica');
      return void res.status(500).json({ erro: 'servidor sem URL pública configurada' });
    }
    const token = await criarLinkMagico(s.banco, email, s.agora());
    const base = s.urlPublica ?? origemDoPedido(req);
    try {
      await s.emails.enviar(emailDoLink(`${base}/#/entrar?token=${token}`, email));
    } catch (e) {
      log.erro('auth_falha_envio', e);
      return void res.status(502).json({ erro: 'não foi possível enviar o e-mail agora' });
    }
    res.status(204).end();
  });

  api.post('/auth/link/confirmar', async (req, res) => {
    if (passouLimiteAuth(req, res)) return;
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const email = await consumirLinkMagico(s.banco, token, s.agora());
    if (!email) return void res.status(400).json({ erro: 'link inválido ou expirado; peça outro' });
    let u: Usuario;
    try {
      u = await entrarComEmail(s.banco, email);
    } catch (e) {
      if (e instanceof ErroEmailCanonico) return void res.status(409).json({ erro: e.message });
      throw e;
    }
    await entrar(res, u);
  });

  api.post('/auth/google', async (req, res) => {
    if (!s.google) return void res.status(404).json({ erro: 'login com Google desligado' });
    if (passouLimiteAuth(req, res)) return;
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
      if (e instanceof ErroEmailCanonico) return void res.status(409).json({ erro: e.message });
      throw e;
    }
    await entrar(res, u);
  });

  api.post('/eu/google', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    if (!s.google) return void res.status(404).json({ erro: 'login com Google desligado' });
    const credencial = typeof req.body?.credencial === 'string' ? req.body.credencial : '';
    let g;
    try {
      g = await s.google.verificar(credencial);
    } catch {
      return void res.status(401).json({ erro: 'não foi possível validar o login do Google' });
    }
    try {
      res.json({ usuario: paraApi(await conectarGoogle(s.banco, u.id, g.sub)) });
    } catch (e) {
      if (e instanceof ErroGoogleOutraConta)
        return void res.status(409).json({ erro: 'esse Google já está ligado a outra conta (ou a sua já tem outro Google)' });
      throw e;
    }
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

  rotasLoja(api, {
    s,
    usuarioDe,
    ehAdmin,
    // Sem URL pública (só fora de produção) a origem é a do pedido, como no link mágico.
    origem: (req) => s.urlPublica ?? origemDoPedido(req),
  });

  api.get('/salas', async (_req, res) => {
    res.json({ salas: x.listarSalas ? await x.listarSalas() : [] });
  });

  // ---------- painel de admin: o porteiro vale para tudo em /api/admin ----------
  const admin = express.Router();
  admin.use(async (req, res, next) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    if (!ehAdmin(u)) return void res.status(403).json({ erro: 'só para admin' });
    res.locals.admin = u;
    next();
  });
  const idDe = (req: Request): number | null => {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  admin.get('/resumo', async (_req, res) => {
    const r = await resumoAdmin(s.banco, s.agora());
    const mesasAtivas = x.listarMesas ? (await x.listarMesas()).length : 0;
    const vivas = x.contarSalas ? await x.contarSalas().catch(() => null) : null;
    const banco = await bancoResponde(s, 1_000);
    res.json({ ...r, mesasAtivas, jogadoresConectados: vivas?.jogadores ?? null, versao: x.versao ?? null, bancoMs: banco.ok ? banco.ms : null });
  });

  admin.get('/usuarios', async (req, res) => {
    const busca = typeof req.query.busca === 'string' ? req.query.busca : '';
    res.json({ usuarios: await listarUsuariosAdmin(s.banco, { busca, admins }) });
  });

  admin.patch('/usuarios/:id', async (req, res) => {
    const id = idDe(req);
    if (!id) return void res.status(400).json({ erro: 'id inválido' });
    if (!(await usuarioPorId(s.banco, id))) return void res.status(404).json({ erro: 'usuário não encontrado' });
    const r = await trocarApelido(s.banco, id, req.body?.apelido);
    if (r === 'invalido') return void res.status(400).json({ erro: 'o apelido precisa ter de 3 a 20 caracteres' });
    if (r === 'em-uso') return void res.status(409).json({ erro: 'esse apelido já tem dono' });
    res.json({ usuario: paraApi(await usuarioPorId(s.banco, id)) });
  });

  admin.post('/usuarios/:id/banir', async (req, res) => {
    const id = idDe(req);
    if (!id) return void res.status(400).json({ erro: 'id inválido' });
    const alvo = await usuarioPorId(s.banco, id);
    if (!alvo) return void res.status(404).json({ erro: 'usuário não encontrado' });
    if (ehAdmin(alvo)) return void res.status(400).json({ erro: 'admin não pode ser banido' });
    if (!(await banirUsuario(s.banco, id, s.agora()))) return void res.status(409).json({ erro: 'já está banido' });
    // As sessões HTTP já foram apagadas; os WebSockets abertos (mesa, fila) também caem.
    x.derrubarConta?.(id);
    await registrarAuditoria(s.banco, { adminId: (res.locals.admin as Usuario).id, acao: 'banir', alvoId: id }, s.agora());
    log.info('admin_baniu', { admin: (res.locals.admin as Usuario).apelido, alvoId: id });
    res.status(204).end();
  });

  admin.post('/usuarios/:id/desbanir', async (req, res) => {
    const id = idDe(req);
    if (!id) return void res.status(400).json({ erro: 'id inválido' });
    if (!(await usuarioPorId(s.banco, id))) return void res.status(404).json({ erro: 'usuário não encontrado' });
    if (!(await desbanirUsuario(s.banco, id))) return void res.status(409).json({ erro: 'não está banido' });
    await registrarAuditoria(s.banco, { adminId: (res.locals.admin as Usuario).id, acao: 'desbanir', alvoId: id }, s.agora());
    log.info('admin_desbaniu', { admin: (res.locals.admin as Usuario).apelido, alvoId: id });
    x.liberarConta?.(id);
    res.status(204).end();
  });

  admin.get('/mesas', async (_req, res) => {
    res.json({ mesas: x.listarMesas ? await x.listarMesas() : [] });
  });

  admin.get('/partidas', async (_req, res) => {
    res.json({ partidas: await partidasRecentesAdmin(s.banco) });
  });

  admin.get('/auditoria', async (_req, res) => {
    res.json({ auditoria: await auditoriaRecente(s.banco) });
  });
  rotasAdminLoja(admin, s);
  api.use('/admin', admin);

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
    // Os arquivos do Vite em /assets têm hash no nome: um ano e immutable (F6.2). O index.html, o
    // service worker e o manifesto não (no-cache). O resto (ícones, vozes) muda sem trocar de nome: 7 dias.
    app.use(
      express.static(pasta, {
        index: false,
        maxAge: '7d',
        setHeaders: (res, caminho) => {
          if (caminho.endsWith('index.html') || caminho.endsWith('sw.js') || caminho.endsWith('manifest.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (relative(pasta, caminho).split(sep)[0] === 'assets') {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    // `/{*caminho}` (Express 5) casa também "/": sem isso o Colyseus responderia "/" com a própria versão.
    // Arquivo que não existe (tem extensão) é 404, não o index.html (evita JS/ícone virar HTML em cache).
    // O index.html leva o endereço do site na prévia do link (og:image precisa de URL completa).
    let indice: string | null = null;
    app.get('/{*caminho}', (req, res) => {
      if (temExtensao(req.path)) return void res.status(404).type('text/plain').send('não encontrado');
      res.setHeader('Cache-Control', 'no-cache');
      try {
        indice ??= readFileSync(join(pasta, 'index.html'), 'utf8');
      } catch {
        return void res.sendFile('index.html', { root: pasta });
      }
      // Sem URL pública (só fora de produção) a origem vem do Host do pedido: escapar para não
      // fechar o atributo do og:image e injetar HTML.
      const origem = escaparAtributo(s.urlPublica ?? `${req.protocol}://${req.get('host')}`);
      res.type('html').send(indice.replaceAll('__ORIGEM__', origem));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const tipo = (err as { type?: string } | null)?.type;
    if (tipo === 'entity.parse.failed') return void res.status(400).json({ erro: 'JSON inválido' });
    if (tipo === 'entity.too.large') return void res.status(413).json({ erro: 'pedido grande demais' });
    log.erro('http_erro', err);
    res.status(500).json({ erro: 'erro interno' });
  });
}
