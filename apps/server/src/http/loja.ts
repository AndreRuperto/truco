import type { Request, Response, Router } from 'express';
import type { CarteiraApi, CatalogoApi, PedidoAdmin, PedidoApi } from '../api/tipos';
import { chaveDeIp, LimiteTaxa } from '../auth/limite';
import { registrarAuditoria } from '../repo/auditoria';
import { ITENS, PACOTES, pacotePorId } from '../loja/catalogo';
import { MOEDAS, type Moeda } from '../loja/regras';
import { carteiraDe, extrato, movimentar, SaldoInsuficiente } from '../repo/carteira';
import { comprarItem, equipadosDe, equipar, inventarioDe } from '../repo/loja';
import { anexarCheckout, confirmarPedido, criarPedido, dadosDoRetorno, estornarPedido, type Pedido, pedidoDe, pedidosAdmin } from '../repo/pedidos';
import { type Usuario, usuarioPorId } from '../repo/usuarios';
import type { Servicos } from '../servicos';
import { log } from '../log';

const paraPedidoApi = (p: Pedido): PedidoApi => ({ id: p.id, pacoteId: p.pacoteId, pila: p.pila, valorCentavos: p.valorCentavos, status: p.status });

const ERROS_COMPRA = {
  inexistente: [404, 'item não existe'],
  gratis: [400, 'esse item é de graça: é só equipar'],
  'ja-tem': [409, 'você já tem esse item'],
  saldo: [402, 'saldo insuficiente'],
} as const;

export interface DepsLoja {
  s: Servicos;
  usuarioDe: (req: Request) => Promise<Usuario | null>;
  /** Base pública para montar as URLs de retorno e de webhook. */
  origem: (req: Request) => string;
  limiteWebhook?: LimiteTaxa;
}

/** Rotas da loja em `/api/loja/*`. */
export function rotasLoja(api: Router, d: DepsLoja): void {
  const { s, usuarioDe } = d;
  const limiteWebhook = d.limiteWebhook ?? new LimiteTaxa(60, 60_000);
  const logado = async (req: Request, res: Response): Promise<Usuario | null> => {
    const u = await usuarioDe(req);
    if (!u) res.status(401).json({ erro: 'entre na sua conta' });
    return u;
  };

  api.get('/loja/catalogo', (_req, res) => {
    const c: CatalogoApi = { itens: [...ITENS], pacotes: [...PACOTES], pagamentoAtivo: !!s.pagamento };
    res.json(c);
  });

  api.get('/loja/eu', async (req, res) => {
    const u = await logado(req, res);
    if (!u) return;
    const c = await carteiraDe(s.banco, u.id, s.agora());
    const [inv, eq, ext, conta] = await Promise.all([inventarioDe(s.banco, u.id), equipadosDe(s.banco, u.id), extrato(s.banco, u.id), usuarioPorId(s.banco, u.id)]);
    const r: CarteiraApi = {
      fichas: c.fichas,
      pila: c.pila,
      inventario: inv,
      equipados: eq,
      avatar: conta?.avatar ?? null,
      bonus: c.bonus,
      extrato: ext.map((x) => ({ ...x, criadoEm: x.criadoEm.toISOString() })),
    };
    res.json(r);
  });

  api.post('/loja/comprar-item', async (req, res) => {
    const u = await logado(req, res);
    if (!u) return;
    const r = await comprarItem(s.banco, u.id, req.body?.itemId);
    if (r !== 'ok') {
      const [status, erro] = ERROS_COMPRA[r];
      return void res.status(status).json({ erro });
    }
    res.status(204).end();
  });

  api.put('/loja/equipar', async (req, res) => {
    const u = await logado(req, res);
    if (!u) return;
    const itemId = req.body?.itemId === null ? null : req.body?.itemId;
    const r = await equipar(s.banco, u.id, req.body?.slot, itemId);
    if (r === 'invalido') return void res.status(400).json({ erro: 'item ou lugar inválido' });
    if (r === 'nao-tem') return void res.status(403).json({ erro: 'você ainda não tem esse item' });
    res.status(204).end();
  });

  api.post('/loja/pedidos', async (req, res) => {
    const u = await logado(req, res);
    if (!u) return;
    if (!s.pagamento) return void res.status(503).json({ erro: 'a compra de Pila ainda não está aberta' });
    const p = await criarPedido(s.banco, u.id, req.body?.pacoteId, s.agora());
    if (p === 'pacote') return void res.status(400).json({ erro: 'pacote inválido' });
    if (p === 'limite') return void res.status(429).json({ erro: 'muitos pedidos em pouco tempo; tente mais tarde' });
    const base = d.origem(req);
    const pacote = pacotePorId(p.pacoteId)!;
    try {
      const { url } = await s.pagamento.gateway.criarLink({
        orderNsu: p.id,
        descricao: `${pacote.nome} de Pila (${pacote.pila} Pila) — Truco`,
        centavos: p.valorCentavos,
        redirectUrl: `${base}/api/loja/retorno`,
        webhookUrl: `${base}/api/loja/webhook/infinitepay`,
        cliente: { nome: u.apelido, email: u.email ?? undefined },
      });
      await anexarCheckout(s.banco, p.id, url);
      res.json({ pedido: paraPedidoApi(p), url });
    } catch (e) {
      log.erro('loja_falha_checkout', { pedido: p.id, erro: e });
      res.status(502).json({ erro: 'não foi possível abrir o pagamento agora; tente de novo' });
    }
  });

  api.get('/loja/pedidos/:id', async (req, res) => {
    const u = await logado(req, res);
    if (!u) return;
    const p = await pedidoDe(s.banco, String(req.params.id), u.id);
    if (!p) return void res.status(404).json({ erro: 'pedido não encontrado' });
    res.json({ pedido: paraPedidoApi(p) });
  });

  /**
   * Webhook da InfinitePay. Sem assinatura: o corpo só diz qual pedido conferir. 200 também
   * para pedido desconhecido (não revela quais existem); 500 se o payment_check falhar (a
   * InfinitePay tenta de novo).
   */
  api.post('/loja/webhook/infinitepay', async (req, res) => {
    if (!limiteWebhook.permitir(chaveDeIp(req.ip))) return void res.status(429).json({ erro: 'muitos pedidos' });
    if (!s.pagamento) return void res.status(200).json({ ok: true });
    const dados = dadosDoRetorno(req.body);
    if (!dados) return void res.status(400).json({ erro: 'campos faltando' });
    try {
      const r = await confirmarPedido(s.banco, s.pagamento.gateway, dados, s.agora());
      if (r === 'pago') log.info('loja_pedido_pago', { pedido: dados.orderNsu, via: 'webhook' });
      res.status(200).json({ ok: true });
    } catch (e) {
      log.erro('loja_falha_webhook', e);
      res.status(500).json({ erro: 'tente de novo' });
    }
  });

  /** Volta do checkout (redirect da InfinitePay com os parâmetros na query). */
  api.get('/loja/retorno', async (req, res) => {
    const q = req.query as Record<string, unknown>;
    const dados = dadosDoRetorno(q);
    const pedido = typeof q.order_nsu === 'string' && /^[0-9a-f-]{36}$/.test(q.order_nsu) ? q.order_nsu : '';
    if (dados && s.pagamento) {
      try {
        const r = await confirmarPedido(s.banco, s.pagamento.gateway, dados, s.agora());
        if (r === 'pago') log.info('loja_pedido_pago', { pedido: dados.orderNsu, via: 'retorno' });
      } catch (e) {
        // A tela de obrigado consulta de novo; o webhook também confirma.
        log.erro('loja_falha_retorno', e);
      }
    }
    res.redirect(302, pedido ? `/#/loja/obrigado?pedido=${pedido}` : '/#/loja');
  });
}

