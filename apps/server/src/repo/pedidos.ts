import { and, count, desc, eq, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Banco } from '../banco/banco';
import { pedidos, usuarios } from '../banco/schema';
import { pacotePorId } from '../loja/catalogo';
import type { GatewayPagamento } from '../pagamento/infinitepay';
import { movimentar } from './carteira';

export const LIMITE_PEDIDOS_HORA = 5;

export type Pedido = typeof pedidos.$inferSelect;

export async function criarPedido(db: Banco, usuarioId: number, pacoteId: unknown, agora: Date): Promise<Pedido | 'pacote' | 'limite'> {
  const pacote = pacotePorId(pacoteId);
  if (!pacote) return 'pacote';
  const desde = new Date(agora.getTime() - 60 * 60_000);
  const [{ n }] = await db
    .select({ n: count() })
    .from(pedidos)
    .where(and(eq(pedidos.usuarioId, usuarioId), gt(pedidos.criadoEm, desde)));
  if (n >= LIMITE_PEDIDOS_HORA) return 'limite';
  const [p] = await db
    .insert(pedidos)
    .values({ id: randomUUID(), usuarioId, pacoteId: pacote.id, valorCentavos: pacote.centavos, pila: pacote.pila, criadoEm: agora })
    .returning();
  return p;
}

export async function anexarCheckout(db: Banco, id: string, url: string): Promise<void> {
  await db.update(pedidos).set({ checkoutUrl: url }).where(eq(pedidos.id, id));
}

export type ResultadoConfirmacao = 'pago' | 'ja-pago' | 'nao-pago' | 'desconhecido';

export interface DadosRetorno {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}

const texto = (x: unknown, max = 200) => (typeof x === 'string' && x.length > 0 && x.length <= max ? x : null);

/** Campos que o webhook e o redirect trazem (nomes da InfinitePay); null se faltar algum. */
export function dadosDoRetorno(cru: Record<string, unknown> | null | undefined): DadosRetorno | null {
  if (!cru) return null;
  const orderNsu = texto(cru.order_nsu);
  const transactionNsu = texto(cru.transaction_nsu);
  const slug = texto(cru.invoice_slug) ?? texto(cru.slug);
  return orderNsu && transactionNsu && slug ? { orderNsu, transactionNsu, slug } : null;
}

/**
 * Webhook e redirect passam por aqui. O que chega do cliente/webhook só diz QUAL pedido
 * conferir; quem diz se foi pago é o `payment_check` da InfinitePay. Idempotente: o crédito
 * acontece no máximo uma vez por pedido (status) e por transação (unique).
 */
export async function confirmarPedido(db: Banco, gateway: GatewayPagamento, d: DadosRetorno, agora: Date): Promise<ResultadoConfirmacao> {
  const [p] = await db.select().from(pedidos).where(eq(pedidos.id, d.orderNsu));
  if (!p) return 'desconhecido';
  if (p.status !== 'criado') return 'ja-pago';
  const v = await gateway.verificar(d);
  if (!v.pago || v.centavos < p.valorCentavos) return 'nao-pago';
  try {
    return await db.transaction(async (tx) => {
      const [marcado] = await tx
        .update(pedidos)
        .set({ status: 'pago', slug: d.slug, transactionNsu: d.transactionNsu, captureMethod: v.metodo, pagoEm: agora })
        .where(and(eq(pedidos.id, p.id), eq(pedidos.status, 'criado')))
        .returning();
      if (!marcado) return 'ja-pago' as const;
      await movimentar(tx, p.usuarioId, 'pila', p.pila, 'compra_pila', p.id);
      return 'pago' as const;
    });
  } catch (e) {
    // A mesma transação da InfinitePay já pagou outro pedido: não credita de novo.
    const x = e as { code?: string; cause?: { code?: string } };
    if (x?.code === '23505' || x?.cause?.code === '23505') {
      console.error(`[loja] transação repetida em outro pedido (pedido ${p.id})`);
      return 'nao-pago';
    }
    throw e;
  }
}

export async function pedidoDe(db: Banco, id: string, usuarioId: number): Promise<Pedido | null> {
  const [p] = await db
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.id, id), eq(pedidos.usuarioId, usuarioId)));
  return p ?? null;
}

export async function pedidosAdmin(db: Banco, limite = 100) {
  return db
    .select({
      id: pedidos.id,
      usuarioId: pedidos.usuarioId,
      apelido: usuarios.apelido,
      pacoteId: pedidos.pacoteId,
      valorCentavos: pedidos.valorCentavos,
      pila: pedidos.pila,
      status: pedidos.status,
      captureMethod: pedidos.captureMethod,
      criadoEm: pedidos.criadoEm,
      pagoEm: pedidos.pagoEm,
    })
    .from(pedidos)
    .innerJoin(usuarios, eq(pedidos.usuarioId, usuarios.id))
    .orderBy(desc(pedidos.criadoEm))
    .limit(limite);
}
