export const UMA_HORA_MS = 60 * 60_000;

/**
 * Roda `limpar` agora e a cada `intervaloMs` (sessões e links vencidos). O timer usa
 * `unref`: não segura o processo vivo. Devolve a função que cancela.
 */
export function agendarLimpeza(limpar: () => Promise<unknown>, intervaloMs = UMA_HORA_MS): () => void {
  const rodar = () => {
    limpar().catch((e) => console.error('[limpeza] falhou', e));
  };
  rodar();
  const t = setInterval(rodar, intervaloMs);
  t.unref?.();
  return () => clearInterval(t);
}
