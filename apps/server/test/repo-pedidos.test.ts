import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { usuarios } from '../src/banco/schema';
import { GatewayDeTeste } from '../src/pagamento/infinitepay';
import { saldosDe } from '../src/repo/carteira';
import { confirmarPedido, criarPedido, dadosDoRetorno, type Pedido, pedidoDe } from '../src/repo/pedidos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

const T0 = new Date('2026-11-11T15:00:00Z');
async function novo(): Promise<number> {
  const [u] = await b.db.insert(usuarios).values({ apelido: `u${Math.random().toString(36).slice(2, 7)}` }).returning();
  return u.id;
}
const retorno = (p: Pedido, t = 'tx-1') => ({ orderNsu: p.id, transactionNsu: t, slug: 'slug-1' });

describe('pedidos de Pila', () => {
  test('pago credita uma vez; confirmar de novo (webhook + redirect) não credita outra', async () => {
    const id = await novo();
    const g = new GatewayDeTeste();
    const p = (await criarPedido(b.db, id, 'bolso', T0)) as Pedido;
    expect(p).toMatchObject({ valorCentavos: 990, pila: 220, status: 'criado' });
    expect(await confirmarPedido(b.db, g, retorno(p), T0)).toBe('nao-pago');
    g.pagar('tx-1', 990);
    const r = await Promise.all([confirmarPedido(b.db, g, retorno(p), T0), confirmarPedido(b.db, g, retorno(p), T0)]);
    expect(r.sort()).toEqual(['ja-pago', 'pago']);
    expect(await confirmarPedido(b.db, g, retorno(p), T0)).toBe('ja-pago');
    expect((await saldosDe(b.db, id)).pila).toBe(220);
    expect(await pedidoDe(b.db, p.id, id)).toMatchObject({ status: 'pago', transactionNsu: 'tx-1', captureMethod: 'pix' });
  });

  test('valor menor que o do pedido não credita; pedido de outro dono não aparece', async () => {
    const id = await novo();
    const g = new GatewayDeTeste();
    const p = (await criarPedido(b.db, id, 'cofre', T0)) as Pedido;
    g.pagar('tx-9', 100);
    expect(await confirmarPedido(b.db, g, retorno(p, 'tx-9'), T0)).toBe('nao-pago');
    expect((await saldosDe(b.db, id)).pila).toBe(0);
    expect(await pedidoDe(b.db, p.id, id + 999)).toBeNull();
  });

  test('a mesma transação não paga dois pedidos', async () => {
    const id = await novo();
    const g = new GatewayDeTeste();
    const a = (await criarPedido(b.db, id, 'punhado', T0)) as Pedido;
    const c = (await criarPedido(b.db, id, 'punhado', T0)) as Pedido;
    g.pagar('tx-x', 490);
    expect(await confirmarPedido(b.db, g, retorno(a, 'tx-x'), T0)).toBe('pago');
    expect(await confirmarPedido(b.db, g, retorno(c, 'tx-x'), T0)).toBe('nao-pago');
    expect((await saldosDe(b.db, id)).pila).toBe(100);
  });

  test('pedido desconhecido, pacote inválido e limite por hora', async () => {
    const id = await novo();
    const g = new GatewayDeTeste();
    expect(await confirmarPedido(b.db, g, { orderNsu: 'nada', transactionNsu: 't', slug: 's' }, T0)).toBe('desconhecido');
    expect(g.verificacoes).toBe(0);
    expect(await criarPedido(b.db, id, 'diamante', T0)).toBe('pacote');
    for (let i = 0; i < 5; i++) expect(typeof (await criarPedido(b.db, id, 'punhado', T0))).toBe('object');
    expect(await criarPedido(b.db, id, 'punhado', T0)).toBe('limite');
    expect(typeof (await criarPedido(b.db, id, 'punhado', new Date(T0.getTime() + 61 * 60_000)))).toBe('object');
  });

  test('dadosDoRetorno aceita invoice_slug (webhook) ou slug (redirect)', () => {
    expect(dadosDoRetorno({ order_nsu: 'a', transaction_nsu: 'b', invoice_slug: 'c' })).toEqual({ orderNsu: 'a', transactionNsu: 'b', slug: 'c' });
    expect(dadosDoRetorno({ order_nsu: 'a', transaction_nsu: 'b', slug: 'c' })).toEqual({ orderNsu: 'a', transactionNsu: 'b', slug: 'c' });
    expect(dadosDoRetorno({ order_nsu: 'a' })).toBeNull();
    expect(dadosDoRetorno({ order_nsu: 1, transaction_nsu: 'b', slug: 'c' })).toBeNull();
    expect(dadosDoRetorno(null)).toBeNull();
  });
});
