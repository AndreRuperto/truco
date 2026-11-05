import type { ConfigApi, UsuarioApi } from '@truco/api';
import type { Api } from './api';

export interface EstadoSessao {
  /** Já perguntou ao servidor (até lá, não mostra "Entrar"/"Sair" piscando). */
  pronta: boolean;
  usuario: UsuarioApi | null;
  config: ConfigApi;
}

const CONFIG_VAZIA: ConfigApi = { google: null, emailTeste: false };

/** Quem está logado + configuração pública; mesmo padrão da loja (useSyncExternalStore). */
export function criarSessao(api: Pick<Api, 'config' | 'eu' | 'sair'>) {
  let estado: EstadoSessao = { pronta: false, usuario: null, config: CONFIG_VAZIA };
  const ouvintes = new Set<() => void>();
  const mudar = (p: Partial<EstadoSessao>) => {
    estado = { ...estado, ...p };
    for (const f of ouvintes) f();
  };
  return {
    subscribe(f: () => void): () => void {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    getSnapshot: (): EstadoSessao => estado,
    async carregar(): Promise<void> {
      // `async () => api.x()` transforma até um throw síncrono em rejeição: sempre termina pronta.
      const [c, e] = await Promise.allSettled([(async () => api.config())(), (async () => api.eu())()]);
      mudar({
        pronta: true,
        config: c.status === 'fulfilled' ? c.value : CONFIG_VAZIA,
        usuario: e.status === 'fulfilled' ? e.value.usuario : null,
      });
    },
    definirUsuario: (u: UsuarioApi | null) => mudar({ usuario: u }),
    async sair(): Promise<void> {
      try {
        await api.sair();
      } catch {
        // o cookie expira sozinho; localmente já saímos
      } finally {
        mudar({ usuario: null });
      }
    },
  };
}

export type Sessao = ReturnType<typeof criarSessao>;
