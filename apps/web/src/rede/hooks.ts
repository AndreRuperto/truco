import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Carteira, EstadoCarteira } from './carteira';
import type { EstadoFila, LojaFila } from './fila';
import type { EstadoLoja, Loja } from './loja';
import type { EstadoSessao, Sessao } from './sessao';

export const useLoja = (loja: Loja): EstadoLoja => useSyncExternalStore(loja.subscribe, loja.getSnapshot);

/** Relógio que re-renderiza a cada `intervaloMs` (cronômetro, balões que somem). */
export function useAgora(intervaloMs = 250): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

export const useFila = (f: LojaFila): EstadoFila => useSyncExternalStore(f.subscribe, f.getSnapshot);

export const useSessao = (s: Sessao): EstadoSessao => useSyncExternalStore(s.subscribe, s.getSnapshot);

export const useCarteira = (c: Carteira): EstadoCarteira => useSyncExternalStore(c.subscribe, c.getSnapshot);

/** Busca dados ao montar e quando `deps` mudam; `recarregar()` busca de novo. */
export function useCarregar<T>(fn: () => Promise<T>, deps: readonly unknown[]) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string | null; carregando: boolean }>({ dados: null, erro: null, carregando: true });
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    fn().then(
      (dados) => {
        if (vivo) setEstado({ dados, erro: null, carregando: false });
      },
      (e: unknown) => {
        if (vivo) setEstado({ dados: null, erro: e instanceof Error ? e.message : String(e), carregando: false });
      },
    );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao]);
  return { ...estado, recarregar: () => setVersao((v) => v + 1) };
}
