import { mulberry32, type VisaoMao } from '@truco/engine';
import type { BotaoAcao } from './acoes';

/** Segurar o botão do pedido carrega a força de 0 a 1 neste tempo. */
export const TEMPO_CARGA_MS = 1200;
/** Soltar antes disto é um toque normal: pedido sem batida. */
export const TOQUE_RAPIDO_MS = 180;

export const cargaPorTempo = (ms: number): number => Math.min(1, Math.max(0, ms / TEMPO_CARGA_MS));

/** Força da batida ao soltar depois de `ms` segurando; null = toque rápido (sem batida). */
export const forcaAoSoltar = (ms: number): number | null => (ms < TOQUE_RAPIDO_MS ? null : cargaPorTempo(ms));

/** O botão pede Seis, Nove ou Doze (nível ≥ 2)? Só esses batem na mesa; o Truco não. */
export function botaoBate(b: BotaoAcao, m: Pick<VisaoMao, 'nivel' | 'trucoPendente'> | null): boolean {
  if (!m) return false;
  if (b.chave === 'truco') return m.nivel + 1 >= 2;
  if (b.chave === 'aumentar') return (m.trucoPendente?.proposto ?? 1) + 1 >= 2;
  return false;
}

export interface PontoMesa {
  x: number;
  y: number;
  angulo: number;
}

/**
 * Do referencial absoluto da mesa (o da cadeira 0: 0 embaixo, 1 à direita, 2 em cima,
 * 3 à esquerda) para a tela de quem senta em `minha` (eu embaixo, (minha+1)%4 à direita —
 * a mesma convenção de `posicaoRelativa`). Cada cadeira é um quarto de volta.
 */
export function paraRelativa(p: PontoMesa, minha: number): PontoMesa {
  let { x, y, angulo } = p;
  for (let i = 0; i < ((minha % 4) + 4) % 4; i++) [x, y, angulo] = [1 - y, x, angulo + 90];
  return { x, y, angulo: ((angulo % 360) + 360) % 360 };
}

export type Ponto = [number, number];

export interface FormaRachadura {
  /** Linha principal, de (0,0) até (~tamanho·100, ~0): o eixo x aponta para onde a fenda corre. */
  principal: Ponto[];
  ramos: Ponto[][];
}

const arred = (n: number) => Math.round(n * 100) / 100;

/**
 * Forma da rachadura (unidades do viewBox 0..100 do tampo), determinística pela `semente`:
 * linha principal em zigue-zague irregular e 2–4 ramificações que saem dela.
 */
export function gerarRachadura(semente: number, tamanho: number): FormaRachadura {
  const r = mulberry32(semente);
  const L = tamanho * 100;
  const n = 5 + Math.floor(r() * 4); // 5..8 segmentos
  const amp = L * 0.08;
  const principal: Ponto[] = [[0, 0]];
  let lado = r() < 0.5 ? -1 : 1;
  for (let i = 1; i < n; i++) {
    const x = (L * i) / n + (r() - 0.5) * (L / n) * 0.4;
    principal.push([arred(x), arred(lado * (0.3 + 0.7 * r()) * amp)]);
    if (r() < 0.75) lado = -lado;
  }
  principal.push([arred(L), arred((r() - 0.5) * amp * 0.5)]);

  const qtd = 2 + Math.floor(r() * 3); // 2..4
  const ramos: Ponto[][] = [];
  for (let k = 0; k < qtd; k++) {
    const base = principal[1 + Math.floor(r() * (principal.length - 2))];
    const ang = ((r() < 0.5 ? -1 : 1) * (25 + r() * 35) * Math.PI) / 180;
    const comp = L * (0.2 + r() * 0.25);
    const passos = 2 + Math.floor(r() * 2);
    const ramo: Ponto[] = [base];
    let [x, y] = base;
    for (let p = 0; p < passos; p++) {
      const a = ang + (r() - 0.5) * 0.5;
      x += (Math.cos(a) * comp) / passos;
      y += (Math.sin(a) * comp) / passos;
      ramo.push([arred(x), arred(y)]);
    }
    ramos.push(ramo);
  }
  return { principal, ramos };
}

export const caminho = (pts: Ponto[]): string => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
