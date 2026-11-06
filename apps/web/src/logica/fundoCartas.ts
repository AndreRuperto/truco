/*
 * Cartas soltas no fundo da tela inicial. Cada uma tem posição (em % da janela), giro
 * e profundidade `d` (0 = longe: pequena, desfocada e apagada; 1 = perto: grande e nítida).
 * O ponteiro mexe tudo em paralaxe (as de perto andam mais) e empurra/levanta a carta
 * que está debaixo dele.
 */

export interface CartaSolta {
  /** id da carta: valor + inicial do naipe (ex.: "4p" = Zap). */
  id: string;
  x: number;
  y: number;
  giro: number;
  d: number;
}

/*
 * Mais cartas nas laterais e nos cantos; no meio (onde fica o formulário) só cartas de
 * longe, pequenas e desfocadas, para não brigar com o texto.
 */
export const CARTAS_SOLTAS: readonly CartaSolta[] = [
  { id: 'Ae', x: 7, y: 16, giro: -18, d: 0.9 },
  { id: '4p', x: 89, y: 12, giro: 14, d: 1 },
  { id: '7c', x: 17, y: 47, giro: 9, d: 0.35 },
  { id: 'Kc', x: 81, y: 45, giro: -11, d: 0.6 },
  { id: '3o', x: 5, y: 82, giro: 22, d: 0.75 },
  { id: 'Qe', x: 93, y: 77, giro: -24, d: 0.85 },
  { id: '7o', x: 29, y: 9, giro: 28, d: 0.2 },
  { id: 'Jp', x: 71, y: 23, giro: -6, d: 0.28 },
  { id: '2c', x: 25, y: 72, giro: -30, d: 0.15 },
  { id: 'Cc', x: 74, y: 90, giro: 12, d: 0.45 },
  { id: 'Ap', x: 50, y: 97, giro: -8, d: 0.22 },
  { id: '5e', x: 97, y: 40, giro: 34, d: 0.18 },
  { id: 'Ko', x: 2, y: 34, giro: -4, d: 0.5 },
  { id: '6p', x: 58, y: 5, giro: -20, d: 0.12 },
];

export interface Mexida {
  x: number;
  y: number;
  giro: number;
  escala: number;
}

export const PARADA: Mexida = { x: 0, y: 0, giro: 0, escala: 1 };

/** Quanto (px) a carta mais perta anda de uma borda à outra da janela, na paralaxe. */
const PARALAXE = 36;
/** Empurrão máximo (px), giro extra (graus) e aumento quando o ponteiro está em cima. */
const EMPURRAO = 26;
const GIRO_TOQUE = 12;
const LEVANTA = 0.1;

/**
 * Para onde a carta vai com o ponteiro em `p` (null = fora da janela).
 * `centro` é o centro da carta na tela e `raio` o alcance do toque (≈ tamanho da carta).
 */
export function mexidaDaCarta(
  d: number,
  centro: { x: number; y: number },
  raio: number,
  p: { x: number; y: number } | null,
  janela: { l: number; a: number },
): Mexida {
  if (!p) return PARADA;
  // paralaxe: ponteiro à direita leva as cartas para a esquerda, mais as de perto
  let x = -((p.x / janela.l) - 0.5) * PARALAXE * d;
  let y = -((p.y / janela.a) - 0.5) * PARALAXE * d;
  let giro = 0;
  let escala = 1;
  const dx = centro.x - p.x;
  const dy = centro.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < raio) {
    const f = (1 - dist / raio) ** 2;
    const ux = dist > 0 ? dx / dist : 0;
    const uy = dist > 0 ? dy / dist : -1;
    x += ux * EMPURRAO * f;
    y += uy * EMPURRAO * f;
    giro = (dx >= 0 ? 1 : -1) * GIRO_TOQUE * f;
    escala = 1 + LEVANTA * f;
  }
  return { x, y, giro, escala };
}

/** Aproxima `atual` de `alvo` (suavização por quadro). */
export function aproximar(atual: Mexida, alvo: Mexida, k: number): Mexida {
  return {
    x: atual.x + (alvo.x - atual.x) * k,
    y: atual.y + (alvo.y - atual.y) * k,
    giro: atual.giro + (alvo.giro - atual.giro) * k,
    escala: atual.escala + (alvo.escala - atual.escala) * k,
  };
}

/** Já chegou (diferença invisível): o laço de animação pode parar. */
export function parada(a: Mexida, b: Mexida): boolean {
  return (
    Math.abs(a.x - b.x) < 0.05 &&
    Math.abs(a.y - b.y) < 0.05 &&
    Math.abs(a.giro - b.giro) < 0.05 &&
    Math.abs(a.escala - b.escala) < 0.0005
  );
}
