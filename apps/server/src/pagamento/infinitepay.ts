/*
 * Checkout Integrado da InfinitePay (https://www.infinitepay.io/checkout-documentacao).
 * - Criar link: POST /links (handle ou X-Api-Key; preço em centavos).
 * - O webhook NÃO tem assinatura: nunca confiar no corpo dele; confirmar sempre por /payment_check.
 * - Não há sandbox: o teste real é uma compra pequena com estorno pelo app.
 */

export const API_INFINITEPAY = 'https://api.checkout.infinitepay.io';

export interface PedidoLink {
  orderNsu: string;
  descricao: string;
  centavos: number;
  redirectUrl: string;
  webhookUrl: string;
  cliente?: { nome?: string; email?: string };
}

export interface VerificacaoPagamento {
  pago: boolean;
  /** Valor original em centavos (`amount`). */
  centavos: number;
  metodo: string | null;
}

export interface GatewayPagamento {
  criarLink(p: PedidoLink): Promise<{ url: string }>;
  verificar(p: { orderNsu: string; transactionNsu: string; slug: string }): Promise<VerificacaoPagamento>;
}

export class ErroGateway extends Error {
  constructor(
    mensagem: string,
    readonly status: number | null = null,
  ) {
    super(mensagem);
    this.name = 'ErroGateway';
  }
}

export interface OpcoesInfinitePay {
  handle: string;
  apiKey?: string | null;
  f?: typeof fetch;
  timeoutMs?: number;
  base?: string;
}

export function gatewayInfinitePay(o: OpcoesInfinitePay): GatewayPagamento {
  const f = o.f ?? ((...a) => fetch(...a));
  const base = o.base ?? API_INFINITEPAY;
  const timeoutMs = o.timeoutMs ?? 5000;

  async function post(caminho: string, corpo: unknown): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (o.apiKey) headers['X-Api-Key'] = o.apiKey;
    let r: Response;
    try {
      r = await f(`${base}${caminho}`, { method: 'POST', headers, body: JSON.stringify(corpo), signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      throw new ErroGateway(`InfinitePay sem resposta em ${caminho}: ${(e as Error).name}`);
    }
    const dados = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    // Sem dados do cliente no erro (vão para o log).
    if (!r.ok || !dados) throw new ErroGateway(`InfinitePay respondeu ${r.status} em ${caminho}`, r.status);
    return dados;
  }

  return {
    async criarLink(p) {
      const corpo: Record<string, unknown> = {
        handle: o.handle,
        order_nsu: p.orderNsu,
        redirect_url: p.redirectUrl,
        webhook_url: p.webhookUrl,
        items: [{ quantity: 1, price: p.centavos, description: p.descricao }],
      };
      const cliente = { name: p.cliente?.nome, email: p.cliente?.email };
      if (cliente.name || cliente.email) corpo.customer = cliente;
      const d = await post('/links', corpo);
      const url = typeof d.url === 'string' ? d.url : typeof d.link === 'string' ? d.link : null;
      if (!url || !/^https:\/\//.test(url)) throw new ErroGateway('InfinitePay não devolveu a URL do checkout');
      return { url };
    },
    async verificar(p) {
      const d = await post('/payment_check', { handle: o.handle, order_nsu: p.orderNsu, transaction_nsu: p.transactionNsu, slug: p.slug });
      return {
        pago: d.success === true && d.paid === true,
        centavos: typeof d.amount === 'number' ? d.amount : 0,
        metodo: typeof d.capture_method === 'string' ? d.capture_method : null,
      };
    },
  };
}

/** Gateway falso para testes e para desenvolvimento local (`LOJA_PAGAMENTO=teste`). */
export class GatewayDeTeste implements GatewayPagamento {
  readonly links: PedidoLink[] = [];
  /** `transactionNsu` → resultado do payment_check. */
  readonly pagamentos = new Map<string, VerificacaoPagamento>();
  verificacoes = 0;
  falharVerificacao = false;

  async criarLink(p: PedidoLink) {
    this.links.push(p);
    return { url: `https://checkout.teste/${p.orderNsu}` };
  }

  /** Simula o comprador pagando: o próximo payment_check desta transação diz `paid`. */
  pagar(transactionNsu: string, centavos: number, metodo = 'pix'): void {
    this.pagamentos.set(transactionNsu, { pago: true, centavos, metodo });
  }

  async verificar(p: { orderNsu: string; transactionNsu: string; slug: string }) {
    this.verificacoes++;
    if (this.falharVerificacao) throw new ErroGateway('falha simulada');
    return this.pagamentos.get(p.transactionNsu) ?? { pago: false, centavos: 0, metodo: null };
  }
}
