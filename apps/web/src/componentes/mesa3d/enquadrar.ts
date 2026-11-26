import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

/** Altura do tampo (igual a `TOPO` de sala.ts; repetida aqui para o enquadramento não puxar a sala). */
const TOPO = 0.76;

export interface Vista {
  fov: number;
  pos: THREE.Vector3;
  alvo: THREE.Vector3;
}

/**
 * Câmera da cadeira de quem joga, pela proporção da caixa da cena (largura / altura).
 * Tela larga: fov 57 e perto. Caixa estreita (celular em pé): abre o fov e recua para caber os três.
 */
export function vistaPadrao(a: number): Vista {
  if (a >= 1.3) return { fov: 57, pos: V(0, 1.36, 1.2), alvo: V(0, 0.9, -0.12) };
  const k = clamp((1.3 - a) / 0.75, 0, 1); // 0 = largo, 1 = celular estreito
  return { fov: lerp(57, 70, k), pos: V(0, lerp(1.36, 1.46, k), lerp(1.2, 1.88, k)), alvo: V(0, lerp(0.9, 0.97, k), -0.1) };
}

/**
 * Onde o centro da mesa deve cair na altura da caixa (0 = topo, 1 = pé). Um pouco abaixo do meio:
 * as cabeças de quem está sentado continuam no quadro e o centro, onde caem as cartas, fica no meio.
 * Antes ficava a ~0,59 da altura (celular), atrás da dica, da placa "Bot …" e do botão Ordem.
 */
export const FRACAO_MESA = 0.54;
/** Limite do deslocamento (fração da altura): mais que isso mostra só o piso. */
const DESLOCAMENTO_MAX = 0.12;
/**
 * Só desloca em caixa de celular (em pé ou o 320x568, proporção ~1,3): no computador a interface não cobre a mesa e o deslocamento
 * tirava a luminária do quadro e mostrava mais piso (capturas de 2026-11-26, 1280x800).
 */
export const PROPORCAO_MAX = 1.5;

/** Fração da altura (0 = topo, 1 = pé) em que um ponto cai, com a projeção atual da câmera. */
export function fracaoNaTela(camera: THREE.PerspectiveCamera, ponto: THREE.Vector3): number {
  camera.updateMatrixWorld();
  const p = ponto.clone().project(camera);
  return (1 - p.y) / 2;
}

/**
 * Desloca a imagem (lente deslocada, `setViewOffset`) para o centro da mesa cair em `FRACAO_MESA`.
 * Não muda perspectiva nem distância: só o recorte. Devolve o deslocamento em pixels (y).
 */
export function centrarMesa(camera: THREE.PerspectiveCamera, largura: number, altura: number): number {
  camera.clearViewOffset();
  if (largura / altura >= PROPORCAO_MAX) return 0;
  const fr = fracaoNaTela(camera, V(0, TOPO, 0));
  const dy = clamp(fr - FRACAO_MESA, -DESLOCAMENTO_MAX, DESLOCAMENTO_MAX) * altura;
  if (Math.abs(dy) >= 1) camera.setViewOffset(largura, altura, 0, dy, largura, altura);
  return dy;
}
