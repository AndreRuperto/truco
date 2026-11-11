import { desc, eq, sql } from 'drizzle-orm';
import type { Banco } from '../banco/banco';
import { carteiras, lancamentos } from '../banco/schema';
import { bonusDoDia, diaSP, FICHAS_CADASTRO, type Moeda, type Motivo } from '../loja/regras';

/** O que `Banco` e uma transação têm em comum. */
export type Exec = Pick<Banco, 'select' | 'insert' | 'update' | 'delete'>;

export class SaldoInsuficiente extends Error {
  constructor(readonly moeda: Moeda) {
    super(`saldo de ${moeda} insuficiente`);
    this.name = 'SaldoInsuficiente';
  }
}

export interface Saldos {
  fichas: number;
  pila: number;
}

const coluna = (m: Moeda) => (m === 'fichas' ? carteiras.fichas : carteiras.pila);

/**
 * A ÚNICA escrita de saldo: soma `delta` à moeda (nunca abaixo de 0) e grava o lançamento.
 * Precisa rodar numa transação junto com o que motivou o movimento. Lança `SaldoInsuficiente`.
 */
export async function movimentar(tx: Exec, usuarioId: number, moeda: Moeda, delta: number, motivo: Motivo, ref: string | null = null): Promise<number> {
  if (!Number.isInteger(delta)) throw new Error('delta precisa ser inteiro');
  await tx.insert(carteiras).values({ usuarioId }).onConflictDoNothing();
  const col = coluna(moeda);
  if (delta === 0) {
    const [r] = await tx.select({ v: col }).from(carteiras).where(eq(carteiras.usuarioId, usuarioId));
    return r.v;
  }
  const [r] = await tx
    .update(carteiras)
    .set(moeda === 'fichas' ? { fichas: sql`${carteiras.fichas} + ${delta}` } : { pila: sql`${carteiras.pila} + ${delta}` })
    .where(sql`${carteiras.usuarioId} = ${usuarioId} and ${col} + ${delta} >= 0`)
    .returning({ v: col });
  if (!r) throw new SaldoInsuficiente(moeda);
  await tx.insert(lancamentos).values({ usuarioId, moeda, delta, saldoDepois: r.v, motivo, ref });
  return r.v;
}

/** Saldos sem aplicar bônus (para quem só precisa ler, ex.: entrar numa mesa). */
export async function saldosDe(db: Exec, usuarioId: number): Promise<Saldos> {
  const [r] = await db.select({ fichas: carteiras.fichas, pila: carteiras.pila }).from(carteiras).where(eq(carteiras.usuarioId, usuarioId));
  return r ?? { fichas: 0, pila: 0 };
}

export interface CarteiraLida extends Saldos {
  /** Bônus aplicados nesta leitura (para o aviso na tela). */
  bonus: { motivo: Motivo; delta: number }[];
}

/** Lê a carteira aplicando o bônus de cadastro (uma vez) e o do dia. */
export async function carteiraDe(db: Banco, usuarioId: number, agora: Date): Promise<CarteiraLida> {
  return db.transaction(async (tx) => {
    await tx.insert(carteiras).values({ usuarioId }).onConflictDoNothing();
    // FOR UPDATE: duas abas abrindo juntas não ganham o bônus duas vezes.
    const [c] = await tx.select().from(carteiras).where(eq(carteiras.usuarioId, usuarioId)).for('update');
    const bonus: CarteiraLida['bonus'] = [];
    let fichas = c.fichas;
    if (!c.bonusCadastro) {
      fichas = await movimentar(tx, usuarioId, 'fichas', FICHAS_CADASTRO, 'cadastro');
      await tx.update(carteiras).set({ bonusCadastro: true }).where(eq(carteiras.usuarioId, usuarioId));
      bonus.push({ motivo: 'cadastro', delta: FICHAS_CADASTRO });
    }
    const hoje = diaSP(agora);
    const b = bonusDoDia(fichas, c.ultimoDiario, hoje);
    if (b) {
      fichas = await movimentar(tx, usuarioId, 'fichas', b.delta, b.motivo, hoje);
      await tx.update(carteiras).set({ ultimoDiario: hoje }).where(eq(carteiras.usuarioId, usuarioId));
      bonus.push(b);
    }
    return { fichas, pila: c.pila, bonus };
  });
}

export async function extrato(db: Banco, usuarioId: number, limite = 30) {
  return db
    .select({
      id: lancamentos.id,
      moeda: lancamentos.moeda,
      delta: lancamentos.delta,
      saldoDepois: lancamentos.saldoDepois,
      motivo: lancamentos.motivo,
      ref: lancamentos.ref,
      criadoEm: lancamentos.criadoEm,
    })
    .from(lancamentos)
    .where(eq(lancamentos.usuarioId, usuarioId))
    .orderBy(desc(lancamentos.id))
    .limit(limite);
}
