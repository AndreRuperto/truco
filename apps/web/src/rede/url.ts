export interface AmbienteUrl {
  /** `import.meta.env.VITE_SERVIDOR`. */
  configurada?: string;
  /** `import.meta.env.DEV`. */
  dev: boolean;
  local: { protocol: string; hostname: string; host: string };
}

/**
 * Endereço do servidor Colyseus: `VITE_SERVIDOR` se definida; em dev, o mesmo host
 * da página na porta 2567 (funciona no celular pela rede local); em produção, a
 * mesma origem (o server vai servir o build — Plano 4).
 */
export function urlServidor(
  a: AmbienteUrl = { configurada: import.meta.env.VITE_SERVIDOR, dev: import.meta.env.DEV, local: window.location },
): string {
  if (a.configurada) return a.configurada;
  const ws = a.local.protocol === 'https:' ? 'wss:' : 'ws:';
  return a.dev ? `${ws}//${a.local.hostname}:2567` : `${ws}//${a.local.host}`;
}
