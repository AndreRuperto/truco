import { type Cadeira, type Dupla, duplaDe, type Variante } from '@truco/engine';
import { and, asc, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Formato, ItemHistorico, LinhaRanking, PerfilApi, RatingVariante } from '../api/tipos';
import type { Banco } from '../banco/banco';
import { bloqueiosFila, participacoes, partidas, ratings, usuarios, VARIANTES } from '../banco/schema';
import type { ModoMesa } from '../mesa/protocolo';
import { conquistasDe } from '../ranking/conquistas';
import { ELO_INICIAL, novosPontos, patenteDe, proximaPatente } from '../ranking/elo';
import { type Contadores, contadoresZerados, percentual } from '../ranking/estatisticas';
import { deltaAbandono, deltasDoFim, type JogadorRanqueado } from '../ranking/resultado';
import { cacifeEfetivo, dividirPote, LIMITE_PREMIO_MESMOS } from '../loja/regras';
import { movimentar, saldosDe } from './carteira';

/** O que `Banco` e uma transação têm em comum (o que as funções abaixo usam). */
type Exec = Pick<Banco, 'select' | 'insert' | 'update' | 'delete'>;

export interface AssentoRegistro {
  cadeira: Cadeira;
  usuarioId: number | null;
  nome: string;
  humano: boolean;
}

export interface InicioPartida {
  variante: Variante;
  modo: ModoMesa;
  formato: Formato | null;
  assentos: AssentoRegistro[];
  /** Cacife pedido (Fichas); 0 ou ausente = sem cacife. */
  cacife?: number;
}

export interface PartidaIniciada {
  id: number;
  /** Cacife efetivo que cada pagante pagou (0 = partida sem cacife). */
  cacife: number;
  pote: number;
}

export interface FimPartida {
  placar: readonly [number, number];
  vencedora: Dupla | null;
  /** Por cadeira (0–3). */
  contadores: readonly Contadores[];
}

export interface OpcoesRanking {
  k: number;
  agora: Date;
}

async function lerRating(db: Exec, usuarioId: number, variante: Variante) {
  const [r] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.usuarioId, usuarioId), eq(ratings.variante, variante)));
  return r ? { elo: r.elo, pontos: r.pontos, partidas: r.partidas } : { elo: ELO_INICIAL, pontos: 0, partidas: 0 };
}

export const ratingDe = (db: Banco, usuarioId: number, variante: Variante) => lerRating(db, usuarioId, variante);

/** Soma o delta ao Elo e aos pontos (piso 0) e conta a partida ranqueada. */
async function somarRating(db: Exec, usuarioId: number, variante: Variante, delta: number, agora: Date): Promise<void> {
  await db
    .insert(ratings)
    .values({ usuarioId, variante, elo: ELO_INICIAL + delta, pontos: novosPontos(0, delta), partidas: 1, atualizadoEm: agora })
    .onConflictDoUpdate({
      target: [ratings.usuarioId, ratings.variante],
      set: {
        elo: sql`${ratings.elo} + ${delta}`,
        pontos: sql`greatest(0, ${ratings.pontos} + ${delta})`,
        partidas: sql`${ratings.partidas} + 1`,
        atualizadoEm: agora,
      },
    });
}

type LinhaParticipacao = typeof participacoes.$inferSelect;

function jogadoresRanqueados(ps: readonly LinhaParticipacao[]): JogadorRanqueado[] {
  return ps
    .filter((x) => x.humano && x.usuarioId !== null && x.eloAntes !== null)
    .map((x) => ({ usuarioId: x.usuarioId!, dupla: x.dupla as Dupla, elo: x.eloAntes! }));
}

export async function iniciarPartida(db: Banco, i: InicioPartida, agora: Date): Promise<number> {
  return (await iniciarPartidaComCacife(db, i, agora)).id;
}

/** Humanos com conta: só eles pagam e recebem Fichas (convidado e bot nunca). */
const pagantes = <T extends { humano: boolean; usuarioId: number | null }>(xs: readonly T[]) =>
  xs.filter((x): x is T & { usuarioId: number } => x.humano && x.usuarioId !== null);

/**
 * Grava o início e, com cacife, debita o efetivo de cada pagante na mesma transação.
 * Sem pagante em uma das duplas, a partida corre sem cacife.
 */
