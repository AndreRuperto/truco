import { useEffect, useState, useSyncExternalStore } from 'react';
import type { EstadoLoja, Loja } from './loja';

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
