import type { Variante } from '@truco/engine';
import type {
  ConfigApi,
  ItemHistorico,
  LinhaRanking,
  MesaAdmin,
  PartidaAdmin,
  PerfilApi,
  PreferenciasMesa,
  ResumoAdmin,
  SalaAberta,
  UsuarioAdmin,
  UsuarioApi,
} from '@truco/api';

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
      // Sem mensagem do servidor (proxy caiu, servidor reiniciando): uma frase de gente, com o código para suporte.
      throw new ErroApi(r.status, dados?.erro ?? (r.status >= 500 ? `o servidor está com problema agora (erro ${r.status}); tente de novo em instantes` : `algo deu errado (erro ${r.status})`));
    }
    if (dados === null) throw new ErroApi(r.status, 'resposta inválida do servidor');
    return dados as T;
  }
  return {
    config: () => pedir<ConfigApi>('GET', '/api/config'),
    eu: () => pedir<{ usuario: UsuarioApi | null }>('GET', '/api/eu'),
    trocarApelido: (apelido: string) => pedir<{ usuario: UsuarioApi }>('PATCH', '/api/eu', { apelido }, true),
    trocarAvatar: (avatar: string | null) => pedir<{ usuario: UsuarioApi }>('PUT', '/api/eu/avatar', { avatar }, true),
    conectarGoogle: (credencial: string) => pedir<{ usuario: UsuarioApi }>('POST', '/api/eu/google', { credencial }, true),
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
    admin: {
      resumo: () => pedir<ResumoAdmin>('GET', '/api/admin/resumo', undefined, true),
      usuarios: (busca = '') =>
        pedir<{ usuarios: UsuarioAdmin[] }>('GET', `/api/admin/usuarios${busca.trim() ? `?busca=${encodeURIComponent(busca.trim())}` : ''}`, undefined, true),
      trocarApelido: (id: number, apelido: string) => pedir<{ usuario: UsuarioApi }>('PATCH', `/api/admin/usuarios/${id}`, { apelido }, true),
      banir: (id: number) => pedir<void>('POST', `/api/admin/usuarios/${id}/banir`, {}, true),
      desbanir: (id: number) => pedir<void>('POST', `/api/admin/usuarios/${id}/desbanir`, {}, true),
      mesas: () => pedir<{ mesas: MesaAdmin[] }>('GET', '/api/admin/mesas', undefined, true),
      partidas: () => pedir<{ partidas: PartidaAdmin[] }>('GET', '/api/admin/partidas', undefined, true),
    },
  };
}

export type Api = ReturnType<typeof criarApi>;