export async function iniciarPartidaComCacife(db: Banco, i: InicioPartida, agora: Date): Promise<PartidaIniciada> {
  return db.transaction(async (tx) => {
    const ranqueada = i.modo === 'ranqueada';
    const [p] = await tx
      .insert(partidas)
      .values({ variante: i.variante, modo: i.modo, formato: i.formato, ranqueada, iniciadaEm: agora })
      .returning({ id: partidas.id });
    const linhas = [];
    for (const a of i.assentos) {
      const eloAntes = ranqueada && a.humano && a.usuarioId !== null ? (await lerRating(tx, a.usuarioId, i.variante)).elo : null;
      linhas.push({
        partidaId: p.id,
        usuarioId: a.usuarioId,
        nome: a.nome,
        humano: a.humano,
        cadeira: a.cadeira,
        dupla: duplaDe(a.cadeira),
        eloAntes,
      });
    }
    await tx.insert(participacoes).values(linhas);
    const quem = pagantes(i.assentos);
    const asDuas = [0, 1].every((d) => quem.some((a) => duplaDe(a.cadeira) === d));
    let cacife = 0;
    if ((i.cacife ?? 0) > 0 && asDuas) {
      const saldos = [];
      for (const a of quem) saldos.push((await saldosDe(tx, a.usuarioId)).fichas);
      cacife = cacifeEfetivo(i.cacife ?? 0, saldos);
    }
    if (cacife === 0) return { id: p.id, cacife: 0, pote: 0 };
    const pote = cacife * quem.length;
    for (const a of quem) await movimentar(tx, a.usuarioId, 'fichas', -cacife, 'cacife', String(p.id));
    await tx.update(partidas).set({ cacife, pote }).where(eq(partidas.id, p.id));
    return { id: p.id, cacife, pote };
  });
}

/**
 * Saída definitiva antes do fim. Ranqueada: derrota na hora + bloqueio de fila.
 * Devolve o delta aplicado (null se não houve penalidade ou já estava registrado).
 */
export async function registrarAbandono(
  db: Banco,
  partidaId: number,
  usuarioId: number,
  o: OpcoesRanking & { bloqueioMs: number },
): Promise<number | null> {
  return db.transaction(async (tx) => {
    // FOR UPDATE: serializa com outro abandono e com o fim da mesma partida (Postgres real
    // roda transações em paralelo); o que vier depois relê o estado já gravado.
    const [p] = await tx.select().from(partidas).where(eq(partidas.id, partidaId)).for('update');
    if (!p || p.terminadaEm) return null;
    const ps = await tx.select().from(participacoes).where(eq(participacoes.partidaId, partidaId));
    const eu = ps.find((x) => x.humano && x.usuarioId === usuarioId);
    if (!eu || eu.abandonou) return null;
    if (!p.ranqueada || eu.eloAntes === null) {
      await tx.update(participacoes).set({ abandonou: true }).where(eq(participacoes.id, eu.id));
      return null;
    }
    const delta = deltaAbandono(jogadoresRanqueados(ps), usuarioId, o.k);
    await tx
      .update(participacoes)
      .set({ abandonou: true, venceu: false, eloDepois: eu.eloAntes + delta })
      .where(eq(participacoes.id, eu.id));
    await somarRating(tx, usuarioId, p.variante, delta, o.agora);
    const ate = new Date(o.agora.getTime() + o.bloqueioMs);
    await tx
      .insert(bloqueiosFila)
      .values({ usuarioId, ate, motivo: 'abandono' })
      .onConflictDoUpdate({ target: bloqueiosFila.usuarioId, set: { ate, motivo: 'abandono' } });
    return delta;
  });
}

