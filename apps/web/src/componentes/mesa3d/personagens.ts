import * as THREE from 'three';
import { CH, type Baralho3D } from './cartas';
import { mat, malha } from './sala';
import type { Texturas } from './texturas';

const PI = Math.PI;
const V = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;

export type Estilo = 'palha' | 'careca' | 'coque' | 'bone' | 'boina';

interface Visual {
  estilo: Estilo;
  pele: string;
  camisa: string | 'xadrez' | 'bolinhas' | 'listras';
  calca: string;
  cabelo: string;
  labios: string;
  barriga?: number;
  bone?: string;
}

/** Os visuais base (os quatro do protótipo, o boné do Juninho e uma boina). */
const VISUAIS: Visual[] = [
  { estilo: 'palha', pele: '#a8764f', camisa: 'xadrez', calca: '#3b3a35', cabelo: '#d9d4cc', labios: '#6b3a28' },
  { estilo: 'careca', pele: '#e3b596', camisa: '#efeadf', calca: '#5b4636', cabelo: '#3a2618', labios: '#9a5a4a', barriga: 1.14 },
  { estilo: 'coque', pele: '#7d5232', camisa: 'bolinhas', calca: '#2a2a3a', cabelo: '#16100c', labios: '#7a2a2a' },
  { estilo: 'bone', pele: '#8d5a3b', camisa: '#3f9b66', calca: '#2c3f5c', cabelo: '#1a120c', labios: '#5a2a20', bone: '#a3302a' },
  { estilo: 'boina', pele: '#c48d62', camisa: 'listras', calca: '#3a3530', cabelo: '#5a4030', labios: '#7a3a2a', bone: '#2c3f5c' },
];
const PELES = ['#e3b596', '#c48d62', '#a8764f', '#8d5a3b', '#6b4428'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** O mesmo nome sempre dá o mesmo visual (estilo pelo hash; a pele varia um pouco com outros bits). */
export function visualPorNome(nome: string): Visual {
  const h = hash(nome.trim().toLowerCase());
  const base = VISUAIS[h % VISUAIS.length];
  const trocaPele = (h >>> 8) % 3 === 0;
  return trocaPele ? { ...base, pele: PELES[(h >>> 12) % PELES.length] } : base;
}

export interface Braco {
  ombro: THREE.Group;
  cotovelo: THREE.Group;
  mao: THREE.Mesh;
  L1: number;
  L2: number;
  lado: number;
}

export interface CartaLeque {
  pivo: THREE.Group;
  mesh: THREE.Mesh;
}

export interface Personagem {
  nome: string;
  raiz: THREE.Group;
  tronco: THREE.Group;
  cabeca: THREE.Group;
  olhos: THREE.Mesh[];
  bracos: [Braco, Braco];
  leque: THREE.Group;
  cartas: CartaLeque[];
  /** Materiais próprios (para apagar quem caiu). */
  materiais: THREE.MeshStandardMaterial[];
  empe: boolean;
  fase: number;
  inclinar: number;
  pesoA: number;
  alvoA: THREE.Vector3;
  /** Carta presa à mão durante o alcance. */
  cartaNaMao: { m: THREE.Mesh; q0: THREE.Quaternion; qAlvo: THREE.Quaternion; k: number; pai: THREE.Object3D } | null;
  yaw: number;
  pitch: number;
  yawAlvo: number;
  pitchAlvo: number;
  proxOlhar: number;
  proxPiscar: number;
  piscando: number;
  foco: THREE.Vector3 | null;
  apagado: boolean;
  /** Fila de animações do braço (uma de cada vez). */
  fila: Promise<void>;
}

const DOWN = V(0, -1, 0);

function criarBraco(lado: number, mManga: THREE.Material, mPele: THREE.Material, pai: THREE.Object3D): Braco {
  const ombro = new THREE.Group();
  ombro.position.set(lado * 0.185, 0.36, 0);
  pai.add(ombro);
  const sup = malha(new THREE.CapsuleGeometry(0.043, 0.17, 2, 6), mManga);
  sup.position.y = -0.125;
  ombro.add(sup);
  const cotovelo = new THREE.Group();
  cotovelo.position.y = -0.25;
  ombro.add(cotovelo);
  const ante = malha(new THREE.CapsuleGeometry(0.036, 0.16, 2, 6), mPele);
  ante.position.y = -0.115;
  cotovelo.add(ante);
  const mao = malha(new THREE.IcosahedronGeometry(0.042, 0), mPele);
  mao.position.y = -0.24;
  mao.scale.set(1, 1.1, 0.8);
  cotovelo.add(mao);
  return { ombro, cotovelo, mao, L1: 0.25, L2: 0.24, lado };
}

const _d = V(), _n = V(), _u = V(), _e = V(), _f = V();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
/** IK de dois ossos no espaço do pai do ombro. */
export function resolverBraco(b: Braco, alvo: THREE.Vector3, polo: THREE.Vector3): void {
  const S = b.ombro.position;
  _d.subVectors(alvo, S);
  const dist = clamp(_d.length(), Math.abs(b.L1 - b.L2) + 0.02, b.L1 + b.L2 - 0.003);
  _d.normalize();
  const A = Math.acos(clamp((b.L1 * b.L1 + dist * dist - b.L2 * b.L2) / (2 * b.L1 * dist), -1, 1));
  _n.crossVectors(_d, polo);
  if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0);
  _n.normalize();
  _u.copy(_d).applyAxisAngle(_n, A);
  _e.copy(S).addScaledVector(_u, b.L1);
  _f.copy(S).addScaledVector(_d, dist).sub(_e).normalize();
  _qa.setFromUnitVectors(DOWN, _u);
  b.ombro.quaternion.copy(_qa);
  _qb.setFromUnitVectors(DOWN, _f);
  b.cotovelo.quaternion.copy(_qa.invert().multiply(_qb));
}

