import * as THREE from 'three';

/**
 * Cabelos e barbas dos bonecos, trazidos do Conversa de Boteco (web/cena/boneco.ts, que segue o kit do
 * Escrithorius). Lá a cabeça é um bloco de 0,46 × 0,52 centrado em 0; aqui o crânio tem ~0,22 de largura
 * e centro em y = 0,08 da cabeça. Cada peça é convertida por `ESCALA` e `CENTRO_Y`. Blocos chapados
 * (BoxGeometry), como o resto do boneco do Truco: o arredondado não aparece a esta distância e custa FPS
 * (esboço B, docs/qa-frontend/mesa-3d-enquadramento-2026-11.md).
 */
export type Penteado = 'curto' | 'topete' | 'blackpower' | 'cacheado' | 'longo' | 'medio' | 'calvo' | 'raspado';
export type Barba = 'nenhuma' | 'bigode' | 'bigodao' | 'cavanhaque' | 'cheia' | 'rala';
export type Sobrancelha = 'normal' | 'grossa' | 'fina';

export const PENTEADOS: Penteado[] = ['curto', 'topete', 'blackpower', 'cacheado', 'longo', 'medio', 'calvo', 'raspado'];
export const BARBAS: Barba[] = ['nenhuma', 'bigode', 'bigodao', 'cavanhaque', 'cheia', 'rala'];

const ESCALA = 0.478;
const CENTRO_Y = 0.08;
/** Meia altura da cabeça no desenho original. */
const H = 0.26;

type Mat = (cor: THREE.ColorRepresentation) => THREE.Material;

function bloco(cab: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const k = ESCALA;
  const b = new THREE.Mesh(new THREE.BoxGeometry(w * k, h * k, d * k), m);
  b.position.set(x * k, y * k + CENTRO_Y, z * k);
  b.castShadow = true;
  b.receiveShadow = true;
  cab.add(b);
  return b;
}

const mistura = (a: string, b: string, t: number): string => new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle();

/** Cabelo sem chapéu, na cor `cor`. */
export function penteado3d(cab: THREE.Object3D, estilo: Penteado, cor: string, M: Mat): void {
  const c = M(cor);
  const p = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => bloco(cab, c, w, h, d, x, y, z);
  if (estilo === 'calvo') {
    for (const k of [-1, 1]) p(0.06, 0.26, 0.38, k * 0.245, H - 0.17, -0.04);
    p(0.5, 0.3, 0.1, 0, H - 0.2, -0.225);
    return;
  }
  if (estilo === 'topete') {
    p(0.5, 0.15, 0.5, 0, H, -0.01);
    p(0.44, 0.12, 0.16, 0, H + 0.1, 0.15);
    for (const k of [-1, 1]) p(0.04, 0.2, 0.34, k * 0.24, H - 0.11, -0.05);
    p(0.5, 0.26, 0.08, 0, H - 0.15, -0.22);
    return;
  }
  if (estilo === 'blackpower') {
    p(0.6, 0.3, 0.58, 0, H + 0.1, -0.03);
    for (const k of [-1, 1]) p(0.08, 0.26, 0.44, k * 0.27, H - 0.08, -0.05);
    p(0.56, 0.34, 0.12, 0, H - 0.14, -0.24);
    return;
  }
  if (estilo === 'raspado') {
    p(0.5, 0.1, 0.5, 0, H - 0.02, -0.01);
    p(0.5, 0.26, 0.1, 0, H - 0.16, -0.22);
    for (const k of [-1, 1]) p(0.04, 0.2, 0.34, k * 0.24, H - 0.12, -0.04);
    return;
  }
  if (estilo === 'cacheado') {
    p(0.52, 0.16, 0.52, 0, H - 0.02, -0.02);
    // cachos: icosaedros de detalhe 0 em volta do topo (posições fixas, sem sorteio)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = 0.18 + (((i * 37) % 7) / 7) * 0.06;
      const raio = (0.1 + (((i * 13) % 5) / 5) * 0.04) * ESCALA;
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(raio, 0), c);
      b.position.set(Math.cos(a) * r * ESCALA, (H + 0.04 + (((i * 29) % 6) / 6) * 0.06) * ESCALA + CENTRO_Y, (Math.sin(a) * r - 0.03) * ESCALA);
      b.castShadow = true;
      cab.add(b);
    }
    p(0.5, 0.3, 0.1, 0, H - 0.14, -0.22);
    return;
  }
  p(0.52, 0.16, 0.52, 0, H - 0.01, -0.01);
  if (estilo === 'curto') {
    p(0.52, 0.28, 0.12, 0, H - 0.16, -0.21);
    for (const k of [-1, 1]) p(0.05, 0.22, 0.36, k * 0.25, H - 0.12, -0.05);
    p(0.46, 0.07, 0.1, 0, H - 0.02, 0.22);
    return;
  }
  // médio e longo: nuca, lados e franja
  const longo = estilo === 'longo';
  p(0.54, 0.42, 0.14, 0, H - 0.22, -0.22);
  for (const k of [-1, 1]) p(0.07, longo ? 0.44 : 0.3, 0.4, k * 0.26, H - (longo ? 0.24 : 0.15), -0.05);
  p(0.48, 0.1, 0.1, 0, H - 0.04, 0.22);
  if (longo) p(0.5, 0.3, 0.12, 0, H - 0.5, -0.24);
}

/** Barba e bigode. `pele` entra na barba rala (cor misturada). */
export function barba3d(cab: THREE.Object3D, estilo: Barba, cor: string, pele: string, M: Mat): void {
  if (estilo === 'nenhuma') return;
  if (estilo === 'rala') {
    const m = M(mistura(pele, cor, 0.5));
    const f = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => bloco(cab, m, w, h, d, x, y, z);
    f(0.3, 0.075, 0.024, 0, -H + 0.035, 0.232);
    for (const s of [-1, 1]) f(0.08, 0.15, 0.024, s * 0.13, -0.165, 0.232);
    f(0.15, 0.024, 0.02, 0, -0.12, 0.238);
    return;
  }
  const m = M(cor);
  const p = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => bloco(cab, m, w, h, d, x, y, z);
  if (estilo === 'bigode') { p(0.2, 0.04, 0.04, 0, -0.08, 0.24); return; }
  if (estilo === 'bigodao') {
    p(0.32, 0.075, 0.06, 0, -0.085, 0.245);
    for (const s of [-1, 1]) p(0.07, 0.11, 0.05, s * 0.15, -0.12, 0.24);
    return;
  }
  if (estilo === 'cavanhaque') { p(0.2, 0.05, 0.04, 0, -0.08, 0.24); p(0.16, 0.14, 0.1, 0, -H + 0.06, 0.2); return; }
  // cheia
  p(0.49, 0.24, 0.32, 0, -H + 0.08, 0.1);
  for (const s of [-1, 1]) p(0.04, 0.3, 0.28, s * 0.24, -H + 0.18, -0.01);
  p(0.22, 0.05, 0.04, 0, -0.08, 0.245);
}

/** z da boca: à frente da barba cheia, para não sumir dentro dela. */
export const zBoca = (b: Barba | undefined): number => (b === 'cheia' ? 0.265 * ESCALA : 0.1);
