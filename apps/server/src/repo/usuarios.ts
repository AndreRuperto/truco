import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import type { PerfilGoogle } from '../auth/google';
import { gerarToken, hashToken } from '../auth/tokens';
import type { Banco } from '../banco/banco';
import { linksMagicos, sessoes, usuarios } from '../banco/schema';
import { AVATARES_PRONTOS, type PreferenciasMesa } from '../api/tipos';
import { limparNome, opcoesDaSala } from '../mesa/protocolo';

export interface Usuario {
  id: number;
  apelido: string;
  email: string | null;
  /** Conta ligada a um login do Google. */
  google: boolean;
  avatar: string | null;
}

export const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;
export const DURACAO_LINK_MS = 15 * 60 * 1000;

const COLUNAS = { id: usuarios.id, apelido: usuarios.apelido, email: usuarios.email, avatar: usuarios.avatar, google: sql<boolean>`(${usuarios.googleSub} is not null)` };

type ErroPg = { code?: string; constraint?: string; cause?: ErroPg } | null;

const ehViolacaoUnica = (e: unknown) => {
  const x = e as ErroPg;
  return x?.code === '23505' || x?.cause?.code === '23505';
};

/** Nome da restrição única violada (node-postgres e PGlite; o Drizzle embrulha em `cause`), ou null. */
export function restricaoViolada(e: unknown): string | null {
  const x = e as ErroPg;
  if (x?.code === '23505') return x.constraint ?? '';
  if (x?.cause?.code === '23505') return x.cause.constraint ?? '';
  return null;
}

const RESTRICOES_APELIDO = new Set(['usuarios_apelido_unique', 'usuarios_apelido_lower_idx']);
const violouApelido = (e: unknown) => RESTRICOES_APELIDO.has(restricaoViolada(e) ?? '-');

/** O e-mail já está ligado a outra conta Google (outro `sub`): não trocamos o dono da conta. */
export class ErroGoogleOutraConta extends Error {
  constructor() {
    super('este e-mail já está ligado a outra conta Google');
    this.name = 'ErroGoogleOutraConta';
  }
}

function emailOuErro(cru: string): string {
  const e = normalizarEmail(cru);
  if (!e) throw new Error('e-mail inválido');
  return e;
}

export function normalizarEmail(cru: unknown): string | null {
  if (typeof cru !== 'string') return null;
  const e = cru.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Apelido escolhido pelo usuário: as regras de `limparNome` e 3 a 20 caracteres. */
export function apelidoValido(cru: unknown): string | null {
  if (typeof cru !== 'string' || !cru.trim()) return null;
  const n = limparNome(cru);
  return n.length >= 3 ? n : null;
}

/** Base de apelido a partir de e-mail ou nome: só letras, números e _. */
export function baseDeApelido(texto: string): string {
  const fonte = texto.includes('@') ? texto.split('@')[0] : texto;
  const base = fonte.replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 16);
  return base.length >= 3 ? base : 'jogador';
}

async function apelidoExiste(db: Banco, apelido: string): Promise<boolean> {
  const [x] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(sql`lower(${usuarios.apelido}) = lower(${apelido})`)
    .limit(1);
  return !!x;
}

async function apelidoLivre(db: Banco, base: string): Promise<string> {
  for (let i = 1; i <= 50; i++) {
    const sufixo = i === 1 ? '' : String(i);
    const cand = base.slice(0, 20 - sufixo.length) + sufixo;
    if (!(await apelidoExiste(db, cand))) return cand;
  }
  return base.slice(0, 14) + randomInt(100_000, 1_000_000);
}

export async function criarUsuario(
  db: Banco,
  o: { apelidoBase: string; email?: string | null; googleSub?: string | null },
): Promise<Usuario> {
  for (let tentativa = 0; ; tentativa++) {
    const apelido = await apelidoLivre(db, o.apelidoBase);
    try {
      const [u] = await db
        .insert(usuarios)
        .values({ apelido, email: o.email ?? null, googleSub: o.googleSub ?? null })
        .returning(COLUNAS);
      return u;
    } catch (e) {
      // corrida com outro cadastro do mesmo apelido: tenta o próximo (e-mail/sub repetido sobe)
      if (!violouApelido(e) || tentativa >= 3) throw e;
    }
  }
}

export async function usuarioPorId(db: Banco, id: number): Promise<Usuario | null> {
  const [u] = await db.select(COLUNAS).from(usuarios).where(eq(usuarios.id, id));
  return u ?? null;
}

export async function usuarioPorEmail(db: Banco, email: string): Promise<Usuario | null> {
  const [u] = await db.select(COLUNAS).from(usuarios).where(eq(usuarios.email, email));
  return u ?? null;
}

