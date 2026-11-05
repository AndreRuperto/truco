import { matchMaker } from '@colyseus/core';

const permitir = (origem: string) => ({ 'Access-Control-Allow-Origin': origem, Vary: 'Origin' });

const LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

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
  let url: URL;
  try {
    url = new URL(origem);
  } catch {
    return {};
  }
  // Fora de produção: só o próprio computador (Vite, testes), não qualquer site aberto no navegador.
  if (!o.producao) return LOCAIS.has(url.hostname) ? permitir(origem) : {};
  const mesmoHost = url.host === host;
  return mesmoHost || o.origens.includes(origem) ? permitir(origem) : {};
}

/** Vale para TODO pedido HTTP do servidor (o Colyseus aplica num listener prefixado). */
export function instalarCors(o: { producao: boolean; origens: readonly string[] }): void {
  matchMaker.controller.getCorsHeaders = (headers: Headers) => cabecalhosCors(headers.get('origin'), headers.get('host'), o);
}
