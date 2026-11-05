import type { Variante } from '@truco/engine';
import type { ConfigApi, ItemHistorico, LinhaRanking, PerfilApi, SalaAberta, UsuarioApi } from '@truco/api';

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Cliente da API HTTP do server. Em dev o Vite faz proxy de /api; em produção é a mesma origem. */
export function criarApi(f: typeof fetch = (...a) => fetch(...a), base = '') {
  async function pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    const r = await f(`${base}${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (r.status === 204) return undefined as T;
    const dados = (await r.json().catch(() => null)) as { erro?: string } | null;
    if (!r.ok) throw new ErroApi(r.status, dados?.erro ?? `erro ${r.status}`);
    return dados as T;
  }
  return {
    config: () => pedir<ConfigApi>('GET', '/api/config'),
    eu: () => pedir<{ usuario: UsuarioApi | null }>('GET', '/api/eu'),
    trocarApelido: (apelido: string) => pedir<{ usuario: UsuarioApi }>('PATCH', '/api/eu', { apelido }),
    pedirLink: (email: string) => pedir<void>('POST', '/api/auth/link', { email }),
    confirmarLink: (token: string) => pedir<{ usuario: UsuarioApi }>('POST', '/api/auth/link/confirmar', { token }),
    entrarGoogle: (credencial: string) => pedir<{ usuario: UsuarioApi }>('POST', '/api/auth/google', { credencial }),
    sair: () => pedir<void>('POST', '/api/auth/sair', {}),
    perfil: (id?: number) => pedir<PerfilApi>('GET', id ? `/api/perfil/${id}` : '/api/perfil'),
    historico: () => pedir<{ partidas: ItemHistorico[] }>('GET', '/api/historico'),
    ranking: (v: Variante) => pedir<{ linhas: LinhaRanking[] }>('GET', `/api/ranking/${v}`),
    salas: () => pedir<{ salas: SalaAberta[] }>('GET', '/api/salas'),
  };
}

export type Api = ReturnType<typeof criarApi>;