/** Fim: placar, estatísticas, vitória e (ranqueada) Elo de quem ficou. Devolve os deltas. */
export async function terminarPartida(db: Banco, partidaId: number, fim: FimPartida, o: OpcoesRanking): Promise<Map<number, number>> {
  return db.transaction(async (tx) => {
    const deltas = new Map<number, number>();
    // Reivindica o fim numa instrução só: um segundo `terminarPartida` (ou um abandono
    // concorrente, que trava a linha) não passa daqui com a partida já terminada.
    const [p] = await tx
      .update(partidas)
      .set({ terminadaEm: o.agora })
      .where(and(eq(partidas.id, partidaId), isNull(partidas.terminadaEm)))
      .returning();
    if (!p) return deltas;
    const ps = await tx.select().from(participacoes).where(eq(participacoes.partidaId, partidaId));
    const presentes = ps.filter((x) => x.humano && !x.abandonou);
    for (const x of ps) {
      const c = fim.contadores[x.cadeira] ?? contadoresZerados();
      const venceu = x.humano && !x.abandonou && fim.vencedora !== null ? x.dupla === fim.vencedora : x.venceu;
      await tx.update(participacoes).set({ ...c, venceu }).where(eq(participacoes.id, x.id));
    }
    const abandonada = presentes.length === 0;
    if (p.ranqueada && !abandonada && fim.vencedora !== null) {
      const alvos = presentes.filter((x) => x.usuarioId !== null && x.eloAntes !== null).map((x) => x.usuarioId!);
      for (const [uid, d] of deltasDoFim(jogadoresRanqueados(ps), alvos, fim.vencedora, o.k)) {
        deltas.set(uid, d);
        const x = ps.find((y) => y.usuarioId === uid)!;
        await tx.update(participacoes).set({ eloDepois: x.eloAntes! + d }).where(eq(participacoes.id, x.id));
        await somarRating(tx, uid, p.variante, d, o.agora);
      }
    }
    await tx
      .update(partidas)
      .set({ placar0: fim.placar[0], placar1: fim.placar[1], vencedora: fim.vencedora, terminadaEm: o.agora, abandonada })
      .where(eq(partidas.id, partidaId));
    if (p.pote > 0 && !abandonada && fim.vencedora !== null) await pagarPote(tx, p, ps, fim.vencedora, o.agora);
    return deltas;
  });
}

/**
 * Sala descartada com a partida começada e sem fim (todos os humanos saíram): fecha como
 * `abandonada`, sem placar nem Elo (as penalidades de quem abandonou já foram gravadas).
 * Não mexe numa partida já terminada.
 */
export async function encerrarAbandonada(db: Banco, partidaId: number, agora: Date, o: { reembolsar?: boolean } = {}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const r = await tx
      .update(partidas)
      .set({ terminadaEm: agora, abandonada: true })
      .where(and(eq(partidas.id, partidaId), isNull(partidas.terminadaEm)))
      .returning({ id: partidas.id, cacife: partidas.cacife });
    if (r.length === 0) return false;
    // Sem `reembolsar` (todos os humanos saíram), o pote some: quem saiu perdeu o cacife.
    if (o.reembolsar && r[0].cacife > 0) await reembolsar(tx, r[0].id, r[0].cacife);
    return true;
  });
}

/** Devolve o cacife a todos os pagantes (inclusive quem caiu): a culpa foi do servidor, não deles. */
async function reembolsar(tx: Exec, partidaId: number, cacife: number): Promise<void> {
  const ps = await tx.select().from(participacoes).where(eq(participacoes.partidaId, partidaId));
  for (const x of pagantes(ps)) await movimentar(tx, x.usuarioId, 'fichas', cacife, 'estorno_partida', String(partidaId));
}

/**
 * Fim com vencedora: o pote vai para os pagantes da dupla vencedora que ficaram até o fim.
 * Ranqueada repetida entre o mesmo grupo (anti-fazenda): cada um que ficou recebe o seu de volta.
 * Ninguém da vencedora ficou: o pote some.
 */
async function pagarPote(tx: Exec, p: typeof partidas.$inferSelect, ps: readonly LinhaParticipacao[], vencedora: Dupla, agora: Date): Promise<void> {
  const quem = pagantes(ps);
  if (p.ranqueada && (await partidasDoMesmoGrupo(tx, p.id, quem.map((x) => x.usuarioId), agora)) >= LIMITE_PREMIO_MESMOS) {
    for (const x of quem.filter((y) => !y.abandonou)) await movimentar(tx, x.usuarioId, 'fichas', p.cacife, 'estorno_partida', String(p.id));
    return;
  }
  const vencedores = quem.filter((x) => x.dupla === vencedora && !x.abandonou);
  const porCadeira = new Map(vencedores.map((x) => [x.cadeira, x.usuarioId]));
  for (const [cadeira, valor] of dividirPote(p.pote, [...porCadeira.keys()])) {
    await movimentar(tx, porCadeira.get(cadeira)!, 'fichas', valor, 'premio', String(p.id));
  }
}

