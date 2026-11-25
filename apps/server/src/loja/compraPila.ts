/**
 * Compra de Pila com dinheiro real (pacotes pagos na InfinitePay).
 *
 * FECHADA desde 2026-11-25: o André não quer lidar com pagamento agora. Com `false` o servidor
 * recusa criar pedido/abrir checkout (`POST /api/loja/pedidos`) e o catálogo diz
 * `pagamentoAtivo: false`; o resto continua: itens da loja, webhook e retorno de pedidos antigos,
 * consulta do pedido e o admin (lista e estorno).
 *
 * Para reabrir: troque para `true` (e ligue `LOJA_PAGAMENTO`) e devolva a aba "Comprar Pila" na
 * web (`ABAS_LOJA` em apps/web/src/logica/rotas.ts). Nenhum código da compra foi apagado.
 */
export const COMPRA_PILA_ABERTA: boolean = false;

export const ERRO_COMPRA_PILA_FECHADA = 'a compra de Pila com dinheiro está fechada por enquanto';
