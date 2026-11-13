import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migrarPg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migrarPglite } from 'drizzle-orm/pglite/migrator';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as schema from './schema';
import { log } from '../log';

/** Tipo comum ao node-postgres e ao PGlite. */
export type Banco = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface ConexaoBanco {
  db: Banco;
  tipo: 'postgres' | 'pglite';
  fechar(): Promise<void>;
}

export interface OpcoesBanco {
  /** `DATABASE_URL`. Sem ela, PGlite. */
  url?: string;
  /** Pasta do PGlite em disco; sem ela, PGlite em memória. */
  pastaPglite?: string;
  /** Só para testes: outra pasta de migrações. */
  pastaMigracoes?: string;
}

export const PASTA_MIGRACOES = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Abre o banco e aplica as migrações pendentes (idempotente). Se a migração falhar, fecha e relança. */
export async function abrirBanco(o: OpcoesBanco = {}): Promise<ConexaoBanco> {
  const migrationsFolder = o.pastaMigracoes ?? PASTA_MIGRACOES;
  if (o.url) {
    const pool = new pg.Pool({ connectionString: o.url, max: 10 });
    // Sem ouvinte, um erro num cliente ocioso (Postgres reiniciou, rede caiu) derruba o processo.
    pool.on('error', (e) => log.erro('banco_erro_pool', e));
    const db = drizzlePg({ client: pool, schema });
    try {
      await migrarPg(db, { migrationsFolder });
    } catch (e) {
      await pool.end().catch(() => {});
      throw e;
    }
    return { db, tipo: 'postgres', fechar: () => pool.end() };
  }
  if (o.pastaPglite) mkdirSync(o.pastaPglite, { recursive: true });
  const cliente = o.pastaPglite ? new PGlite(o.pastaPglite) : new PGlite();
  const db = drizzlePglite({ client: cliente, schema });
  try {
    await migrarPglite(db, { migrationsFolder });
  } catch (e) {
    await cliente.close().catch(() => {});
    throw e;
  }
  return { db, tipo: 'pglite', fechar: () => cliente.close() };
}