/** Ranqueadas terminadas nas últimas 24 h (fora esta) com exatamente o mesmo grupo de contas. */
async function partidasDoMesmoGrupo(tx: Exec, partidaId: number, ids: readonly number[], agora: Date): Promise<number> {
  const desde = new Date(agora.getTime() - 24 * 60 * 60_000);
  const linhas = await tx
    .select({ partidaId: participacoes.partidaId, usuarioId: participacoes.usuarioId })
    .from(participacoes)
    .innerJoin(partidas, eq(participacoes.partidaId, partidas.id))
    .where(
      and(
        eq(partidas.ranqueada, true),
        eq(partidas.abandonada, false),
        gt(partidas.terminadaEm, desde),
        isNotNull(participacoes.usuarioId),
        sql`${partidas.id} <> ${partidaId}`,
      ),
    );
  const grupos = new Map<number, Set<number>>();
  for (const l of linhas) {
    if (!grupos.has(l.partidaId)) grupos.set(l.partidaId, new Set());
    grupos.get(l.partidaId)!.add(l.usuarioId!);
  }
  const alvo = [...new Set(ids)].sort((a, b) => a - b).join(',');
  let n = 0;
  for (const g of grupos.values()) if ([...g].sort((a, b) => a - b).join(',') === alvo) n++;
  return n;
}

/**
 * Boot: partidas sem fim só existem se o processo anterior morreu no meio (crash, SIGKILL
 * depois do prazo de desligamento). Fecha todas como `abandonadas`, sem placar, Elo nem
 * bloqueio. Só pode rodar antes de o servidor aceitar conexões (1 réplica). Devolve quantas.
 */
export async function encerrarOrfas(db: Banco, agora: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const r = await tx
      .update(partidas)
      .set({ terminadaEm: agora, abandonada: true })
      .where(isNull(partidas.terminadaEm))
      .returning({ id: partidas.id, cacife: partidas.cacife });
    for (const x of r) if (x.cacife > 0) await reembolsar(tx, x.id, x.cacife);
    return r.length;
  });
}

export async function bloqueioAte(db: Banco, usuarioId: number, agora: Date): Promise<Date | null> {
  const [x] = await db
    .select({ ate: bloqueiosFila.ate })
    .from(bloqueiosFila)
    .where(and(eq(bloqueiosFila.usuarioId, usuarioId), gt(bloqueiosFila.ate, agora)));
  return x?.ate ?? null;
}

