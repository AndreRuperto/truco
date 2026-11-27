import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { centrarMesa, FRACAO_MESA, fracaoNaTela, PROPORCAO_MAX, vistaPadrao } from '../src/componentes/mesa3d/enquadrar';
import { R_ASSENTO, TOPO } from '../src/componentes/mesa3d/sala';

/** Câmera como a cena monta (sem OrbitControls: sem giro, a vista padrão). */
function camera(largura: number, altura: number): THREE.PerspectiveCamera {
  const v = vistaPadrao(largura / altura);
  const c = new THREE.PerspectiveCamera(v.fov, largura / altura, 0.03, 30);
  c.position.copy(v.pos);
  c.lookAt(v.alvo);
  c.updateProjectionMatrix();
  return c;
}

/**
 * Caixas da cena medidas nas capturas (e2e/capturas-3d.spec.ts): a caixa 3D fica entre o placar e a
 * mão, então a proporção vai de ~0,8 (celular alto) a ~1,6 (computador).
 */
const CAIXAS: Array<[string, number, number]> = [
  ['320x568', 310, 235],
  ['360x640', 350, 300],
  ['390x844', 380, 475],
  ['430x932', 420, 540],
  ['1280x800', 1240, 520],
  ['estreita (0,55)', 300, 545],
];

describe('enquadramento da vista 3D', () => {
  test('o tampo é a mesma altura da sala (sem puxar a sala para o enquadramento)', () => {
    expect(TOPO).toBe(0.76);
  });

  const ESTREITAS = CAIXAS.filter(([, w, h]) => w / h < PROPORCAO_MAX);
  const LARGAS = CAIXAS.filter(([, w, h]) => w / h >= PROPORCAO_MAX);

  test.each(LARGAS)('%s: caixa larga (computador) fica como era, com a luminária no quadro', (_n, w, h) => {
    const c = camera(w, h);
    expect(centrarMesa(c, w, h)).toBe(0);
    expect(c.view?.enabled ?? false).toBe(false);
  });

  test.each(ESTREITAS)('%s: o centro da mesa sobe para perto do meio da caixa, não no pé', (_n, w, h) => {
    const c = camera(w, h);
    const antes = fracaoNaTela(c, new THREE.Vector3(0, TOPO, 0));
    centrarMesa(c, w, h);
    const depois = fracaoNaTela(c, new THREE.Vector3(0, TOPO, 0));
    expect(depois).toBeLessThan(antes + 1e-6);
    // No limite do deslocamento pode sobrar um pouco; a meta é FRACAO_MESA (0,54).
    expect(depois).toBeGreaterThan(FRACAO_MESA - 0.03);
    expect(depois).toBeLessThan(0.58);
  });

  test.each(CAIXAS)('%s: as cabeças de quem está sentado continuam dentro do quadro', (_n, w, h) => {
    const c = camera(w, h);
    centrarMesa(c, w, h);
    const cabeca = new THREE.Vector3(0, 1.12, -R_ASSENTO); // quem está de frente
    const y = fracaoNaTela(c, cabeca);
    expect(y).toBeGreaterThan(0.04);
    expect(y).toBeLessThan(0.5);
  });

  test('antes do ajuste a mesa ficava no pé da caixa do celular (a regressão que isto evita)', () => {
    const c = camera(380, 475);
    expect(fracaoNaTela(c, new THREE.Vector3(0, TOPO, 0))).toBeGreaterThan(0.58);
  });

  test('chamar de novo (redimensionar) não acumula deslocamento', () => {
    const c = camera(380, 475);
    const a = centrarMesa(c, 380, 475);
    const b = centrarMesa(c, 380, 475);
    expect(b).toBeCloseTo(a, 6);
  });
});
