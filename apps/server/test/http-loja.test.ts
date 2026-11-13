import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, test } from 'vitest';
import { extrairLink } from '../src/auth/emails';
import { LimiteTaxa } from '../src/auth/limite';
import { GatewayDeTeste } from '../src/pagamento/infinitepay';
import { type Servicos, servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';
import { cookieDe, subirApp, tokenDoLink } from './http-helpers';

let b: BancoDeTeste;
let s: Servicos;
let gateway: GatewayDeTeste;
let app: Awaited<ReturnType<typeof subirApp>>;

const AGORA = new Date('2026-11-11T15:00:00Z');

beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
async function subir(extra: Partial<Servicos> = {}) {
  s = servicosDeTeste(b.db, { admins: ['chefe@x.com'], agora: () => AGORA, pagamento: { gateway }, ...extra });
  app = await subirApp(s, { limiteLinkIp: new LimiteTaxa(100, 60_000), limiteLinkEmail: new LimiteTaxa(100, 60_000) });
}
beforeEach(async () => {
  await b.limpar();
  gateway = new GatewayDeTeste();
  await subir();
});
afterEach(() => app.fechar());
afterAll(() => b.fechar());

async function cookieDeQuem(email: string) {
  await app.pedir('/api/auth/link', { corpo: { email } });
  const link = extrairLink(s.caixaTeste!.enviados.at(-1)!.texto)!;
  return cookieDe((await app.pedir('/api/auth/link/confirmar', { corpo: { token: tokenDoLink(link) } })).setCookie);
}

describe('loja (HTTP)', () => {
  test('catálogo é público; carteira exige login e aplica cadastro + diário', async () => {
    const cat = await app.pedir('/api/loja/catalogo');
    expect(cat.status).toBe(200);
    expect(cat.json.pagamentoAtivo).toBe(true);
    expect(cat.json.itens.length).toBeGreaterThan(10);
    expect(cat.json.pacotes.map((p: { id: string }) => p.id)).toEqual(['punhado', 'bolso', 'carteira', 'cofre']);
    expect((await app.pedir('/api/loja/eu')).status).toBe(401);
    const cookie = await cookieDeQuem('ana@x.com');
    const eu = await app.pedir('/api/loja/eu', { cookie });
    expect(eu.json).toMatchObject({ fichas: 1100, pila: 0, inventario: [], equipados: {} });
    expect(eu.json.bonus.map((x: { motivo: string }) => x.motivo)).toEqual(['cadastro', 'diario']);
    expect((await app.pedir('/api/loja/eu', { cookie })).json.bonus).toEqual([]);
  });

  test('comprar e equipar; erros com mensagem', async () => {
    const cookie = await cookieDeQuem('ana@x.com');
    await app.pedir('/api/loja/eu', { cookie });
    expect((await app.pedir('/api/loja/comprar-item', { cookie, corpo: { itemId: 'verso-chita' } })).status).toBe(402);
    expect((await app.pedir('/api/loja/comprar-item', { cookie, corpo: { itemId: 'xyz' } })).status).toBe(404);
    expect((await app.pedir('/api/loja/equipar', { cookie, metodo: 'PUT', corpo: { slot: 'verso', itemId: 'verso-chita' } })).status).toBe(403);
    expect((await app.pedir('/api/loja/equipar', { cookie, metodo: 'PUT', corpo: { slot: 'tampo', itemId: 'tampo-feltro' } })).status).toBe(204);
    expect((await app.pedir('/api/loja/eu', { cookie })).json.equipados).toEqual({ tampo: 'tampo-feltro' });
  });

  test('pedido de Pila: checkout, retorno confirma pelo payment_check e credita uma vez', async () => {
    const cookie = await cookieDeQuem('ana@x.com');
    const r = await app.pedir('/api/loja/pedidos', { cookie, corpo: { pacoteId: 'bolso' } });
    expect(r.status).toBe(200);
    expect(r.json.url).toMatch(/^https:\/\//);
    const id = r.json.pedido.id as string;
    const link = gateway.links[0];
    expect(link).toMatchObject({ orderNsu: id, centavos: 990, redirectUrl: 'http://truco.test/api/loja/retorno', webhookUrl: 'http://truco.test/api/loja/webhook/infinitepay' });

    // Webhook forjado (sem pagamento de verdade): o payment_check diz que não pagou.
    const forjado = await app.pedir('/api/loja/webhook/infinitepay', { corpo: { order_nsu: id, transaction_nsu: 'tx-1', invoice_slug: 's', paid_amount: 990 } });
    expect(forjado.status).toBe(200);
    expect((await app.pedir(`/api/loja/pedidos/${id}`, { cookie })).json.pedido.status).toBe('criado');

    gateway.pagar('tx-1', 990);
    const volta = await fetch(`${app.base}/api/loja/retorno?order_nsu=${id}&transaction_nsu=tx-1&slug=s&capture_method=pix`, { redirect: 'manual' });
    expect(volta.status).toBe(302);
    expect(volta.headers.get('location')).toBe(`/#/loja/obrigado?pedido=${id}`);
    await app.pedir('/api/loja/webhook/infinitepay', { corpo: { order_nsu: id, transaction_nsu: 'tx-1', invoice_slug: 's' } });
    expect((await app.pedir(`/api/loja/pedidos/${id}`, { cookie })).json.pedido.status).toBe('pago');
    expect((await app.pedir('/api/loja/eu', { cookie })).json.pila).toBe(220);
    // Outro usuário não vê o pedido.
    const outro = await cookieDeQuem('bia@x.com');
    expect((await app.pedir(`/api/loja/pedidos/${id}`, { cookie: outro })).status).toBe(404);
  });

  test('webhook: pedido desconhecido responde 200, corpo incompleto 400, falha do payment_check 500', async () => {
    expect((await app.pedir('/api/loja/webhook/infinitepay', { corpo: { order_nsu: 'nao-existe', transaction_nsu: 't', invoice_slug: 's' } })).status).toBe(200);
    expect((await app.pedir('/api/loja/webhook/infinitepay', { corpo: { order_nsu: 'x' } })).status).toBe(400);
    const cookie = await cookieDeQuem('ana@x.com');
    const id = (await app.pedir('/api/loja/pedidos', { cookie, corpo: { pacoteId: 'punhado' } })).json.pedido.id;
    gateway.falharVerificacao = true;
    expect((await app.pedir('/api/loja/webhook/infinitepay', { corpo: { order_nsu: id, transaction_nsu: 't', invoice_slug: 's' } })).status).toBe(500);
  });

  test('compra de Pila desligada: catálogo avisa e o pedido é 503', async () => {
    await app.fechar();
    await subir({ pagamento: null });
    expect((await app.pedir('/api/loja/catalogo')).json.pagamentoAtivo).toBe(false);
    const cookie = await cookieDeQuem('ana@x.com');
    expect((await app.pedir('/api/loja/pedidos', { cookie, corpo: { pacoteId: 'bolso' } })).status).toBe(503);
  });

  test('admin: lista pedidos e ajusta saldo com motivo; não admin é barrado', async () => {
    const ana = await cookieDeQuem('ana@x.com');
    const anaId = (await app.pedir('/api/eu', { cookie: ana })).json.usuario.id;
    await app.pedir('/api/loja/pedidos', { cookie: ana, corpo: { pacoteId: 'cofre' } });
    expect((await app.pedir(`/api/admin/usuarios/${anaId}/ajuste`, { cookie: ana, corpo: { moeda: 'pila', delta: 9999, motivo: 'eu mesmo' } })).status).toBe(403);
    const chefe = await cookieDeQuem('chefe@x.com');
    const ps = await app.pedir('/api/admin/pedidos', { cookie: chefe });
    expect(ps.json.pedidos).toHaveLength(1);
    expect(ps.json.pedidos[0]).toMatchObject({ apelido: 'ana', pacoteId: 'cofre', status: 'criado' });
    expect((await app.pedir(`/api/admin/usuarios/${anaId}/ajuste`, { cookie: chefe, corpo: { moeda: 'pila', delta: 50 } })).status).toBe(400);
    expect((await app.pedir(`/api/admin/usuarios/${anaId}/ajuste`, { cookie: chefe, corpo: { moeda: 'pila', delta: -1, motivo: 'estorno' } })).status).toBe(409);
    const ok = await app.pedir(`/api/admin/usuarios/${anaId}/ajuste`, { cookie: chefe, corpo: { moeda: 'fichas', delta: 5000, motivo: 'teste E2E' } });
    expect(ok.json).toEqual({ saldo: 5000 });
  });

  test('admin marca estornado (F4.8): tira o Pila uma vez; repetir é 409; não pago é 409; não admin 403', async () => {
    const ana = await cookieDeQuem('ana@x.com');
    const id = (await app.pedir('/api/loja/pedidos', { cookie: ana, corpo: { pacoteId: 'bolso' } })).json.pedido.id as string;
    gateway.pagar('tx-est', 990);
    await app.pedir('/api/loja/webhook/infinitepay', { corpo: { order_nsu: id, transaction_nsu: 'tx-est', invoice_slug: 's' } });
    expect((await app.pedir('/api/loja/eu', { cookie: ana })).json.pila).toBe(220);
    expect((await app.pedir(`/api/admin/pedidos/${id}/estorno`, { cookie: ana, corpo: {} })).status).toBe(403);
    const chefe = await cookieDeQuem('chefe@x.com');
    const r = await app.pedir(`/api/admin/pedidos/${id}/estorno`, { cookie: chefe, corpo: {} });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ resultado: 'estornado', debitado: 220, faltou: 0 });
    expect((await app.pedir('/api/loja/eu', { cookie: ana })).json.pila).toBe(0);
    expect((await app.pedir(`/api/admin/pedidos/${id}/estorno`, { cookie: chefe, corpo: {} })).status).toBe(409);
    const naoPago = (await app.pedir('/api/loja/pedidos', { cookie: ana, corpo: { pacoteId: 'bolso' } })).json.pedido.id as string;
    expect((await app.pedir(`/api/admin/pedidos/${naoPago}/estorno`, { cookie: chefe, corpo: {} })).status).toBe(409);
    expect((await app.pedir('/api/admin/pedidos/nao-existe/estorno', { cookie: chefe, corpo: {} })).status).toBe(404);
  });
});