export async function perfil(db: Banco, usuarioId: number): Promise<PerfilApi | null> {
  const [u] = await db.select({ id: usuarios.id, apelido: usuarios.apelido, avatar: usuarios.avatar }).from(usuarios).where(eq(usuarios.id, usuarioId));
  if (!u) return null;
  const rs = await db.select().from(ratings).where(eq(ratings.usuarioId, usuarioId));
  const est = await db
    .select({
      variante: partidas.variante,
      jogos: sql<number>`(count(*))::int`,
      vitorias: sql<number>`(count(*) filter (where ${participacoes.venceu}))::int`,
      respostas: sql<number>`(coalesce(sum(${participacoes.respostasTruco}), 0))::int`,
      aceitos: sql<number>`(coalesce(sum(${participacoes.trucosAceitos}), 0))::int`,
      corridas: sql<number>`(coalesce(sum(${participacoes.corridas}), 0))::int`,
    })
    .from(participacoes)
    .innerJoin(partidas, eq(participacoes.partidaId, partidas.id))
    .where(and(eq(participacoes.usuarioId, usuarioId), isNotNull(partidas.terminadaEm)))
    .groupBy(partidas.variante);
  const variantes = {} as Record<Variante, RatingVariante>;
  for (const v of VARIANTES) {
    const r = rs.find((x) => x.variante === v);
    const e = est.find((x) => x.variante === v);
    const pontos = r?.pontos ?? 0;
    variantes[v] = {
      elo: r?.elo ?? ELO_INICIAL,
      pontos,
      patente: patenteDe(pontos),
      proxima: proximaPatente(pontos),
      partidasRanqueadas: r?.partidas ?? 0,
      jogos: e?.jogos ?? 0,
      vitorias: e?.vitorias ?? 0,
      pctTrucoAceito: percentual(e?.aceitos ?? 0, e?.respostas ?? 0),
      corridas: e?.corridas ?? 0,
    };
  }
  const [t] = await db
    .select({
      jogos: sql<number>`(count(*))::int`,
      vitorias: sql<number>`(count(*) filter (where ${participacoes.venceu}))::int`,
      trucosPedidos: sql<number>`(coalesce(sum(${participacoes.trucosPedidos}), 0))::int`,
      trucosAceitos: sql<number>`(coalesce(sum(${participacoes.trucosAceitos}), 0))::int`,
      ranqueadas: sql<number>`(count(*) filter (where ${partidas.ranqueada}))::int`,
      variantes: sql<number>`(count(distinct ${partidas.variante}))::int`,
      privadas: sql<number>`(count(*) filter (where ${partidas.modo} = 'privada'))::int`,
      lavadas: sql<number>`(count(*) filter (where ${participacoes.venceu} and ((${participacoes.dupla} = 0 and ${partidas.placar1} = 0) or (${participacoes.dupla} = 1 and ${partidas.placar0} = 0))))::int`,
    })
    .from(participacoes)
    .innerJoin(partidas, eq(participacoes.partidaId, partidas.id))
    .where(and(eq(participacoes.usuarioId, usuarioId), isNotNull(partidas.terminadaEm), eq(partidas.abandonada, false)));
  const pontos = Math.max(0, ...rs.map((r) => r.pontos));
  return { usuario: u, variantes, conquistas: conquistasDe({ ...t, pontos }) };
}

export async function historico(db: Banco, usuarioId: number, limite = 20): Promise<ItemHistorico[]> {
  const linhas = await db
    .select({
      partidaId: partidas.id,
      variante: partidas.variante,
      modo: partidas.modo,
      ranqueada: partidas.ranqueada,
      placar0: partidas.placar0,
      placar1: partidas.placar1,
      iniciadaEm: partidas.iniciadaEm,
      terminadaEm: partidas.terminadaEm,
      dupla: participacoes.dupla,
      venceu: participacoes.venceu,
      abandonou: participacoes.abandonou,
      eloAntes: participacoes.eloAntes,
      eloDepois: participacoes.eloDepois,
    })
    .from(participacoes)
    .innerJoin(partidas, eq(participacoes.partidaId, partidas.id))
    .where(eq(participacoes.usuarioId, usuarioId))
    .orderBy(desc(partidas.iniciadaEm), desc(partidas.id))
    .limit(Math.min(100, Math.max(1, limite)));
  return linhas.map((l) => ({
    partidaId: l.partidaId,
    variante: l.variante,
    modo: l.modo,
    ranqueada: l.ranqueada,
    nos: l.dupla === 0 ? l.placar0 : l.placar1,
    eles: l.dupla === 0 ? l.placar1 : l.placar0,
    venceu: l.venceu,
    abandonou: l.abandonou,
    deltaElo: l.eloAntes !== null && l.eloDepois !== null ? l.eloDepois - l.eloAntes : null,
    iniciadaEm: l.iniciadaEm.toISOString(),
    terminadaEm: l.terminadaEm?.toISOString() ?? null,
  }));
}

export async function ranking(db: Banco, variante: Variante, limite = 50): Promise<LinhaRanking[]> {
  const linhas = await db
    .select({
      usuarioId: ratings.usuarioId,
      apelido: usuarios.apelido,
      pontos: ratings.pontos,
      elo: ratings.elo,
      partidas: ratings.partidas,
    })
    .from(ratings)
    .innerJoin(usuarios, eq(ratings.usuarioId, usuarios.id))
    .where(and(eq(ratings.variante, variante), gt(ratings.partidas, 0)))
    .orderBy(desc(ratings.pontos), desc(ratings.elo), asc(ratings.usuarioId))
    .limit(Math.min(200, Math.max(1, limite)));
  return linhas.map((l, i) => ({ posicao: i + 1, ...l, patente: patenteDe(l.pontos) }));
}
