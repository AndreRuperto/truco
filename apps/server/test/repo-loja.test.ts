import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { usuarios } from '../src/banco/schema';
import { itemPorId } from '../src/loja/catalogo';
import { carteiraDe, movimentar, saldosDe } from '../src/repo/carteira';
import { comprarItem, equipadosDe, equipar, inventarioDe, visualDe } from '../src/repo/loja';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

async function jogador(fichas: number, pila: number): Promise<number> {
  const [u] = await b.db.insert(usuarios).values({ apelido: `J${Math.random().toString(36).slice(2, 8)}` }).returning();
  await carteiraDe(b.db, u.id, new Date('2026-11-11T15:00:00Z'));
  const s = await saldosDe(b.db, u.id);
  await b.db.transaction(async (tx) => {
    await movimentar(tx, u.id, 'fichas', fichas - s.fichas, 'ajuste_admin');
    await movimentar(tx, u.id, 'pila', pila, 'ajuste_admin');
  });
  return u.id;
}

describe('loja: comprar', () => {
  test('compra com Pila só mexe no Pila; com Fichas, só nas Fichas', async () => {
    const id = await jogador(4000, 300);
    expect(await comprarItem(b.db, id, 'verso-azulejo')).toBe('ok');
    expect(await saldosDe(b.db, id)).toEqual({ fichas: 4000, pila: 100 });
    expect(await comprarItem(b.db, id, 'moldura-giz')).toBe('ok');
    expect(await saldosDe(b.db, id)).toEqual({ fichas: 1000, pila: 100 });
    expect((await inventarioDe(b.db, id)).sort()).toEqual(['moldura-giz', 'verso-azulejo']);
  });

  test('sem saldo não entra no inventário; repetido e inexistente são recusados', async () => {
    const id = await jogador(1000, 50);
    expect(await comprarItem(b.db, id, 'verso-chita')).toBe('saldo');
    expect(await comprarItem(b.db, id, 'roupa-campeao')).toBe('saldo');
    expect(await inventarioDe(b.db, id)).toEqual([]);
    expect(await saldosDe(b.db, id)).toEqual({ fichas: 1000, pila: 50 });
    expect(await comprarItem(b.db, id, 'moldura-corda')).toBe('saldo');
    await b.db.transaction((tx) => movimentar(tx, id, 'pila', 100, 'ajuste_admin'));
    expect(await comprarItem(b.db, id, 'moldura-corda')).toBe('ok');
    expect(await comprarItem(b.db, id, 'moldura-corda')).toBe('ja-tem');
    expect(await saldosDe(b.db, id)).toEqual({ fichas: 1000, pila: 70 });
    expect(await comprarItem(b.db, id, 'x')).toBe('inexistente');
    expect(await comprarItem(b.db, id, 'verso-classico')).toBe('gratis');
  });

  test('duas compras do mesmo item ao mesmo tempo cobram uma vez', async () => {
    const id = await jogador(1000, 500);
    const r = await Promise.all([comprarItem(b.db, id, 'verso-boteco'), comprarItem(b.db, id, 'verso-boteco')]);
    expect(r.sort()).toEqual(['ja-tem', 'ok']);
    expect((await saldosDe(b.db, id)).pila).toBe(380);
  });
});

describe('loja: equipar e visual', () => {
  test('só equipa o que tem (ou de série), no slot certo', async () => {
    const id = await jogador(1000, 1000);
    expect(await equipar(b.db, id, 'verso', 'verso-chita')).toBe('nao-tem');
    expect(await equipar(b.db, id, 'verso', 'moldura-corda')).toBe('invalido');
    expect(await equipar(b.db, id, 'nada', 'verso-chita')).toBe('invalido');
    await comprarItem(b.db, id, 'verso-chita');
    await comprarItem(b.db, id, 'roupa-terno');
    await comprarItem(b.db, id, 'moldura-neon');
    expect(await equipar(b.db, id, 'verso', 'verso-chita')).toBe('ok');
    expect(await equipar(b.db, id, 'roupa', 'roupa-terno')).toBe('ok');
    expect(await equipar(b.db, id, 'moldura', 'moldura-neon')).toBe('ok');
    expect(await equipar(b.db, id, 'tampo', 'tampo-feltro')).toBe('ok');
    expect(await equipadosDe(b.db, id)).toEqual({ verso: 'verso-chita', roupa: 'roupa-terno', moldura: 'moldura-neon', tampo: 'tampo-feltro' });
    const v = (await visualDe(b.db, [id])).get(id)!;
    expect(v.verso).toEqual(itemPorId('verso-chita')!.visual);
    expect(v.roupa).toEqual(itemPorId('roupa-terno')!.visual);
    expect(v.moldura).toBe('neon');
    expect(await equipar(b.db, id, 'verso', null)).toBe('ok');
    expect((await visualDe(b.db, [id])).get(id)!.verso).toEqual(itemPorId('verso-classico')!.visual);
  });

  test('Floreios: só equipa depois de comprar; equipado entra em equipados.habilidade', async () => {
    const id = await jogador(6000, 0);
    expect(await equipar(b.db, id, 'habilidade', 'habilidade-floreios')).toBe('nao-tem');
    await comprarItem(b.db, id, 'habilidade-floreios');
    expect(await equipar(b.db, id, 'habilidade', 'habilidade-floreios')).toBe('ok');
    expect((await equipadosDe(b.db, id)).habilidade).toBe('habilidade-floreios');
    expect(await equipar(b.db, id, 'habilidade', null)).toBe('ok');
    expect((await equipadosDe(b.db, id)).habilidade).toBeUndefined();
  });

  test('avatar da loja vai para usuarios.avatar', async () => {
    const id = await jogador(1000, 200);
    expect(await equipar(b.db, id, 'avatar', 'avatar-violeiro')).toBe('nao-tem');
    await comprarItem(b.db, id, 'avatar-violeiro');
    expect(await equipar(b.db, id, 'avatar', 'avatar-violeiro')).toBe('ok');
    const [u] = await b.db.select().from(usuarios).where(eq(usuarios.id, id));
    expect(u.avatar).toBe('loja:avatar-violeiro');
  });
});
