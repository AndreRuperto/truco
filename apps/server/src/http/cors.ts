import { matchMaker } from '@colyseus/core';

const permitir = (origem: string) => ({ 'Access-Control-Allow-Origin': origem, Vary: 'Origin' });

/**
 * Cabeçalhos que o Colyseus soma aos padrões (`Allow-Origin: *`, `Allow-Credentials: true`).
 * Devolver `{}` deixa o `*`, que o navegador recusa em pedidos com credenciais.
 */
export function cabecalhosCors(
  origem: string | null,
  host: string | null,
  o: { producao: boolean; origens: readonly string[] },
): Record<string, string> {
  if (!origem) return {};
  if (!o.producao) return permitir(origem);
  let mesmoHost = false;
  try {
    mesmoHost = new URL(origem).host === host;
  } catch {
    return {};
  }
  return mesmoHost || o.origens.includes(origem) ? permitir(origem) : {};
}

/** Vale para TODO pedido HTTP do servidor (o Colyseus aplica num listener prefixado). */
export function instalarCors(o: { producao: boolean; origens: readonly string[] }): void {
  matchMaker.controller.getCorsHeaders = (headers: Headers) => cabecalhosCors(headers.get('origin'), headers.get('host'), o);
}
