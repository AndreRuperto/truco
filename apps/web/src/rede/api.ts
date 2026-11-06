import type { Variante } from '@truco/engine';
import type { ConfigApi, ItemHistorico, LinhaRanking, PerfilApi, PreferenciasMesa, SalaAberta, UsuarioApi } from '@truco/api';

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/**
 * Cliente da API HTTP do server. Em dev o Vite faz proxy de /api; em produção é a mesma origem.
 * `aoNaoAutorizado` é chamado quando uma chamada que exige login volta 401 (sessão expirou).
 */
export function criarApi(f: typeof fetch = (...a) => fetch(...a), base = '', aoNaoAutorizado?: () => void) {
  async function pedir<T>(metodo: string, caminho: string, corpo?: unknown, autenticada = false): Promise<T> {
    let r: Response;
    try {
      r = await f(`${base}${caminho}`, {
        method: metodo,
        credentials: 'same-origin',
        headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new ErroApi(0, 'sem conexão com o servidor');
    }
    if (r.status === 204) return undefined as T;
    const dados = (await r.json().catch(() => null)) as { erro?: string } | null;
    if (!r.ok) {
      if (r.status === 401 && autenticada) aoNaoAutorizado?.();
      throw new ErroApi(r.status, dados?.erro ?? `erro ${r.status}`);
    }
    if (dados === null) throw new ErroApi(r.status, 'resposta inválida do servidor');
    return dados as T;
  }
  return {
    config: () => pedir<ConfigApi>('GET', '/api/config'),
    eu: () => pedir<{ usuario: UsuarioApi | null }>('GET', '/api/eu'),
    trocarApelido: (apelido: string) => pedir<{ usuario: UsuarioApi }>('PATCH', '/api/eu', { apelido }, true),
    pedirLink: (email: string) => pedir<void>('POST', '/api/auth/link', { email }),
    confirmarLink: (token: string) => pedir<{ usuario: UsuarioApi }>('POST', '/api/auth/link/confirmar', { token }),
    entrarGoogle: (credencial: string) => pedir<{ usuario: UsuarioApi }>('POST', '/api/auth/google', { credencial }),
    sair: () => pedir<void>('POST', '/api/auth/sair', {}),
    perfil: (id?: number) => (id ? pedir<PerfilApi>('GET', `/api/perfil/${id}`) : pedir<PerfilApi>('GET', '/api/perfil', undefined, true)),
    historico: () => pedir<{ partidas: ItemHistorico[] }>('GET', '/api/historico', undefined, true),
    ranking: (v: Variante) => pedir<{ linhas: LinhaRanking[] }>('GET', `/api/ranking/${v}`),
    salas: () => pedir<{ salas: SalaAberta[] }>('GET', '/api/salas'),
    preferencias: () => pedir<{ preferencias: PreferenciasMesa | null }>('GET', '/api/preferencias', undefined, true),
    salvarPreferencias: (preferencias: PreferenciasMesa) =>
      pedir<{ preferencias: PreferenciasMesa }>('PUT', '/api/preferencias', { preferencias }, true),
  };
}

export type Api = ReturnType<typeof criarApi>;
