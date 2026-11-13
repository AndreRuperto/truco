import { desc, eq } from 'drizzle-orm';
import type { Banco } from '../banco/banco';
import { auditoria, usuarios } from '../banco/schema';

/** O que `Banco` e uma transação têm em comum (o que as funções abaixo usam). */
type Exec = Pick<Banco, 'insert'>;

/** Ações do admin (e, na F6, denúncias) que ficam na trilha. */
export type AcaoAuditoria = 'banir' | 'desbanir' | 'ajuste_saldo' | 'estorno_pila' | 'denuncia';

export interface RegistroAuditoria {
  adminId: number;
  acao: AcaoAuditoria;
  alvoId?: number | null;
  /** Só ids, valores e o texto que o próprio admin escreveu: nunca e-mail de terceiros. */
  detalhe?: Record<string, unknown> | null;
}

/** Grava uma linha na trilha (dentro da mesma transação da ação, quando houver). */
export async function registrarAuditoria(db: Exec, r: RegistroAuditoria, agora: Date): Promise<void> {
  await db.insert(auditoria).values({ adminId: r.adminId, acao: r.acao, alvoId: r.alvoId ?? null, detalhe: r.detalhe ?? null, criadoEm: agora });
}

export interface LinhaAuditoria {
  id: number;
  adminId: number;
  admin: string;
  acao: string;
  alvoId: number | null;
  detalhe: unknown;
  criadoEm: string;
}

/** As últimas `limite` linhas, mais nova primeiro, com o apelido de quem fez. */
export async function auditoriaRecente(db: Banco, limite = 100): Promise<LinhaAuditoria[]> {
  const linhas = await db
    .select({ id: auditoria.id, adminId: auditoria.adminId, admin: usuarios.apelido, acao: auditoria.acao, alvoId: auditoria.alvoId, detalhe: auditoria.detalhe, criadoEm: auditoria.criadoEm })
    .from(auditoria)
    .innerJoin(usuarios, eq(auditoria.adminId, usuarios.id))
    .orderBy(desc(auditoria.id))
    .limit(limite);
  return linhas.map((l) => ({ ...l, criadoEm: l.criadoEm.toISOString() }));
}
