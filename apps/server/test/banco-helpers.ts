import { sql } from 'drizzle-orm';
import { abrirBanco, type ConexaoBanco } from '../src/banco/banco';

export type BancoDeTeste = ConexaoBanco & { limpar(): Promise<void> };

/** PGlite em memória já migrado. Um por arquivo de teste (subir leva ~2 s). */
export async function bancoDeTeste(): Promise<BancoDeTeste> {
  const c = await abrirBanco();
  return {
    ...c,
    limpar: async () => {
      await c.db.execute(
        sql`TRUNCATE usuarios, sessoes, links_magicos, ratings, partidas, participacoes, bloqueios_fila, carteiras, lancamentos, inventario, pedidos RESTART IDENTITY CASCADE`,
      );
    },
  };
}

export function ehViolacaoUnica(e: unknown): boolean {
  const x = e as { code?: string; cause?: { code?: string } } | null;
  return x?.code === '23505' || x?.cause?.code === '23505';
}
