import * as THREE from 'three';
import { idCarta, type Carta } from '@truco/engine';
import { texturaFace } from './texturas';

export const CW = 0.076, CH = 0.108, CD = 0.0016;

const PI = Math.PI;
const _qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PI / 2);
const _qxVerso = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -PI / 2);
const Y = new THREE.Vector3(0, 1, 0);

/** Carta deitada na mesa. Face para cima por padrão; `virada` = verso para cima. */
export function quatPlano(yaw: number, virada = false): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(Y, yaw).multiply(virada ? _qxVerso : _qx);
}

/**
 * Fábrica de cartas da cena. Caixa fina: face +z = verso, face -z = frente.
 * Texturas e materiais de face ficam em cache por id da carta.
 */
export class Baralho3D {
  readonly geo = new THREE.BoxGeometry(CW, CH, CD);
  readonly borda = new THREE.MeshStandardMaterial({ color: '#e6dfcf', roughness: 0.8 });
  readonly verso: THREE.MeshStandardMaterial;
  private faces = new Map<string, THREE.MeshStandardMaterial>();

  constructor(texVerso: THREE.Texture) {
    this.verso = new THREE.MeshStandardMaterial({ map: texVerso, roughness: 0.6 });
  }

  materialFace(c: Carta | null): THREE.MeshStandardMaterial {
    if (!c) return this.verso;
    const id = idCarta(c);
    let m = this.faces.get(id);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ map: texturaFace(c), roughness: 0.55 });
      this.faces.set(id, m);
    }
    return m;
  }

  materiais(c: Carta | null): THREE.Material[] {
    return [this.borda, this.borda, this.borda, this.borda, this.verso, this.materialFace(c)];
  }

  nova(c: Carta | null = null): THREE.Mesh {
    const m = new THREE.Mesh(this.geo, this.materiais(c));
    m.castShadow = true;
    return m;
  }

  definirFace(m: THREE.Mesh, c: Carta | null): void {
    m.material = this.materiais(c);
  }

  descartar(): void {
    this.geo.dispose();
    this.borda.dispose();
    this.verso.dispose();
    for (const m of this.faces.values()) {
      m.map?.dispose();
      m.dispose();
    }
    this.faces.clear();
  }
}