/** Login por link mágico: acha pelo e-mail ou cria a conta. */
export async function entrarComEmail(db: Banco, emailCru: string): Promise<Usuario> {
  const email = emailOuErro(emailCru);
  const existente = await usuarioPorEmail(db, email);
  if (existente) return existente;
  try {
    return await criarUsuario(db, { apelidoBase: baseDeApelido(email), email });
  } catch (e) {
    // dois cliques simultâneos no link: o outro criou primeiro
    const u = ehViolacaoUnica(e) ? await usuarioPorEmail(db, email) : null;
    if (u) return u;
    throw e;
  }
}

async function usuarioPorGoogle(db: Banco, sub: string): Promise<Usuario | null> {
  const [u] = await db.select(COLUNAS).from(usuarios).where(eq(usuarios.googleSub, sub));
  return u ?? null;
}

/**
 * Liga o `sub` à conta do e-mail, só se ela ainda não tem Google. Se já tem OUTRO sub,
 * lança `ErroGoogleOutraConta` (decisão: não sobrescrever nem criar conta paralela sem
 * e-mail; o usuário entra pelo link mágico ou pela conta Google original).
 */
async function ligarGoogle(db: Banco, u: Usuario, sub: string): Promise<Usuario> {
  const [ligado] = await db
    .update(usuarios)
    .set({ googleSub: sub })
    .where(and(eq(usuarios.id, u.id), isNull(usuarios.googleSub)))
    .returning(COLUNAS);
  if (ligado) return ligado;
  const [atual] = await db.select({ googleSub: usuarios.googleSub }).from(usuarios).where(eq(usuarios.id, u.id));
  if (atual?.googleSub === sub) return { ...u, google: true }; // outro pedido do mesmo login ligou primeiro
  throw new ErroGoogleOutraConta();
}

/** Login Google: acha por `sub`; senão liga ao e-mail (se verificado); senão cria. */
export async function entrarComGoogle(db: Banco, g: PerfilGoogle): Promise<Usuario> {
  const porSub = await usuarioPorGoogle(db, g.sub);
  if (porSub) return porSub;
  const email = g.emailVerificado ? normalizarEmail(g.email) : null;
  if (email) {
    const u = await usuarioPorEmail(db, email);
    if (u) return ligarGoogle(db, u, g.sub);
  }
  try {
    return await criarUsuario(db, { apelidoBase: baseDeApelido(g.nome ?? email ?? 'jogador'), email, googleSub: g.sub });
  } catch (e) {
    // corrida com outro login (mesmo sub, ou mesmo e-mail por link mágico): rebusca e segue
    if (!ehViolacaoUnica(e) || violouApelido(e)) throw e;
    const porSubAgora = await usuarioPorGoogle(db, g.sub);
    if (porSubAgora) return porSubAgora;
    const porEmail = email ? await usuarioPorEmail(db, email) : null;
    if (porEmail) return ligarGoogle(db, porEmail, g.sub);
    throw e;
  }
}

export async function trocarApelido(db: Banco, id: number, cru: unknown): Promise<'ok' | 'invalido' | 'em-uso'> {
  const apelido = apelidoValido(cru);
  if (!apelido) return 'invalido';
  try {
    await db.update(usuarios).set({ apelido }).where(eq(usuarios.id, id));
    return 'ok';
  } catch (e) {
    if (ehViolacaoUnica(e)) return 'em-uso';
    throw e;
  }
}

/** Quem já entrou (por link mágico) liga um Google à própria conta, para entrar pelos dois. */
export async function conectarGoogle(db: Banco, id: number, sub: string): Promise<Usuario> {
  const dono = await usuarioPorGoogle(db, sub);
  if (dono) {
    if (dono.id !== id) throw new ErroGoogleOutraConta();
    return dono;
  }
  const u = await usuarioPorId(db, id);
  if (!u) throw new Error('usuário não existe');
  try {
    return await ligarGoogle(db, u, sub);
  } catch (e) {
    // corrida: outro pedido ligou este mesmo Google a outra conta
    if (ehViolacaoUnica(e)) throw new ErroGoogleOutraConta();
    throw e;
  }
}

// ---------- foto de perfil ----------

/** Tamanho máximo da foto já reduzida pelo navegador (data URL inteira). */
export const MAX_AVATAR_CHARS = 60_000;

