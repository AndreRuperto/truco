import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { criarMesas, TOPO } from '../src/componentes/mesa3d/sala';
import type { Texturas } from '../src/componentes/mesa3d/texturas';

describe('mesa oval no cenário 3D', () => {
  test('o tampo intacto usa uma elipse de feltro e madeira, sem alterar a mesa plástica', () => {
    const tx = {
      madeira: new THREE.Texture(),
      reboco: new THREE.Texture(),
      discoZapada: new THREE.Texture(),
    } as unknown as Texturas;
    const mesas = criarMesas(tx);
    const camadas = mesas.madeira.children.filter((obj): obj is THREE.Mesh => obj instanceof THREE.Mesh);
    expect(camadas).toHaveLength(4);
    expect(camadas.every((m) => m.geometry.type === 'CylinderGeometry')).toBe(true);
    const feltro = camadas.at(-1)!;
    expect(feltro.scale.x).toBeCloseTo(0.558);
    expect(feltro.scale.z).toBeCloseTo(0.429);
    expect(feltro.position.y).toBeLessThanOrEqual(TOPO);
    expect(mesas.plastico.visible).toBe(false);
    expect(mesas.plastico.children.some(
      (obj) => obj instanceof THREE.Mesh && obj.geometry.type === 'BoxGeometry',
    )).toBe(true);
  });
});
