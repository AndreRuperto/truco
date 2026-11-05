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

export function navegar(r: Rota): void {
  window.location.hash = hrefDe(r).slice(1);
}