export function criarPersonagem(nome: string, v: Visual, tx: Texturas, empe = false, rnd: () => number = Math.random): Personagem {
  const materiais: THREE.MeshStandardMaterial[] = [];
  const M = (c: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial => {
    const m = mat(c, o);
    materiais.push(m);
    return m;
  };
  const raiz = new THREE.Group();
  const mPele = M(v.pele, { roughness: v.estilo === 'careca' ? 0.5 : 0.75 });
  const texCamisa = v.camisa === 'xadrez' ? tx.xadrez : v.camisa === 'bolinhas' ? tx.bolinhas : v.camisa === 'listras' ? tx.listras : null;
  const mCamisa = texCamisa ? M('#ffffff', { map: texCamisa, roughness: 0.85 }) : M(v.camisa);
  const mCalca = M(v.calca), mEscuro = M('#14100d'), mCabelo = M(v.cabelo);
  const yq = empe ? 0.9 : 0.5;
  if (!empe) {
    const q = malha(new THREE.BoxGeometry(0.3, 0.12, 0.26), mCalca);
    q.position.set(0, 0.5, 0);
    raiz.add(q);
    for (const x of [-0.08, 0.08]) {
      const c = malha(new THREE.BoxGeometry(0.12, 0.11, 0.36), mCalca);
      c.position.set(x, 0.5, 0.17);
      const p = malha(new THREE.BoxGeometry(0.1, 0.44, 0.1), mCalca);
      p.position.set(x, 0.27, 0.34);
      const s = malha(new THREE.BoxGeometry(0.11, 0.06, 0.18), mEscuro);
      s.position.set(x, 0.03, 0.38);
      raiz.add(c, p, s);
    }
  } else {
    const q = malha(new THREE.BoxGeometry(0.3, 0.14, 0.22), mCalca);
    q.position.set(0, 0.88, 0);
    raiz.add(q);
    for (const x of [-0.08, 0.08]) {
      const p = malha(new THREE.BoxGeometry(0.12, 0.84, 0.12), mCalca);
      p.position.set(x, 0.44, 0);
      const s = malha(new THREE.BoxGeometry(0.11, 0.06, 0.19), mEscuro);
      s.position.set(x, 0.03, 0.04);
      raiz.add(p, s);
    }
  }
  const tronco = new THREE.Group();
  tronco.position.y = yq + 0.02;
  raiz.add(tronco);
  const corpo = malha(new THREE.CylinderGeometry(0.165, 0.145, 0.42, 7), mCamisa);
  corpo.position.y = 0.21;
  corpo.scale.set(v.barriga ?? 1, 1, 0.72);
  tronco.add(corpo);
  const pesc = malha(new THREE.CylinderGeometry(0.045, 0.052, 0.09, 6), mPele);
  pesc.position.y = 0.46;
  tronco.add(pesc);
  if (v.estilo === 'careca') {
    const gola = malha(new THREE.CylinderGeometry(0.09, 0.12, 0.02, 7), mPele);
    gola.position.y = 0.415;
    gola.scale.z = 0.7;
    tronco.add(gola);
  }
  const cabeca = new THREE.Group();
  cabeca.position.y = 0.5;
  tronco.add(cabeca);
  const cranio = malha(new THREE.IcosahedronGeometry(0.11, 1), mPele);
  cranio.position.y = 0.08;
  cranio.scale.set(1, 1.12, 1);
  cabeca.add(cranio);
  const nariz = malha(new THREE.ConeGeometry(0.022, 0.05, 5), mPele);
  nariz.rotation.x = PI / 2;
  nariz.position.set(0, 0.07, 0.115);
  cabeca.add(nariz);
  const geoOrelha = new THREE.SphereGeometry(0.025, 5, 4);
  for (const x of [-0.11, 0.11]) {
    const o = malha(geoOrelha, mPele);
    o.position.set(x, 0.08, 0);
    cabeca.add(o);
  }
  const olhos: THREE.Mesh[] = [];
  const mBranco = M('#f3eee4', { flatShading: false, roughness: 0.4 });
  const mPupila = M('#120d09', { flatShading: false, roughness: 0.3 });
  const geoBranco = new THREE.SphereGeometry(0.019, 8, 6);
  const geoPupila = new THREE.SphereGeometry(0.012, 8, 6);
  for (const x of [-0.04, 0.04]) {
    const branco = new THREE.Mesh(geoBranco, mBranco);
    branco.position.set(x, 0.1, 0.093);
    branco.scale.z = 0.5;
    const o = new THREE.Mesh(geoPupila, mPupila);
    o.position.set(x, 0.1, 0.102);
    cabeca.add(branco, o);
    olhos.push(o, branco);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.045, v.estilo === 'careca' ? 0.016 : 0.01, 0.012), mCabelo);
    s.position.set(x, 0.135, 0.1);
    s.rotation.z = x > 0 ? -0.12 : 0.12;
    cabeca.add(s);
  }
  const boca = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.009, 0.01), M(v.labios));
  boca.position.set(0, 0.025, 0.1);
  cabeca.add(boca);

  if (v.estilo === 'palha') {
    const mPalha = M('#ffffff', { map: tx.palha, roughness: 0.9 });
    const chapeu = new THREE.Group();
    chapeu.rotation.set(-0.06, 0, 0.08);
    const aba = malha(new THREE.CylinderGeometry(0.21, 0.22, 0.014, 14), mPalha);
    aba.position.y = 0.16;
    const copa = malha(new THREE.CylinderGeometry(0.095, 0.115, 0.1, 10), mPalha);
    copa.position.y = 0.215;
    const fita = malha(new THREE.CylinderGeometry(0.116, 0.117, 0.025, 10), M('#5e2a1c'));
    fita.position.y = 0.18;
    chapeu.add(aba, copa, fita);
    cabeca.add(chapeu);
    const cav = malha(new THREE.IcosahedronGeometry(0.112, 1), mCabelo);
    cav.position.set(0, 0.085, -0.02);
    cav.scale.set(1.02, 0.9, 1);
    cabeca.add(cav);
  } else if (v.estilo === 'bone') {
    const mBone = M(v.bone ?? '#a3302a');
    const copa = malha(new THREE.SphereGeometry(0.118, 12, 6, 0, PI * 2, 0, PI * 0.5), mBone);
    copa.position.y = 0.105;
    copa.scale.y = 0.85;
    const aba = malha(new THREE.BoxGeometry(0.15, 0.012, 0.1), mBone);
    aba.position.set(0, 0.115, 0.14);
    aba.rotation.x = 0.15;
    const botao = malha(new THREE.SphereGeometry(0.012, 6, 4), mBone);
    botao.position.y = 0.205;
    cabeca.add(copa, aba, botao);
  } else if (v.estilo === 'boina') {
    const mBoina = M(v.bone ?? '#2c3f5c');
    const boina = malha(new THREE.CylinderGeometry(0.125, 0.115, 0.04, 12), mBoina);
    boina.position.set(0, 0.18, 0.01);
    boina.rotation.set(0.12, 0, -0.18);
    cabeca.add(boina);
    const cav = malha(new THREE.IcosahedronGeometry(0.112, 1), mCabelo);
    cav.position.set(0, 0.08, -0.025);
    cav.scale.set(1.02, 0.9, 1);
    const barba = malha(new THREE.BoxGeometry(0.13, 0.05, 0.05), mCabelo);
    barba.position.set(0, 0.0, 0.085);
    cabeca.add(cav, barba);
  } else if (v.estilo === 'careca') {
    const bigode = malha(new THREE.BoxGeometry(0.1, 0.026, 0.03), mCabelo);
    bigode.position.set(0, 0.045, 0.108);
    cabeca.add(bigode);
    for (const x of [-0.045, 0.045]) {
      const p = malha(new THREE.BoxGeometry(0.02, 0.04, 0.025), mCabelo);
      p.position.set(x, 0.028, 0.104);
      p.rotation.z = x > 0 ? 0.3 : -0.3;
      cabeca.add(p);
    }
    for (const x of [-0.1, 0.1]) {
      const lat = malha(new THREE.BoxGeometry(0.03, 0.05, 0.1), mCabelo);
      lat.position.set(x, 0.1, -0.02);
      cabeca.add(lat);
    }
    const nuca = malha(new THREE.BoxGeometry(0.17, 0.05, 0.04), mCabelo);
    nuca.position.set(0, 0.08, -0.1);
    cabeca.add(nuca);
  } else if (v.estilo === 'coque') {
    const cab = malha(new THREE.SphereGeometry(0.12, 12, 8, 0, PI * 2, 0, PI * 0.56), mCabelo);
    cab.position.set(0, 0.085, -0.008);
    cab.rotation.x = -0.35;
    const coque = malha(new THREE.IcosahedronGeometry(0.058, 1), mCabelo);
    coque.position.set(0, 0.215, -0.06);
    cabeca.add(cab, coque);
    const mBrinco = M('#d9b43a', { metalness: 0.7, roughness: 0.3 });
    for (const x of [-0.115, 0.115]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 4), mBrinco);
      b.position.set(x, 0.04, 0.01);
      cabeca.add(b);
    }
  }

  const mManga = v.estilo === 'careca' ? mPele : mCamisa;
  const bracos: [Braco, Braco] = [criarBraco(1, mManga, mPele, tronco), criarBraco(-1, mManga, mPele, tronco)];
  const leque = new THREE.Group();
  leque.position.set(0, 0.34, 0.23);
  leque.rotation.x = -0.38;
  tronco.add(leque);
  if (empe) leque.visible = false;
  for (const m of materiais) m.userData.cor = m.color.clone();

  return {
    nome, raiz, tronco, cabeca, olhos, bracos, leque, cartas: [], materiais, empe,
    fase: rnd() * 6, inclinar: 0, pesoA: 0, alvoA: V(), cartaNaMao: null,
    yaw: 0, pitch: 0.25, yawAlvo: 0, pitchAlvo: 0.25,
    proxOlhar: 1 + rnd() * 3, proxPiscar: 1 + rnd() * 3, piscando: 0,
    foco: null, apagado: false, fila: Promise.resolve(),
  };
}