/** Rotas de admin da loja (já atrás do porteiro de `/api/admin`). */
export function rotasAdminLoja(admin: Router, s: Servicos): void {
  admin.get('/pedidos', async (_req, res) => {
    const ps: PedidoAdmin[] = (await pedidosAdmin(s.banco)).map((p) => ({
      ...p,
      criadoEm: p.criadoEm.toISOString(),
      pagoEm: p.pagoEm?.toISOString() ?? null,
    }));
    res.json({ pedidos: ps });
  });

  /** Estorno de Pila (o admin estornou no app da InfinitePay): tira o Pila e anota na auditoria. */
  admin.post('/pedidos/:id/estorno', async (req, res) => {
    const r = await estornarPedido(s.banco, String(req.params.id), (res.locals.admin as Usuario).id, s.agora());
    if (r.resultado === 'desconhecido') return void res.status(404).json({ erro: 'pedido não encontrado' });
    if (r.resultado === 'ja-estornado') return void res.status(409).json({ erro: 'este pedido já foi estornado' });
    if (r.resultado === 'nao-pago') return void res.status(409).json({ erro: 'este pedido não foi pago' });
    log.info('admin_estorno', { admin: (res.locals.admin as Usuario).apelido, pedido: String(req.params.id), debitado: r.debitado, faltou: r.faltou });
    res.json(r);
  });

  /** Ajuste manual (ex.: estorno feito no app da InfinitePay). Fica no extrato como `ajuste_admin`. */
  admin.post('/usuarios/:id/ajuste', async (req, res) => {
    const id = Number(req.params.id);
    const moeda = req.body?.moeda as Moeda;
    const delta = req.body?.delta;
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim().slice(0, 120) : '';
    if (!Number.isInteger(id) || id <= 0) return void res.status(400).json({ erro: 'id inválido' });
    if (!(MOEDAS as readonly unknown[]).includes(moeda) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) {
      return void res.status(400).json({ erro: 'ajuste inválido' });
    }
    if (!motivo) return void res.status(400).json({ erro: 'diga o motivo do ajuste' });
    if (!(await usuarioPorId(s.banco, id))) return void res.status(404).json({ erro: 'usuário não encontrado' });
    try {
      const adminId = (res.locals.admin as Usuario).id;
      const saldo = await s.banco.transaction(async (tx) => {
        const novo = await movimentar(tx, id, moeda, delta, 'ajuste_admin', motivo);
        await registrarAuditoria(tx, { adminId, acao: 'ajuste_saldo', alvoId: id, detalhe: { moeda, delta, motivo } }, s.agora());
        return novo;
      });
      log.info('admin_ajuste', { admin: (res.locals.admin as Usuario).apelido, alvoId: id, moeda, delta, motivo });
      res.json({ saldo });
    } catch (e) {
      if (e instanceof SaldoInsuficiente) return void res.status(409).json({ erro: 'o saldo ficaria negativo' });
      throw e;
    }
  });
}
