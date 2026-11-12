import { describe, expect, test } from 'vitest';
import { ErroGateway, gatewayInfinitePay } from '../src/pagamento/infinitepay';

function fetchFalso(resposta: { status?: number; json?: unknown } | (() => never)) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    if (typeof resposta === 'function') resposta();
    const r = resposta as { status?: number; json?: unknown };
    return new Response(JSON.stringify(r.json ?? null), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

const LINK = { orderNsu: 'ped-1', descricao: 'Bolso de Pila', centavos: 990, redirectUrl: 'https://t.test/loja/retorno', webhookUrl: 'https://t.test/api/loja/webhook/infinitepay' };

describe('gateway InfinitePay', () => {
  test('cria o link com handle, item em centavos, order_nsu e URLs', async () => {
    const { f, chamadas } = fetchFalso({ json: { url: 'https://checkout.infinitepay.io/x/abc' } });
    const g = gatewayInfinitePay({ handle: 'boteco', f });
    expect(await g.criarLink({ ...LINK, cliente: { nome: 'ana' } })).toEqual({ url: 'https://checkout.infinitepay.io/x/abc' });
    expect(chamadas[0].url).toBe('https://api.checkout.infinitepay.io/links');
    const corpo = JSON.parse(chamadas[0].init.body as string);
    expect(corpo).toEqual({
      handle: 'boteco',
      order_nsu: 'ped-1',
      redirect_url: LINK.redirectUrl,
      webhook_url: LINK.webhookUrl,
      items: [{ quantity: 1, price: 990, description: 'Bolso de Pila' }],
      customer: { name: 'ana' },
    });
    expect((chamadas[0].init.headers as Record<string, string>)['X-Api-Key']).toBeUndefined();
  });

  test('manda a API key no header quando existe', async () => {
    const { f, chamadas } = fetchFalso({ json: { url: 'https://checkout.infinitepay.io/x' } });
    await gatewayInfinitePay({ handle: 'boteco', apiKey: 'inchk_123', f }).criarLink(LINK);
    expect((chamadas[0].init.headers as Record<string, string>)['X-Api-Key']).toBe('inchk_123');
  });

  test('erro de status, resposta sem URL e falha de rede viram ErroGateway', async () => {
    await expect(gatewayInfinitePay({ handle: 'h', f: fetchFalso({ status: 403, json: { erro: 'x' } }).f }).criarLink(LINK)).rejects.toThrow(ErroGateway);
    await expect(gatewayInfinitePay({ handle: 'h', f: fetchFalso({ json: { ok: true } }).f }).criarLink(LINK)).rejects.toThrow(/URL/);
    const rede = fetchFalso(() => {
      throw new TypeError('fetch failed');
    });
    await expect(gatewayInfinitePay({ handle: 'h', f: rede.f }).criarLink(LINK)).rejects.toThrow(/sem resposta/);
  });

  test('payment_check: pago só com success e paid', async () => {
    const pago = fetchFalso({ json: { success: true, paid: true, amount: 990, paid_amount: 1000, capture_method: 'pix' } });
    const g = gatewayInfinitePay({ handle: 'boteco', f: pago.f });
    expect(await g.verificar({ orderNsu: 'ped-1', transactionNsu: 't1', slug: 's1' })).toEqual({ pago: true, centavos: 990, metodo: 'pix' });
    expect(pago.chamadas[0].url).toBe('https://api.checkout.infinitepay.io/payment_check');
    expect(JSON.parse(pago.chamadas[0].init.body as string)).toEqual({ handle: 'boteco', order_nsu: 'ped-1', transaction_nsu: 't1', slug: 's1' });
    const naoPago = gatewayInfinitePay({ handle: 'h', f: fetchFalso({ json: { success: false, paid: false } }).f });
    expect((await naoPago.verificar({ orderNsu: 'a', transactionNsu: 'b', slug: 'c' })).pago).toBe(false);
    const meio = gatewayInfinitePay({ handle: 'h', f: fetchFalso({ json: { success: true, paid: false, amount: 990 } }).f });
    expect((await meio.verificar({ orderNsu: 'a', transactionNsu: 'b', slug: 'c' })).pago).toBe(false);
  });
});