const ASSINATURAS: Record<string, (b: Buffer) => boolean> = {
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

/**
 * `pronto:<id>` de um avatar do site, ou uma imagem `data:` (jpeg, png ou webp) pequena cujo conteúdo
 * bate com o tipo declarado. null = remover a foto; undefined = inválido.
 */
export function avatarValido(cru: unknown): string | null | undefined {
  if (cru === null) return null;
  if (typeof cru !== 'string') return undefined;
  if (cru.startsWith('pronto:')) return (AVATARES_PRONTOS as readonly string[]).includes(cru.slice(7)) ? cru : undefined;
  if (cru.length > MAX_AVATAR_CHARS) return undefined;
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(cru);
  if (!m) return undefined;
  const bytes = Buffer.from(m[2], 'base64');
  return bytes.length >= 12 && ASSINATURAS[m[1]](bytes) ? cru : undefined;
}

export async function trocarAvatar(db: Banco, id: number, cru: unknown): Promise<Usuario | null> {
  const avatar = avatarValido(cru);
  if (avatar === undefined) return null;
  const [u] = await db.update(usuarios).set({ avatar }).where(eq(usuarios.id, id)).returning(COLUNAS);
  return u ?? null;
}

// ---------- preferências da mesa ----------

/** Valida as preferências cruas (mesmas regras da criação de sala); null se não for um objeto. */
export function preferenciasValidas(cru: unknown): PreferenciasMesa | null {
  if (!cru || typeof cru !== 'object' || Array.isArray(cru)) return null;
  const c = cru as Record<string, unknown>;
  // Mesmo formato da criação de sala: regras dentro de `regras`, o resto por fora.
  const o = opcoesDaSala({ ...c, regras: c, modo: 'privada' });
  const { variante, ...regras } = o.regras;
  return { variante, ...regras, maoLimpa: regras.maoLimpa === true, humanos: o.humanos, nivelBot: o.nivelBot, chanceInterceptarSinal: o.chanceInterceptarSinal };
}

export async function lerPreferencias(db: Banco, id: number): Promise<PreferenciasMesa | null> {
  const [x] = await db.select({ p: usuarios.preferencias }).from(usuarios).where(eq(usuarios.id, id)).limit(1);
  return x?.p ? preferenciasValidas(x.p) : null;
}

export async function gravarPreferencias(db: Banco, id: number, cru: unknown): Promise<PreferenciasMesa | null> {
  const p = preferenciasValidas(cru);
  if (!p) return null;
  await db.update(usuarios).set({ preferencias: p }).where(eq(usuarios.id, id));
  return p;
}

// ---------- sessões ----------

export async function criarSessao(db: Banco, usuarioId: number, agora: Date): Promise<string> {
  const token = gerarToken();
  await db.insert(sessoes).values({
    tokenHash: hashToken(token),
    usuarioId,
    expiraEm: new Date(agora.getTime() + DURACAO_SESSAO_MS),
    criadaEm: agora,
  });
  return token;
}

export async function usuarioDaSessao(db: Banco, token: string | null | undefined, agora: Date): Promise<Usuario | null> {
  if (!token || token.length > 200) return null;
  const [u] = await db
    .select(COLUNAS)
    .from(sessoes)
    .innerJoin(usuarios, eq(sessoes.usuarioId, usuarios.id))
    .where(and(eq(sessoes.tokenHash, hashToken(token)), gt(sessoes.expiraEm, agora)));
  return u ?? null;
}

export async function encerrarSessao(db: Banco, token: string): Promise<void> {
  await db.delete(sessoes).where(eq(sessoes.tokenHash, hashToken(token)));
}

// ---------- links mágicos ----------

/** Cria um link novo; apaga os não usados daquele e-mail (só o último vale) e os vencidos. */
export async function criarLinkMagico(db: Banco, emailCru: string, agora: Date): Promise<string> {
  const email = emailOuErro(emailCru);
  const token = gerarToken();
  await db
    .delete(linksMagicos)
    .where(or(and(eq(linksMagicos.email, email), eq(linksMagicos.usado, false)), lte(linksMagicos.expiraEm, agora)));
  await db.insert(linksMagicos).values({
    tokenHash: hashToken(token),
    email,
    expiraEm: new Date(agora.getTime() + DURACAO_LINK_MS),
    criadoEm: agora,
  });
  return token;
}

/** Marca como usado e devolve o e-mail, numa única instrução (dois cliques não entram duas vezes). */
export async function consumirLinkMagico(db: Banco, token: string, agora: Date): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const [l] = await db
    .update(linksMagicos)
    .set({ usado: true })
    .where(and(eq(linksMagicos.tokenHash, hashToken(token)), eq(linksMagicos.usado, false), gt(linksMagicos.expiraEm, agora)))
    .returning({ email: linksMagicos.email });
  return l?.email ?? null;
}

// ---------- limpeza ----------

/** Apaga sessões vencidas e links vencidos ou já usados. */
export async function limparExpirados(db: Banco, agora: Date): Promise<{ sessoes: number; links: number }> {
  const s = await db.delete(sessoes).where(lte(sessoes.expiraEm, agora)).returning({ t: sessoes.tokenHash });
  const l = await db
    .delete(linksMagicos)
    .where(or(lte(linksMagicos.expiraEm, agora), eq(linksMagicos.usado, true)))
    .returning({ t: linksMagicos.tokenHash });
  return { sessoes: s.length, links: l.length };
}
