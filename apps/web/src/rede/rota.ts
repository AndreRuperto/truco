import { useMemo, useSyncExternalStore } from 'react';
import { hrefDe, lerRota, type Rota } from '../logica/rotas';

function assinar(f: () => void): () => void {
  window.addEventListener('hashchange', f);
  return () => window.removeEventListener('hashchange', f);
}

const hashAtual = () => window.location.hash;

export function useRota(): Rota {
  const hash = useSyncExternalStore(assinar, hashAtual);
  return useMemo(() => lerRota(hash), [hash]);
}

/** Vai para a rota; `substituir` troca a entrada atual do histórico em vez de empilhar uma nova. */
export function navegar(r: Rota, { substituir = false } = {}): void {
  if (substituir) window.location.replace(hrefDe(r));
  else window.location.hash = hrefDe(r).slice(1);
}
