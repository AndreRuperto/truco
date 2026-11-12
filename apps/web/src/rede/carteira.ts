import type { CarteiraApi, CatalogoApi } from '@truco/api';
import type { Api } from './api';

export interface EstadoCarteira {
  /** null = sem conta ou ainda não carregou. */
  carteira: CarteiraApi | null;
  catalogo: CatalogoApi | null;
  erro: string | null;
}

/**
 * Saldos, inventário e catálogo da loja (mesmo padrão da sessão: useSyncExternalStore).
 * O servidor é a fonte da verdade: depois de comprar/equipar, recarrega.
 */
export function criarCarteira(api: Pick<Api, 'loja'>) {
  let estado: EstadoCarteira = { carteira: null, catalogo: null, erro: null };
  const ouvintes = new Set<() => void>();
  let versao = 0;
  const mudar = (p: Partial<EstadoCarteira>) => {
    estado = { ...estado, ...p };
    for (const f of ouvintes) f();
  };
  const erroDe = (e: unknown) => (e instanceof Error ? e.message : String(e));
  return {
    subscribe(f: () => void): () => void {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    getSnapshot: (): EstadoCarteira => estado,
    async carregarCatalogo(): Promise<void> {
      if (estado.catalogo) return;
      try {
        mudar({ catalogo: await api.loja.catalogo() });
      } catch (e) {
        mudar({ erro: erroDe(e) });
      }
    },
    /** Lê a carteira da conta (aplica os bônus do dia no servidor). */
    async carregar(): Promise<CarteiraApi | null> {
      const v = ++versao;
      try {
        const c = await api.loja.eu();
        if (v === versao) mudar({ carteira: c, erro: null });
        return c;
      } catch (e) {
        if (v === versao) mudar({ erro: erroDe(e) });
        return null;
      }
    },
    /** Saiu da conta: nada do usuário anterior fica na memória. */
    limpar(): void {
      versao++;
      mudar({ carteira: null, erro: null });
    },
  };
}

export type Carteira = ReturnType<typeof criarCarteira>;