// ---------------------------------------------------------------- leque
export function arrumarLeque(p: Personagem): void {
  const n = p.cartas.length;
  p.cartas.forEach((c, i) => {
    const a = i - (n - 1) / 2;
    c.pivo.rotation.z = -a * 0.28;
    c.pivo.position.set(a * 0.012, 0, a * 0.003);
  });
}

export const POSE_CARTA_LEQUE = CH / 2 - 0.012;

/** Põe uma carta (verso para fora) no leque; devolve a entrada para animar. */
export function adicionarCartaLeque(p: Personagem, baralho: Baralho3D): CartaLeque {
  const pivo = new THREE.Group();
  p.leque.add(pivo);
  const mesh = baralho.nova(null);
  mesh.position.y = POSE_CARTA_LEQUE;
  pivo.add(mesh);
  const c = { pivo, mesh };
  p.cartas.push(c);
  arrumarLeque(p);
  return c;
}

export function pontoLeque(p: Personagem, lado: number): THREE.Vector3 {
  return p.leque.localToWorld(V(lado * 0.032, 0.012, -0.012));
}

export function pontoMao(b: Braco): THREE.Vector3 {
  return b.mao.getWorldPosition(V());
}

/** Quem caiu fica cinza e escuro. */
export function apagar(p: Personagem, sim: boolean): void {
  if (p.apagado === sim) return;
  p.apagado = sim;
  const cinza = new THREE.Color('#6a6a6a');
  for (const m of p.materiais) {
    const orig = m.userData.cor as THREE.Color | undefined;
    if (!orig) continue;
    if (sim) m.color.copy(orig).lerp(cinza, 0.75).multiplyScalar(0.45);
    else m.color.copy(orig);
  }
}

