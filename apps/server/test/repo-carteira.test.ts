import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { carteiras, lancamentos, usuarios } from '../src/banco/schema';
import { FICHAS_CADASTRO } from '../src/loja/regras';
import { carteiraDe, extrato, movimentar, SaldoInsuficiente } from '../src/repo/carteira';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

const dia = (iso: string) => new Date(`${iso}T15:00:00Z`);
async function novo(apelido = 'Ana'): Promise<number> {
  const [u] = await b.db.insert(usuarios).values({ apelido }).returning();
  return u.id;
}
async function somaLancamentos(id: number, moeda: 'fichas' | 'pila'): Promise<number> {
  const [r] = await b.db
    .select({ s: sql<number>`coalesce(sum(${lancamentos.delta}), 0)::int` })
    .from(lancamentos)
    .where(sql`${lancamentos.usuarioId} = ${id} and ${lancamentos.moeda} = ${moeda}`);
  return r.s;
}

describe('carteira', () => {
  test('bônus de cadastro uma vez só, e o diário no mesmo dia não repete', async () => {
    const id = await novo();
    const a = await carteiraDe(b.db, id, dia('2026-11-11'));
    expect(a.fichas).toBe(FICHAS_CADASTRO + 100);
    expect(a.bonus.map((x) => x.motivo)).toEqual(['cadastro', 'diario']);
    const c = await carteiraDe(b.db, id, dia('2026-11-11'));
    expect(c.fichas).toBe(FICHAS_CADASTRO + 100);
    expect(c.bonus).toEqual([]);
    const d = await carteiraDe(b.db, id, dia('2026-11-12'));
    expect(d.fichas).toBe(FICHAS_CADASTRO + 200);
    expect(d.bonus).toEqual([{ motivo: 'diario', delta: 100 }]);
  });

  test('resgate leva o saldo baixo para 500', async () => {
    const id = await novo();
    await carteiraDe(b.db, id, dia('2026-11-11'));
    await b.db.transaction((tx) => movimentar(tx, id, 'fichas', -1070, 'cacife', 'p1'));
    const c = await carteiraDe(b.db, id, dia('2026-11-12'));
    expect(c.fichas).toBe(500);
    expect(c.bonus).toEqual([{ motivo: 'resgate', delta: 470 }]);
  });

  test('débito maior que o saldo lança erro e não grava nada', async () => {
    const id = await novo();
    await carteiraDe(b.db, id, dia('2026-11-11'));
    const antes = (await extrato(b.db, id)).length;
    const erro = await b.db.transaction((tx) => movimentar(tx, id, 'pila', -1, 'compra_item', 'x')).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(SaldoInsuficiente);
    expect((await extrato(b.db, id)).length).toBe(antes);
    const [w] = await b.db.select().from(carteiras).where(eq(carteiras.usuarioId, id));
    expect(w.pila).toBe(0);
  });

  test('dois débitos concorrentes não gastam duas vezes', async () => {
    const id = await novo();
    await carteiraDe(b.db, id, dia('2026-11-11'));
    const r = await Promise.allSettled([
      b.db.transaction((tx) => movimentar(tx, id, 'fichas', -600, 'compra_item', 'a')),
      b.db.transaction((tx) => movimentar(tx, id, 'fichas', -600, 'compra_item', 'b')),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const [w] = await b.db.select().from(carteiras).where(eq(carteiras.usuarioId, id));
    expect(w.fichas).toBe(500);
  });

  test('extrato tem o saldo depois de cada lançamento e soma o saldo', async () => {
    const id = await novo();
    await carteiraDe(b.db, id, dia('2026-11-11'));
    await b.db.transaction((tx) => movimentar(tx, id, 'fichas', -100, 'cacife', 'p1'));
    await b.db.transaction((tx) => movimentar(tx, id, 'pila', 220, 'compra_pila', 'ped'));
    await b.db.transaction((tx) => movimentar(tx, id, 'fichas', 0, 'premio', 'p1'));
    const e = await extrato(b.db, id);
    expect(e[0]).toMatchObject({ moeda: 'pila', delta: 220, saldoDepois: 220, motivo: 'compra_pila' });
    expect(e[1]).toMatchObject({ moeda: 'fichas', delta: -100, saldoDepois: 1000, motivo: 'cacife' });
    expect(e).toHaveLength(4);
    const [w] = await b.db.select().from(carteiras).where(eq(carteiras.usuarioId, id));
    expect(await somaLancamentos(id, 'fichas')).toBe(w.fichas);
    expect(await somaLancamentos(id, 'pila')).toBe(w.pila);
  });
});
