import * as THREE from 'three';
import { COR, repetida, type Texturas } from './texturas';

const PI = Math.PI;

/** Medidas da cena (metros). */
export const TOPO = 0.76;        // altura do tampo
export const MEIA = 0.43;        // metade do lado do tampo
export const R_ASSENTO = 0.8;    // centro da mesa até cada cadeira
export const LAMP_Y = 1.5;
const LX = 2.1, ZF = -1.75, ZB = 2.6, ALT = 2.8, RODAPE = 1.15;

export const mat = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...o });

export function malha(geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], sombra = true): THREE.Mesh {
  const x = new THREE.Mesh(geo, m);
  x.castShadow = sombra;
  x.receiveShadow = sombra;
  return x;
}

const v2 = (pts: Array<[number, number]>): THREE.Vector2[] => pts.map(([x, y]) => new THREE.Vector2(x, y));
export const PERFIL_COPO = v2([[0, 0], [0.027, 0], [0.029, 0.006], [0.035, 0.105], [0.037, 0.105], [0.031, 0.006], [0, 0.006]]);

/** Copo americano com cerveja e espuma. */
export function copoDeCerveja(): THREE.Group {
  const g = new THREE.Group();
  const vidro = new THREE.Mesh(
    new THREE.LatheGeometry(PERFIL_COPO, 8),
    new THREE.MeshStandardMaterial({ color: '#f2f6f2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, flatShading: true, depthWrite: false }),
  );
  vidro.renderOrder = 2;
  const cerveja = malha(
    new THREE.CylinderGeometry(0.032, 0.027, 0.075, 8),
    new THREE.MeshStandardMaterial({ color: '#e8a21c', roughness: 0.2, emissive: '#6b3a00', emissiveIntensity: 0.35, transparent: true, opacity: 0.92 }),
  );
  cerveja.position.y = 0.045;
  const espuma = malha(new THREE.CylinderGeometry(0.0335, 0.032, 0.02, 8), mat('#fbf3dc', { roughness: 0.9 }));
  espuma.position.y = 0.092;
  g.add(cerveja, espuma, vidro);
  return g;
}

/** Paredes de azulejo hidráulico e reboco, piso xadrez, prateleira com Zapada, placa, lousa e engradado. */
export function criarSala(tx: Texturas): THREE.Group {
  const sala = new THREE.Group();
  const piso = malha(new THREE.PlaneGeometry(LX * 2, ZB - ZF), new THREE.MeshStandardMaterial({ map: repetida(tx.piso, (LX * 2) / 0.6, (ZB - ZF) / 0.6), roughness: 0.85 }));
  piso.rotation.x = -PI / 2;
  piso.position.set(0, 0, (ZF + ZB) / 2);
  piso.castShadow = false;
  sala.add(piso);
  const teto = new THREE.Mesh(new THREE.PlaneGeometry(LX * 2, ZB - ZF), mat('#17110c'));
  teto.rotation.x = PI / 2;
  teto.position.set(0, ALT, (ZF + ZB) / 2);
  sala.add(teto);

  const parede = (largura: number, pos: THREE.Vector3, rotY: number): void => {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = rotY;
    sala.add(g);
    const baixo = malha(new THREE.PlaneGeometry(largura, RODAPE), new THREE.MeshStandardMaterial({ map: repetida(tx.azulejo, largura / 0.2, RODAPE / 0.2), roughness: 0.35 }));
    baixo.position.y = RODAPE / 2;
    baixo.castShadow = false;
    g.add(baixo);
    const cima = malha(new THREE.PlaneGeometry(largura, ALT - RODAPE), new THREE.MeshStandardMaterial({ map: repetida(tx.reboco, largura / 1.2, (ALT - RODAPE) / 1.2), roughness: 0.95 }));
    cima.position.y = RODAPE + (ALT - RODAPE) / 2;
    cima.castShadow = false;
    g.add(cima);
    const friso = malha(new THREE.BoxGeometry(largura, 0.05, 0.025), mat(COR.madeiraFunda));
    friso.position.set(0, RODAPE, 0.012);
    g.add(friso);
  };
  parede(LX * 2, new THREE.Vector3(0, 0, ZF), 0);
  parede(ZB - ZF, new THREE.Vector3(-LX, 0, (ZF + ZB) / 2), PI / 2);
  parede(ZB - ZF, new THREE.Vector3(LX, 0, (ZF + ZB) / 2), -PI / 2);

  // prateleira
  const prat = new THREE.Group();
  prat.position.set(-1.05, 1.36, ZF + 0.13);
  sala.add(prat);
  prat.add(malha(new THREE.BoxGeometry(1.2, 0.035, 0.24), new THREE.MeshStandardMaterial({ map: tx.madeira, roughness: 0.7 })));
  for (const x of [-0.5, 0.5]) {
    const mao = malha(new THREE.BoxGeometry(0.03, 0.16, 0.2), mat(COR.madeiraFunda));
    mao.position.set(x, -0.09, -0.01);
    prat.add(mao);
  }
  const geoGarrafa = new THREE.LatheGeometry(v2([[0, 0], [0.034, 0], [0.036, 0.012], [0.036, 0.17], [0.03, 0.2], [0.014, 0.245], [0.013, 0.29], [0.016, 0.3], [0, 0.3]]), 10);
  const matGarrafa = new THREE.MeshStandardMaterial({ color: '#2a6b3c', roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.88 });
  const matRotulo = new THREE.MeshStandardMaterial({ map: tx.rotulo, roughness: 0.6 });
  const geoRotulo = new THREE.CylinderGeometry(0.0372, 0.0372, 0.075, 12, 1, true);
  const geoTampa = new THREE.CylinderGeometry(0.017, 0.017, 0.012, 8);
  const matTampa = mat('#c9a43a', { metalness: 0.6, roughness: 0.4 });
  const garrafa = (pai: THREE.Object3D, x: number, y: number, z: number): void => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.add(malha(geoGarrafa, matGarrafa));
    const r = new THREE.Mesh(geoRotulo, matRotulo);
    r.position.y = 0.1;
    r.rotation.y = -PI / 2;
    g.add(r);
    const t = new THREE.Mesh(geoTampa, matTampa);
    t.position.y = 0.302;
    g.add(t);
    pai.add(g);
  };
  [-0.42, -0.32, -0.22, -0.12].forEach((x) => garrafa(prat, x, 0.018, -0.02));
  const geoCopo = new THREE.LatheGeometry(v2([[0, 0], [0.026, 0], [0.028, 0.005], [0.034, 0.1], [0.036, 0.1], [0.03, 0.005], [0, 0.005]]), 8);
  const matVidro = new THREE.MeshStandardMaterial({ color: '#dfe9e4', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.32, flatShading: true });
  [0.08, 0.17, 0.26].forEach((x) => {
    const c = new THREE.Mesh(geoCopo, matVidro);
    c.position.set(x, 0.018, 0);
    prat.add(c);
  });
  [0.35, 0.45].forEach((x) => garrafa(prat, x, 0.018, -0.03));

  // placa Zapada (afastada da moldura: sem z-fighting) e lousa
  const placa = malha(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshStandardMaterial({ map: tx.placa, roughness: 0.5, emissive: '#ffffff', emissiveMap: tx.placa, emissiveIntensity: 0.12 }));
  placa.position.set(0.62, 1.5, ZF + 0.02);
  placa.castShadow = false;
  sala.add(placa);
  const moldura = malha(new THREE.BoxGeometry(0.76, 0.41, 0.02), mat(COR.madeiraFunda));
  moldura.position.set(0.62, 1.5, ZF);
  sala.add(moldura);
  const lousa = malha(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshStandardMaterial({ map: tx.lousa, roughness: 0.9 }));
  lousa.rotation.y = PI / 2;
  lousa.position.set(-LX + 0.02, 1.5, -0.35);
  sala.add(lousa);
  const mLousa = malha(new THREE.BoxGeometry(0.02, 0.45, 0.65), mat(COR.madeira));
  mLousa.position.set(-LX + 0.005, 1.5, -0.35);
  sala.add(mLousa);

  // engradado
  const engr = new THREE.Group();
  engr.position.set(1.65, 0, -1.4);
  engr.rotation.y = 0.3;
  sala.add(engr);
  const geoCaixa = new THREE.BoxGeometry(0.45, 0.3, 0.32);
  const matCaixa = mat('#b8202a');
  const c1 = malha(geoCaixa, matCaixa);
  c1.position.y = 0.15;
  const c2 = malha(geoCaixa, matCaixa);
  c2.position.set(0.02, 0.45, 0);
  c2.rotation.y = -0.15;
  engr.add(c1, c2);
  for (let i = 0; i < 3; i++) garrafa(engr, -0.12 + i * 0.12, 0.6, 0);
  return sala;
}

/** Luminária pendente com spot quente (sombra suave), luz pontual e preenchimento frio. */
export function criarLuzes(mapaSombra: number): THREE.Group {
  const g = new THREE.Group();
  const lum = new THREE.Group();
  lum.position.set(0, LAMP_Y, 0);
  g.add(lum);
  const perfil = v2([[0.03, 0.17], [0.05, 0.16], [0.11, 0.08], [0.2, 0], [0.205, -0.01]]);
  lum.add(new THREE.Mesh(new THREE.LatheGeometry(perfil, 16), new THREE.MeshStandardMaterial({ color: '#2f5d4a', roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide, flatShading: true })));
  lum.add(new THREE.Mesh(new THREE.LatheGeometry(perfil.map((p) => new THREE.Vector2(p.x * 0.97, p.y - 0.003)), 16), new THREE.MeshBasicMaterial({ color: '#f5e2b8', side: THREE.BackSide })));
  const lampada = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3d6' }));
  lampada.position.y = 0.04;
  lum.add(lampada);
  const fio = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, ALT - LAMP_Y), mat('#111'));
  fio.position.y = (ALT - LAMP_Y) / 2 + 0.1;
  lum.add(fio);

  const spot = new THREE.SpotLight('#ffcf8f', 14, 0, 0.82, 0.55, 1.6);
  spot.position.set(0, LAMP_Y + 0.04, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(mapaSombra, mapaSombra);
  spot.shadow.camera.near = 0.2;
  spot.shadow.camera.far = 4;
  spot.shadow.bias = -0.0005;
  spot.shadow.normalBias = 0.02;
  g.add(spot, spot.target);
  const ponto = new THREE.PointLight('#ffb866', 3, 0, 1.7);
  ponto.position.set(0, LAMP_Y - 0.05, 0);
  const teto = new THREE.PointLight('#ffb866', 0.6, 2.5, 2);
  teto.position.set(0, LAMP_Y + 0.3, 0);
  g.add(ponto, teto);
  g.add(new THREE.HemisphereLight('#8a9cab', '#3a2616', 0.8));
  const rua = new THREE.DirectionalLight('#8aa4c8', 0.35);
  rua.position.set(2.5, 3, 3);
  g.add(rua);
  return g;
}

