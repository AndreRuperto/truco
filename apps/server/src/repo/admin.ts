import { and, desc, eq, ilike, inArray, isNull, lt, or, type SQL, sql } from 'drizzle-orm';
import type { DiaAdmin, PartidaAdmin, UsuarioAdmin, VisaoPartidasAdmin } from '../api/tipos';
import type { Banco } from '../banco/banco';
import { participacoes, partidas, sessoes, usuarios } from '../banco/schema';

const DIA_MS = 24 * 60 * 60 * 1000;
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const diaUtc = (d: Date) => d.toISOString().slice(0, 10);

/** Totais e a série dos últimos `dias` dias (UTC), com zeros nos dias vazios. */
export async function resumoAdmin(db: Banco, agora: Date, dias = 14): Promise<{ usuarios: number; banidos: number; partidas: number; porDia: DiaAdmin[] }> {
  const [u] = await db
    .select({ total: sql<number>`count(*)::int`, banidos: sql<number>`count(${usuarios.banidoEm})::int` })
    .from(usuarios);
  const [p] = await db.select({ total: sql<number>`count(*)::int` }).from(partidas);
  const inicio = new Date(Date.parse(diaUtc(new Date(agora.getTime() - (dias - 1) * DIA_MS))));
  const novos = await db
    .select({ dia: sql<string>`to_char(${usuarios.criadoEm} at time zone 'UTC', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
    .from(usuarios)
    .where(sql`${usuarios.criadoEm} >= ${inicio.toISOString()}`)
    .groupBy(sql`1`);
  const jogadas = await db
    .select({ dia: sql<string>`to_char(${partidas.iniciadaEm} at time zone 'UTC', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
    .from(partidas)
    .where(sql`${partidas.iniciadaEm} >= ${inicio.toISOString()}`)
    .groupBy(sql`1`);
  const mapa = (xs: { dia: string; n: number }[]) => new Map(xs.map((x) => [x.dia, x.n]));
  const mu = mapa(novos);
  const mp = mapa(jogadas);
  const porDia: DiaAdmin[] = [];
  for (let i = 0; i < dias; i++) {
    const dia = diaUtc(new Date(inicio.getTime() + i * DIA_MS));
    porDia.push({ dia, usuarios: mu.get(dia) ?? 0, partidas: mp.get(dia) ?? 0 });
  }
  return { usuarios: u.total, banidos: u.banidos, partidas: p.total, porDia };
}

/** Até `limite` usuários, os mais novos primeiro; `busca` filtra por apelido ou e-mail (contém, sem caixa). */
export async function listarUsuariosAdmin(db: Banco, o: { busca?: string; admins: readonly string[]; limite?: number }): Promise<UsuarioAdmin[]> {
  const termo = (o.busca ?? '').trim().slice(0, 100);
  const padrao = `%${termo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const linhas = await db
    .select({
      id: usuarios.id,
      apelido: usuarios.apelido,
      email: usuarios.email,
      google: sql<boolean>`(${usuarios.googleSub} is not null)`,
      avatar: usuarios.avatar,
      criadoEm: usuarios.criadoEm,
      banidoEm: usuarios.banidoEm,
      // Nomes qualificados à mão: dentro do sql`` o Drizzle escreve só "id", que a subconsulta leria como participacoes.id.
      partidas: sql<number>`(select count(*)::int from participacoes p where p.usuario_id = usuarios.id)`,
    })
    .from(usuarios)
    .where(termo ? or(ilike(usuarios.apelido, padrao), ilike(usuarios.email, padrao)) : undefined)
    .orderBy(desc(usuarios.criadoEm), desc(usuarios.id))
    .limit(o.limite ?? 50);
  return linhas.map((l) => ({
    ...l,
    criadoEm: l.criadoEm.toISOString(),
    banidoEm: iso(l.banidoEm),
    admin: !!l.email && o.admins.includes(l.email),
  }));
}

/** Suspende a conta e derruba as sessões. false = não existe ou já estava banido. */
export async function banirUsuario(db: Banco, id: number, agora: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const r = await tx
      .update(usuarios)
      .set({ banidoEm: agora })
      .where(and(eq(usuarios.id, id), isNull(usuarios.banidoEm)))
      .returning({ id: usuarios.id });
    if (r.length === 0) return false;
    await tx.delete(sessoes).where(eq(sessoes.usuarioId, id));
    return true;
  });
}

/** false = não existe ou não estava banido. */
export async function desbanirUsuario(db: Banco, id: number): Promise<boolean> {
  const r = await db
    .update(usuarios)
    .set({ banidoEm: null })
    .where(and(eq(usuarios.id, id), sql`${usuarios.banidoEm} is not null`))
    .returning({ id: usuarios.id });
  return r.length > 0;
}

// Nome qualificado à mão: dentro do sql`` o Drizzle escreve só "id", que a subconsulta leria como j.id.
const existeParticipacao = (usuarioId: number) =>
  sql`exists (select 1 from participacoes j where j.partida_id = partidas.id and j.usuario_id = ${usuarioId})`;

function filtroVisao(visao: VisaoPartidasAdmin, adminId: number): SQL | undefined {
  if (visao === 'criadas') return eq(partidas.criadorId, adminId);
  if (visao === 'jogadas') return existeParticipacao(adminId);
  return undefined;
}

/** Até `limite` partidas da visão, as mais novas primeiro (por id), antes do cursor `antes`. */
export async function partidasAdmin(
  db: Banco,
  o: { visao: VisaoPartidasAdmin; adminId: number; antes?: number; limite: number },
): Promise<{ partidas: PartidaAdmin[]; proximo: number | null }> {
  const filtro = and(filtroVisao(o.visao, o.adminId), o.antes !== undefined ? lt(partidas.id, o.antes) : undefined);
  // Um a mais só para saber se há próxima página.
  const ps = await db.select().from(partidas).where(filtro).orderBy(desc(partidas.id)).limit(o.limite + 1);
  const pagina = ps.slice(0, o.limite);
  return { partidas: await comJogadores(db, pagina), proximo: ps.length > o.limite ? pagina[pagina.length - 1].id : null };
}

/** Totais das três visões para o admin e quantas partidas não têm criador registrado. */
export async function contagensPartidasAdmin(db: Banco, adminId: number): Promise<{ contagens: Record<VisaoPartidasAdmin, number>; semCriador: number }> {
  const [c] = await db
    .select({
      todas: sql<number>`count(*)::int`,
      criadas: sql<number>`count(*) filter (where ${partidas.criadorId} = ${adminId})::int`,
      jogadas: sql<number>`count(*) filter (where ${existeParticipacao(adminId)})::int`,
      semCriador: sql<number>`count(*) filter (where ${partidas.criadorId} is null)::int`,
    })
    .from(partidas);
  return { contagens: { criadas: c.criadas, jogadas: c.jogadas, todas: c.todas }, semCriador: c.semCriador };
}

async function comJogadores(db: Banco, ps: (typeof partidas.$inferSelect)[]): Promise<PartidaAdmin[]> {
  if (ps.length === 0) return [];
  const js = await db
    .select()
    .from(participacoes)
    .where(inArray(
      participacoes.partidaId,
      ps.map((p) => p.id),
    ))
    .orderBy(participacoes.cadeira);
  return ps.map((p) => ({
    id: p.id,
    criadorId: p.criadorId,
    variante: p.variante,
    modo: p.modo,
    ranqueada: p.ranqueada,
    placar: [p.placar0, p.placar1],
    vencedora: p.vencedora,
    abandonada: p.abandonada,
    iniciadaEm: p.iniciadaEm.toISOString(),
    terminadaEm: iso(p.terminadaEm),
    jogadores: js
      .filter((j) => j.partidaId === p.id)
      .map((j) => ({ nome: j.nome, usuarioId: j.usuarioId, humano: j.humano, dupla: j.dupla, abandonou: j.abandonou })),
  }));
}