// ---------------------------------------------------------------- vida
const POLO_SEGURA: [THREE.Vector3, THREE.Vector3] = [V(0.7, -1, -0.4).normalize(), V(-0.7, -1, -0.4).normalize()];
const POLO_ALCANCE = V(1, -0.6, -0.3).normalize();
const _w = V();

export function olharPara(p: Personagem, mundo: THREE.Vector3): void {
  const l = p.tronco.worldToLocal(_w.copy(mundo)).sub(p.cabeca.position);
  l.y -= 0.08;
  p.yawAlvo = clamp(Math.atan2(l.x, l.z), -1, 1);
  p.pitchAlvo = clamp(-Math.atan2(l.y, Math.hypot(l.x, l.z)), -0.35, 0.55);
}

export interface Contexto {
  /** Pontos que valem uma olhada (centro, câmera, cabeças dos outros). */
  alvosOlhar: () => THREE.Vector3[];
  /** Grupo da mesa (onde a carta presa à mão vive). */
  mesa: THREE.Object3D;
  rnd: () => number;
}

/** Respiração, olhar, piscar e braços (IK) — `ocioso` false congela respiração/olhar/piscar. */
export function viver(p: Personagem, dt: number, t: number, ocioso: boolean, ctx: Contexto): void {
  const resp = ocioso && !p.apagado ? Math.sin(t * 1.7 + p.fase) : 0;
  p.tronco.scale.y = 1 + 0.012 * resp;
  p.tronco.rotation.x = p.inclinar + 0.012 * resp + (p.apagado ? 0.25 : 0);
  p.tronco.rotation.z = ocioso ? 0.015 * Math.sin(t * 0.6 + p.fase) : 0;

  if (p.foco) olharPara(p, p.foco);
  else if (ocioso && !p.apagado) {
    p.proxOlhar -= dt;
    if (p.proxOlhar <= 0) {
      const r = ctx.rnd();
      if (r < 0.4) { p.yawAlvo = (ctx.rnd() - 0.5) * 0.2; p.pitchAlvo = 0.55; }
      else {
        const alvos = ctx.alvosOlhar();
        if (alvos.length) olharPara(p, alvos[Math.floor(ctx.rnd() * alvos.length)]);
      }
      p.proxOlhar = 1.8 + ctx.rnd() * 3.2;
    }
  } else if (p.apagado) { p.yawAlvo = 0; p.pitchAlvo = 0.5; }
  const kk = ocioso ? 1 - Math.exp(-dt * 5) : 1;
  p.yaw += (p.yawAlvo - p.yaw) * kk;
  p.pitch += (p.pitchAlvo - p.pitch) * kk;
  p.cabeca.rotation.set(p.pitch, p.yaw, 0, 'YXZ');

  if (ocioso && !p.apagado) {
    p.proxPiscar -= dt;
    if (p.proxPiscar <= 0) { p.piscando = 0.13; p.proxPiscar = 2 + ctx.rnd() * 3.5; }
  }
  p.piscando = Math.max(0, p.piscando - dt);
  const fe = p.piscando > 0 || p.apagado ? 0.12 : 1;
  for (const o of p.olhos) o.scale.y = fe;

  p.tronco.updateMatrixWorld(true);
  if (p.empe) return;
  for (let i = 0; i < 2; i++) {
    const b = p.bracos[i];
    let alvo = pontoLeque(p, b.lado);
    let polo = POLO_SEGURA[i];
    if (i === 0 && p.pesoA > 0) { alvo = alvo.lerp(p.alvoA, p.pesoA); polo = POLO_ALCANCE; }
    resolverBraco(b, p.tronco.worldToLocal(alvo), polo);
  }
  if (p.cartaNaMao) {
    const c = p.cartaNaMao;
    p.tronco.updateMatrixWorld(true);
    const w = pontoMao(p.bracos[0]).add(V(0, 0.02, 0));
    c.m.position.copy(c.pai.worldToLocal(w));
    c.m.quaternion.slerpQuaternions(c.q0, c.qAlvo, c.k);
  }
}

/** O palpiteiro em pé segura o copo e dá um gole de vez em quando. */
export function viverEmPe(p: Personagem, copo: THREE.Object3D, base: THREE.Object3D, gole: number): void {
  const segura = V(0.13, 0.26, 0.2).lerp(V(0.06, 0.47, 0.16), gole);
  resolverBraco(p.bracos[0], segura, POLO_SEGURA[0]);
  resolverBraco(p.bracos[1], V(-0.23, -0.12, 0.03), V(-0.3, 0, -1).normalize());
  p.tronco.updateMatrixWorld(true);
  copo.position.copy(pontoMao(p.bracos[0])).add(V(0, -0.035, 0));
  copo.rotation.set(0, 0, 0);
  copo.rotateOnWorldAxis(V(1, 0, 0).applyQuaternion(base.quaternion), -gole * 0.9);
}