export interface Mesas {
  madeira: THREE.Group;
  plastico: THREE.Group;
  matPlastico: THREE.MeshStandardMaterial;
  matMadeiraEsc: THREE.MeshStandardMaterial;
}

/** As duas mesas no mesmo lugar; a cena liga uma ou outra. */
export function criarMesas(tx: Texturas): Mesas {
  const matMadeira = new THREE.MeshStandardMaterial({ map: tx.madeira, roughness: 0.65 });
  const matMadeiraEsc = mat(COR.madeiraFunda, { roughness: 0.7 });
  // --plastico escurecido: o spot estoura o amarelo puro
  const matPlastico = new THREE.MeshStandardMaterial({ color: '#d9a51c', roughness: 0.55 });
  const matPlasticoEsc = new THREE.MeshStandardMaterial({ color: COR.plasticoBorda, roughness: 0.5 });
  const madeira = new THREE.Group();
  const plastico = new THREE.Group();

  // Mesmo desenho oval da vitrine do clube: madeira aparente na borda,
  // filete dourado e feltro verde. O centro continua em TOPO para não alterar
  // animações, colisões, localização das cartas e gestos da partida.
  const matFeltro = new THREE.MeshStandardMaterial({
    map: repetida(tx.reboco, 2, 2),
    color: '#235c43',
    roughness: 0.97,
    metalness: 0,
  });
  const matFilete = mat('#b79a5a', { metalness: 0.25, roughness: 0.52 });
  const elipse = (raioX: number, raioZ: number, altura: number, y: number, material: THREE.Material): THREE.Mesh => {
    const m = malha(new THREE.CylinderGeometry(1, 1, altura, 80), material);
    m.scale.set(raioX, 1, raioZ);
    m.position.y = y;
    madeira.add(m);
    return m;
  };
  elipse(0.595, 0.466, 0.07, TOPO - 0.041, matMadeiraEsc);
  elipse(0.585, 0.456, 0.012, TOPO - 0.011, matMadeira);
  elipse(0.568, 0.439, 0.004, TOPO - 0.004, matFilete);
  // Feltro rente a TOPO: os cards permanecem visíveis sem z-fighting.
  elipse(0.558, 0.429, 0.003, TOPO - 0.0016, matFeltro);

  const tampoP = malha(new THREE.BoxGeometry(MEIA * 2 - 0.02, 0.03, MEIA * 2 - 0.02), matPlastico);
  tampoP.position.y = TOPO - 0.015;
  plastico.add(tampoP);
  const bordas: Array<[number, number, number, number]> = [
    [MEIA * 2, 0.02, 0, MEIA - 0.005], [MEIA * 2, 0.02, 0, -MEIA + 0.005],
    [0.02, MEIA * 2, MEIA - 0.005, 0], [0.02, MEIA * 2, -MEIA + 0.005, 0],
  ];
  for (const [w, d, x, z] of bordas) {
    const s = malha(new THREE.BoxGeometry(w, 0.05, d), matPlastico);
    s.position.set(x, TOPO - 0.025, z);
    plastico.add(s);
  }
  const disco = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), new THREE.MeshStandardMaterial({ map: tx.discoZapada, color: '#8c8c8c', roughness: 0.5, transparent: true }));
  disco.rotation.x = -PI / 2;
  disco.position.y = TOPO + 0.0006;
  disco.receiveShadow = true;
  plastico.add(disco);
  const geoPernaP = new THREE.CylinderGeometry(0.022, 0.03, TOPO - 0.02, 8);
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const p = malha(geoPernaP, matPlasticoEsc);
      p.position.set(x * (MEIA - 0.07), (TOPO - 0.02) / 2, z * (MEIA - 0.07));
      p.rotation.set(z * 0.06, 0, -x * 0.06);
      plastico.add(p);
    }
  plastico.visible = false;
  return { madeira, plastico, matPlastico, matMadeiraEsc };
}

/** Cadeira simples; as peças entram em `pecas` para trocar o material (madeira ↔ plástico). */
export function criarCadeira(mat0: THREE.Material, pecas: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number): void => {
    const m = malha(geo, mat0);
    m.position.set(x, y, z);
    g.add(m);
    pecas.push(m);
  };
  add(new THREE.BoxGeometry(0.42, 0.04, 0.42), 0, 0.44, -0.02);
  const perna = new THREE.BoxGeometry(0.035, 0.44, 0.035);
  for (const x of [-0.18, 0.18]) for (const z of [-0.2, 0.16]) add(perna, x, 0.22, z);
  const enc = new THREE.BoxGeometry(0.035, 0.5, 0.035);
  for (const x of [-0.18, 0.18]) add(enc, x, 0.69, -0.21);
  add(new THREE.BoxGeometry(0.4, 0.12, 0.025), 0, 0.86, -0.21);
  return g;
}
