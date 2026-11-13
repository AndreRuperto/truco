import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Posicao } from '../../logica/posicoes';
import type { Cena3D, CriarCena3D, Estado3D, Jogada3D, Jogador3D } from './tipos';
import { Baralho3D, CD, CH, CW, quatPlano } from './cartas';
import {
  adicionarCartaLeque, apagar, arrumarLeque, criarPersonagem, POSE_CARTA_LEQUE, pontoLeque, pontoMao,
  visualPorNome, viver, viverEmPe, type CartaLeque, type Contexto, type Personagem,
} from './personagens';
import {
  copoDeCerveja, criarCadeira, criarLuzes, criarMesas, criarSala, malha, mat, MEIA, R_ASSENTO, TOPO,
} from './sala';
import { COR, criarTexturas, semente, texturaVerso } from './texturas';
import { vestir3D } from './vestir';

const PI = Math.PI;
const V = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const suave = (k: number): number => k * k * (3 - 2 * k);
const saida = (k: number): number => 1 - Math.pow(1 - k, 3);
const entrada = (k: number): number => k * k * k;
const linear = (k: number): number => k;

type Outro = Exclude<Posicao, 'baixo'>;
const OUTROS: Outro[] = ['direita', 'cima', 'esquerda'];

/** Cadeiras: 'cima' de frente para a câmera, 'direita' em +x, 'esquerda' em -x. */
const SEDE: Record<Outro, THREE.Vector3> = {
  direita: V(R_ASSENTO, 0, 0),
  cima: V(0, 0, -R_ASSENTO),
  esquerda: V(-R_ASSENTO, 0, 0),
};
/** A cruz do centro: cada um joga na frente de si. */
const SLOT: Record<Posicao, { pos: THREE.Vector3; yaw: number }> = {
  baixo: { pos: V(0, 0, 0.108), yaw: PI + 0.06 },
  direita: { pos: V(0.094, 0, -0.005), yaw: PI - 0.14 },
  cima: { pos: V(0.005, 0, -0.118), yaw: PI + 0.1 },
  esquerda: { pos: V(-0.096, 0, 0.004), yaw: PI + 0.18 },
};
/** Onde fica o monte (perto de quem deu). */
const MONTE: Record<Posicao, THREE.Vector3> = {
  baixo: V(-0.29, 0, 0.24),
  direita: V(0.29, 0, 0.04),
  cima: V(-0.1, 0, -0.3),
  esquerda: V(-0.29, 0, -0.1),
};
const PILHA = V(MEIA - 0.13, 0, -MEIA + 0.13);
const BORDA_PERTO = V(0, TOPO + 0.06, MEIA + 0.08);
const ALTURA_CARTA = TOPO + CD / 2 + 0.0006;

// ---------------------------------------------------------------- animação
interface Tarefa {
  t0: number;
  dur: number;
  fn: (k: number) => void;
  ease: (k: number) => number;
  res: () => void;
  dono?: object;
}
class Animador {
  relogio = 0;
  private tarefas: Tarefa[] = [];
  constructor(private readonly instantaneo: boolean) {}
  /** Uma tarefa nova com o mesmo `dono` cancela (e resolve) a anterior. */
  animar(dur: number, fn: (k: number) => void, ease: (k: number) => number = suave, dono?: object): Promise<void> {
    if (dono) this.cancelar(dono);
    if (this.instantaneo || dur <= 0) {
      fn(1);
      return Promise.resolve();
    }
    return new Promise((res) => this.tarefas.push({ t0: this.relogio, dur, fn, ease, res, dono }));
  }
  esperar(s: number): Promise<void> {
    return this.animar(s, () => {});
  }
  cancelar(dono: object): void {
    for (let i = this.tarefas.length - 1; i >= 0; i--) {
      const t = this.tarefas[i];
      if (t.dono === dono) { this.tarefas.splice(i, 1); t.res(); }
    }
  }
  passo(dt: number): void {
    this.relogio += dt;
    for (let i = this.tarefas.length - 1; i >= 0; i--) {
      const t = this.tarefas[i];
      if (!t) continue;
      const k = Math.min(1, (this.relogio - t.t0) / t.dur);
      t.fn(t.ease(k));
      if (k >= 1) {
        const j = this.tarefas.indexOf(t);
        if (j >= 0) this.tarefas.splice(j, 1);
        t.res();
      }
    }
  }
  parar(): void {
    this.tarefas = [];
  }
}

// ---------------------------------------------------------------- rótulos CSS2D
const FONTE = "var(--fonte-ui, 'Bricolage Grotesque', system-ui, sans-serif)";
function criarBalao(reduzido: boolean): { obj: CSS2DObject; texto: HTMLDivElement; caixa: HTMLDivElement } {
  const fora = document.createElement('div');
  fora.style.pointerEvents = 'none';
  const caixa = document.createElement('div');
  Object.assign(caixa.style, {
    position: 'relative', font: `800 22px/1 ${FONTE}`, color: COR.tinta, background: COR.papel,
    border: `3px solid ${COR.tinta}`, borderRadius: '14px', padding: '8px 12px 7px', letterSpacing: '.02em',
    whiteSpace: 'nowrap', boxShadow: `3px 4px 0 ${COR.grito}`, marginBottom: '14px',
    transform: 'scale(.2) rotate(-6deg)', opacity: '0', transformOrigin: '50% 100%',
    transition: reduzido ? 'none' : 'transform .22s cubic-bezier(.3,1.6,.5,1), opacity .15s',
  } satisfies Partial<CSSStyleDeclaration>);
  const texto = document.createElement('div');
  const rabo = document.createElement('div');
  Object.assign(rabo.style, {
    position: 'absolute', left: '50%', bottom: '-10px', width: '14px', height: '14px', background: COR.papel,
    borderRight: `3px solid ${COR.tinta}`, borderBottom: `3px solid ${COR.tinta}`, transform: 'translateX(-50%) rotate(45deg)',
  } satisfies Partial<CSSStyleDeclaration>);
  caixa.append(texto, rabo);
  fora.append(caixa);
  const obj = new CSS2DObject(fora);
  obj.center.set(0.5, 1);
  obj.visible = false;
  return { obj, texto, caixa };
}

// ---------------------------------------------------------------- a cena
export const criarCena3D: CriarCena3D = (container, opcoes) => {
  const reduzido = opcoes.reduzido;
  const rnd = semente(23);
  const largura = (): number => Math.max(1, container.clientWidth);
  const altura = (): number => Math.max(1, container.clientHeight);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(largura(), altura(), false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(renderer.domElement);

  const rotulos = new CSS2DRenderer();
  rotulos.setSize(largura(), altura());
  Object.assign(rotulos.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
  container.appendChild(rotulos.domElement);

  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#0d0a08');
  cena.fog = new THREE.Fog('#0d0a08', 4.5, 9);
  const camera = new THREE.PerspectiveCamera(57, largura() / altura(), 0.03, 30);
  cena.add(camera);

  const tx = criarTexturas();
  const baralho = new Baralho3D(tx.verso);
  const pequeno = Math.min(largura(), altura()) < 500;
  cena.add(criarSala(tx), criarLuzes(pequeno ? 512 : 1024));
  const mesas = criarMesas(tx);
  const mesaGrupo = new THREE.Group();
  cena.add(mesaGrupo);
  mesaGrupo.add(mesas.madeira, mesas.feltro, mesas.plastico);
  const copo = copoDeCerveja();
  copo.position.set(MEIA - 0.1, TOPO, MEIA - 0.13);
  mesaGrupo.add(copo);
  const anim = new Animador(reduzido);

  // cadeiras e lugares
  const pecasCadeira: THREE.Mesh[] = [];
  const bases = {} as Record<Outro, THREE.Group>;
  for (const pos of OUTROS) {
    const b = new THREE.Group();
    b.position.copy(SEDE[pos]);
    b.rotation.y = Math.atan2(-SEDE[pos].x, -SEDE[pos].z);
    b.add(criarCadeira(mesas.matMadeiraEsc, pecasCadeira));
    cena.add(b);
    bases[pos] = b;
  }
  const personagens: Partial<Record<Outro, Personagem>> = {};

  // o palpiteiro, em pé no canto (decoração)
  const palpiteiro = criarPersonagem('palpiteiro', { estilo: 'bone', pele: '#6b4428', camisa: '#d9772b', calca: '#2c3f5c', cabelo: '#1a120c', labios: '#5a2a20', bone: '#2f68b8' }, tx, true, rnd);
  const basePalp = new THREE.Group();
  basePalp.position.set(1.5, 0, -1.4);
  basePalp.rotation.y = Math.atan2(-1.5, 1.4);
  basePalp.add(palpiteiro.raiz);
  cena.add(basePalp);
  const copoPalp = copoDeCerveja();
  cena.add(copoPalp);
  let proxGole = 3, goleT = 0;

  // "você": dois antebraços apoiados na beirada, mãos vazias
  const matPele = mat(COR.pele, { roughness: 0.7 });
  const matManga = mat(COR.lousa);
  const matPunho = mat('#2c3c33');
  function antebraco(lado: number): THREE.Group {
    const g = new THREE.Group();
    // apoiados na beirada: mãos perto do meio, cotovelos abertos para os lados
    g.position.set(lado * 0.11, TOPO + 0.03, MEIA - 0.07);
    const dir = V(lado * 0.75, -0.1, 0.66).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
    const mao = malha(new THREE.IcosahedronGeometry(0.034, 0), matPele);
    mao.scale.set(1.15, 0.6, 1.35);
    mao.rotation.y = lado * 1.1;
    const dedos = malha(new THREE.BoxGeometry(0.045, 0.018, 0.05), matPele);
    dedos.position.set(-lado * 0.03, -0.01, -0.012);
    dedos.rotation.y = lado * 1.1;
    const dedao = malha(new THREE.CapsuleGeometry(0.009, 0.022, 2, 5), matPele);
    dedao.position.set(-lado * 0.012, -0.004, -0.03);
    dedao.rotation.set(PI / 2, 0, lado * 0.4);
    const ante = malha(new THREE.CylinderGeometry(0.03, 0.036, 0.22, 7), matPele);
    ante.quaternion.copy(q);
    ante.position.copy(dir).multiplyScalar(0.12);
    const punho = malha(new THREE.CylinderGeometry(0.044, 0.044, 0.03, 7), matPunho);
    punho.quaternion.copy(q);
    punho.position.copy(dir).multiplyScalar(0.235);
    const manga = malha(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 7), matManga);
    manga.quaternion.copy(q);
    manga.position.copy(dir).multiplyScalar(0.37);
    g.add(mao, dedos, dedao, ante, punho, manga);
    cena.add(g);
    return g;
  }
  antebraco(-1);
  const maoD = antebraco(1);
  const maoDBase = maoD.position.clone();

  // vira e monte
  const monte = malha(new THREE.BoxGeometry(CW, CH, 1), [baralho.borda, baralho.borda, baralho.borda, baralho.borda, baralho.verso, baralho.borda]);
  monte.visible = false;
  mesaGrupo.add(monte);
  const vira = baralho.nova(null);
  vira.receiveShadow = true;
  vira.visible = false;
  mesaGrupo.add(vira);
  let viraId = '';

  // indicador de vez
  const vez = new THREE.Group();
  vez.visible = false;
  mesaGrupo.add(vez);
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.09, 40), new THREE.MeshBasicMaterial({ color: COR.grito, transparent: true, opacity: 0.95, depthWrite: false }));
  anel.rotation.x = -PI / 2;
  anel.position.y = TOPO + 0.003;
  const brilho = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), new THREE.MeshBasicMaterial({ map: tx.brilho, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  brilho.rotation.x = -PI / 2;
  brilho.position.y = TOPO + 0.002;
  vez.add(anel, brilho);
  const elVez = document.createElement('div');
  elVez.style.pointerEvents = 'none';
  const chipVez = document.createElement('div');
  Object.assign(chipVez.style, {
    display: 'flex', gap: '6px', alignItems: 'center', font: `600 12px/1 ${FONTE}`, color: COR.tinta, background: COR.grito,
    borderRadius: '999px', padding: '5px 10px', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.45)', marginBottom: '6px',
  } satisfies Partial<CSSStyleDeclaration>);
  const nomeVez = document.createElement('span');
  const segVez = document.createElement('span');
  Object.assign(segVez.style, {
    background: COR.tinta, color: COR.grito, borderRadius: '999px', minWidth: '22px', padding: '3px 5px', textAlign: 'center',
    fontVariantNumeric: 'tabular-nums', marginRight: '-4px',
  } satisfies Partial<CSSStyleDeclaration>);
  chipVez.append(nomeVez, segVez);
  elVez.append(chipVez);
  const rotuloVez = new CSS2DObject(elVez);
  rotuloVez.center.set(0.5, 1);
  rotuloVez.position.y = TOPO + 0.02;
  vez.add(rotuloVez);
  const vezDe = V(), vezPara = V();
  let vezK = 1;
  const posVez = (pos: Posicao): THREE.Vector3 =>
    pos === 'baixo' ? V(0, 0, MEIA - 0.16) : SEDE[pos].clone().normalize().multiplyScalar(0.31);

  // balões
  const baloes = {} as Record<Posicao, ReturnType<typeof criarBalao>>;
  const ancoraBaixo = new THREE.Object3D();
  ancoraBaixo.position.set(0, TOPO + 0.16, MEIA - 0.02);
  cena.add(ancoraBaixo);
  for (const pos of ['baixo', ...OUTROS] as Posicao[]) baloes[pos] = criarBalao(reduzido);
  ancoraBaixo.add(baloes.baixo.obj);
  baloes.baixo.obj.position.set(0, 0, 0);
  function prenderBalao(pos: Outro): void {
    const p = personagens[pos];
    if (!p) return;
    p.cabeca.add(baloes[pos].obj);
    baloes[pos].obj.position.set(0, 0.34, 0);
  }
  function mostrarBalao(pos: Posicao, texto: string | null): void {
    const b = baloes[pos];
    if (texto) {
      b.texto.textContent = texto;
      b.obj.visible = true;
      requestAnimationFrame(() => { b.caixa.style.opacity = '1'; b.caixa.style.transform = 'scale(1) rotate(-6deg)'; });
    } else {
      b.caixa.style.opacity = '0';
      b.caixa.style.transform = 'scale(.2) rotate(-6deg)';
      const sumir = (): void => { if (b.caixa.style.opacity === '0') b.obj.visible = false; };
      if (reduzido) sumir(); else setTimeout(sumir, 200);
    }
  }

  // ---------------------------------------------------------------- personagens
  const ctx: Contexto = {
    rnd,
    mesa: mesaGrupo,
    alvosOlhar: () => [V(0, TOPO, 0), camera.position.clone(), ...OUTROS.flatMap((o) => (personagens[o] ? [personagens[o]!.cabeca.getWorldPosition(V())] : []))],
  };
  const ocupados = new Map<Personagem, number>();
  function naFila(p: Personagem, f: () => Promise<void>): void {
    ocupados.set(p, (ocupados.get(p) ?? 0) + 1);
    p.fila = p.fila.then(f).catch(() => {}).then(() => { ocupados.set(p, (ocupados.get(p) ?? 1) - 1); });
  }
  function descartarObjeto(o: THREE.Object3D, poupar: Set<unknown>): void {
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (!m.isMesh) return;
      if (!poupar.has(m.geometry)) m.geometry.dispose();
      const ms = Array.isArray(m.material) ? m.material : [m.material];
      for (const mm of ms) if (!poupar.has(mm)) mm.dispose();
    });
  }
  /** Roupa com que cada personagem foi criado (chave): trocou de roupa, recria o personagem. */
  const roupaDe: Partial<Record<Outro, string>> = {};
  function garantirPersonagem(pos: Outro, nome: string, roupa: Jogador3D['roupa'] = null): Personagem {
    const atual = personagens[pos];
    const chaveRoupa = JSON.stringify(roupa ?? null);
    if (atual && atual.nome === nome && roupaDe[pos] === chaveRoupa) return atual;
    if (atual) {
      baloes[pos].obj.removeFromParent();
      atual.raiz.removeFromParent();
      anim.cancelar(atual);
      descartarObjeto(atual.raiz, new Set<unknown>([baralho.geo, baralho.borda, baralho.verso]));
    }
    const p = criarPersonagem(nome, vestir3D(visualPorNome(nome), roupa), tx, false, rnd);
    roupaDe[pos] = chaveRoupa;
    bases[pos].add(p.raiz);
    personagens[pos] = p;
    prenderBalao(pos);
    return p;
  }

  // ---------------------------------------------------------------- cartas na mesa
  const centro = new Map<string, THREE.Mesh>();
  const donoDa = new Map<string, Posicao>();
  let geracaoPilha = 0;
  let pilhaMeshes: THREE.Mesh[] = [];
  let pilhaN = 0;
  let tremor = 0;

  function alvoJogada(j: Jogada3D): { pos: THREE.Vector3; q: THREE.Quaternion } {
    const s = SLOT[j.pos];
    const n = [...donoDa.values()].filter((p) => p === j.pos).length;
    const camada = centro.size;
    const pos = s.pos.clone().add(V(n * 0.018, 0, n * 0.012));
    pos.y = ALTURA_CARTA + camada * 0.0018;
    return { pos, q: quatPlano(s.yaw + n * 0.2, j.carta === null) };
  }
  function voar(m: THREE.Object3D, para: THREE.Vector3, qPara: THREE.Quaternion, dur: number, alt = 0.05): Promise<void> {
    const p0 = m.position.clone(), q0 = m.quaternion.clone();
    return anim.animar(dur, (k) => {
      m.position.lerpVectors(p0, para, k);
      m.position.y += Math.sin(k * PI) * alt;
      m.quaternion.slerpQuaternions(q0, qPara, k);
    }, saida, m);
  }
  function tremer(f: number): void {
    if (!reduzido) tremor = Math.max(tremor, 0.012 * clamp(f, 0, 1));
  }

  async function jogarDoPersonagem(p: Personagem, m: THREE.Mesh, alvo: THREE.Vector3, qAlvo: THREE.Quaternion): Promise<void> {
    const alvoMundo = mesaGrupo.localToWorld(alvo.clone()).add(V(0, 0.07, 0));
    p.foco = alvoMundo;
    p.cartaNaMao = { m, q0: m.quaternion.clone(), qAlvo, k: 0, pai: mesaGrupo };
    const inicio = pontoLeque(p, 1);
    await anim.animar(0.45, (k) => {
      p.pesoA = 1;
      p.alvoA.lerpVectors(inicio, alvoMundo, k);
      p.inclinar = 0.3 * k;
      if (p.cartaNaMao) p.cartaNaMao.k = k * 0.6;
    }, suave, p);
    if (p.cartaNaMao?.m === m) p.cartaNaMao = null;
    if (m.parent === mesaGrupo && centroTem(m)) void voar(m, alvo, qAlvo, 0.32, 0.04).then(() => tremer(0.15));
    await anim.animar(0.5, (k) => { p.pesoA = 1 - k; p.inclinar = 0.3 * (1 - k); }, suave, p);
    p.foco = null;
  }
  const centroTem = (m: THREE.Mesh): boolean => [...centro.values()].includes(m);

  function criarJogada(j: Jogada3D, instantaneo: boolean): THREE.Mesh {
    const { pos, q } = alvoJogada(j);
    if (j.pos === 'baixo' || instantaneo) {
      const m = baralho.nova(j.carta);
      mesaGrupo.add(m);
      if (instantaneo) {
        m.position.copy(pos);
        m.quaternion.copy(q);
      } else {
        m.position.copy(BORDA_PERTO);
        m.quaternion.copy(quatPlano(PI, true));
        void anim.animar(0.25, (k) => maoD.position.copy(maoDBase).add(V(0, 0.02 * Math.sin(k * PI), -0.09 * k)), suave, maoD)
          .then(() => anim.animar(0.3, (k) => maoD.position.copy(maoDBase).add(V(0, 0, -0.09 * (1 - k))), suave, maoD));
        void voar(m, pos, q, 0.5, 0.09).then(() => tremer(0.15));
      }
      return m;
    }
    const p = personagens[j.pos];
    let m: THREE.Mesh;
    const c = p?.cartas.pop();
    if (p && c) {
      m = c.mesh;
      mesaGrupo.attach(m);
      c.pivo.removeFromParent();
      arrumarLeque(p);
      baralho.definirFace(m, j.carta);
    } else {
      m = baralho.nova(j.carta);
      mesaGrupo.add(m);
      const de = p ? mesaGrupo.worldToLocal(pontoMao(p.bracos[0])) : SEDE[j.pos].clone().multiplyScalar(0.6).setY(TOPO + 0.2);
      m.position.copy(de);
    }
    if (p) naFila(p, () => jogarDoPersonagem(p, m, pos, q));
    else void voar(m, pos, q, 0.4);
    return m;
  }

  function montarPilha(n: number): void {
    for (const m of pilhaMeshes) { m.removeFromParent(); m.geometry.dispose(); }
    pilhaMeshes = [];
    for (let r = 0; r < n; r++) {
      const m = malha(new THREE.BoxGeometry(CW, CH, CD * 4), [baralho.borda, baralho.borda, baralho.borda, baralho.borda, baralho.verso, baralho.borda]);
      m.quaternion.copy(quatPlano(PI + 0.5 + r * 0.45, true));
      m.position.copy(PILHA).setY(TOPO + CD * 2 + 0.0006 + r * CD * 4.2);
      mesaGrupo.add(m);
      pilhaMeshes.push(m);
    }
  }
  function soltarDaMao(m: THREE.Mesh): void {
    for (const p of Object.values(personagens)) if (p?.cartaNaMao?.m === m) p.cartaNaMao = null;
  }
  function recolher(meshes: THREE.Mesh[], n: number): void {
    const base = pilhaMeshes.length;
    const ger = geracaoPilha;
    meshes.forEach((m, i) => {
      soltarDaMao(m);
      const alvo = PILHA.clone().setY(TOPO + 0.004 + (base + i) * 0.002);
      void anim.esperar(0.15 + i * 0.06).then(() => voar(m, alvo, quatPlano(PI + 0.5 + base * 0.45, true), 0.55, 0.02)).then(() => {
        m.removeFromParent();
        if (i === meshes.length - 1 && ger === geracaoPilha) montarPilha(n);
      });
    });
    if (!meshes.length) montarPilha(n);
  }
  function limpar(meshes: THREE.Mesh[], n: number, para: THREE.Vector3): void {
    const todas = [...meshes, ...pilhaMeshes];
    pilhaMeshes = [];
    const ger = ++geracaoPilha;
    todas.forEach((m, i) => {
      soltarDaMao(m);
      void anim.esperar(i * 0.03).then(() => voar(m, para.clone().setY(TOPO + 0.01), m.quaternion.clone(), 0.4, 0.03)).then(() => {
        m.removeFromParent();
        if (m.geometry !== baralho.geo) m.geometry.dispose();
      });
    });
    if (n > 0) void anim.esperar(0.45).then(() => { if (ger === geracaoPilha) montarPilha(n); });
  }
  function sumir(meshes: THREE.Mesh[]): void {
    for (const m of meshes) {
      soltarDaMao(m);
      void anim.animar(0.25, (k) => m.scale.setScalar(Math.max(0.01, 1 - k)), suave, m).then(() => m.removeFromParent());
    }
  }

  // ---------------------------------------------------------------- leques
  const posMonte = (): THREE.Vector3 => (estadoMonte ? MONTE[estadoMonte.pos].clone().setY(TOPO + 0.02) : V(0, TOPO + 0.02, 0));
  let estadoMonte: Estado3D['monte'] = null;

  function sincronizarLeque(p: Personagem, alvo: number, instantaneo: boolean): void {
    alvo = clamp(Math.round(alvo), 0, 12);
    while (p.cartas.length > alvo) {
      const c = p.cartas.pop()!;
      if (instantaneo || reduzido) c.pivo.removeFromParent();
      else void anim.animar(0.2, (k) => c.pivo.scale.setScalar(Math.max(0.01, 1 - k)), suave, c.pivo).then(() => c.pivo.removeFromParent());
    }
    arrumarLeque(p);
    let i = 0;
    while (p.cartas.length < alvo) {
      const c = adicionarCartaLeque(p, baralho);
      if (!instantaneo) distribuir(p, c, i++);
    }
  }
  function distribuir(p: Personagem, c: CartaLeque, i: number): void {
    const m = c.mesh;
    m.visible = false;
    void anim.esperar(i * 0.14).then(() => {
      if (!p.cartas.includes(c)) return undefined;
      p.tronco.updateMatrixWorld(true);
      m.updateWorldMatrix(true, false);
      const fim = mesaGrupo.worldToLocal(m.getWorldPosition(V()));
      const qFim = m.getWorldQuaternion(new THREE.Quaternion());
      mesaGrupo.attach(m);
      m.position.copy(posMonte());
      m.quaternion.copy(quatPlano(PI, true));
      m.visible = true;
      return voar(m, fim, qFim, 0.38, 0.08).then(() => {
        if (!p.cartas.includes(c) || m.parent !== mesaGrupo) return;
        c.pivo.add(m);
        m.position.set(0, POSE_CARTA_LEQUE, 0);
        m.quaternion.identity();
      });
    });
  }
  function distribuirParaMim(qtd: number): void {
    for (let i = 0; i < qtd; i++) {
      const m = baralho.nova(null);
      m.visible = false;
      mesaGrupo.add(m);
      void anim.esperar(i * 0.14).then(() => {
        m.position.copy(posMonte());
        m.quaternion.copy(quatPlano(PI, true));
        m.visible = true;
        return voar(m, BORDA_PERTO.clone().add(V(0, 0.05, 0.12)), quatPlano(PI, true), 0.38, 0.06);
      }).then(() => m.removeFromParent());
    }
  }

  // ---------------------------------------------------------------- gritos
  async function trucarPersonagem(p: Personagem): Promise<void> {
    p.foco = camera.position.clone();
    const cima = (): THREE.Vector3 => p.tronco.localToWorld(V(0.24, 0.8, 0.14));
    const sobre = (): THREE.Vector3 => p.raiz.localToWorld(V(0.15, TOPO + 0.17, R_ASSENTO - MEIA + 0.08));
    const toca = (): THREE.Vector3 => p.raiz.localToWorld(V(0.15, TOPO + 0.044, R_ASSENTO - MEIA + 0.08));
    const ini = pontoMao(p.bracos[0]);
    await anim.animar(0.3, (k) => { p.pesoA = k; p.alvoA.lerpVectors(ini, cima(), k); p.inclinar = -0.05 * k; }, suave, p);
    await anim.animar(0.7, (k) => { p.alvoA.copy(cima()).add(V(0, Math.sin(k * PI * 4) * 0.025, 0)); }, linear, p);
    await anim.animar(0.22, (k) => { p.alvoA.lerpVectors(cima(), sobre(), k); p.inclinar = -0.05 + 0.2 * k; }, suave, p);
    for (let i = 0; i < 2; i++) {
      await anim.animar(0.08, (k) => { p.alvoA.lerpVectors(sobre(), toca(), k); }, entrada, p);
      tremer(0.6);
      await anim.animar(0.15, (k) => { p.alvoA.lerpVectors(toca(), sobre(), k); }, saida, p);
    }
    await anim.animar(0.4, (k) => { p.pesoA = 1 - k; p.inclinar = 0.15 * (1 - k); }, suave, p);
    p.foco = null;
  }
  async function baterPersonagem(p: Personagem, forca: number): Promise<void> {
    const sobre = (): THREE.Vector3 => p.raiz.localToWorld(V(0.15, TOPO + 0.15, R_ASSENTO - MEIA + 0.08));
    const toca = (): THREE.Vector3 => p.raiz.localToWorld(V(0.15, TOPO + 0.044, R_ASSENTO - MEIA + 0.08));
    const ini = pontoMao(p.bracos[0]);
    await anim.animar(0.18, (k) => { p.pesoA = k; p.alvoA.lerpVectors(ini, sobre(), k); }, suave, p);
    await anim.animar(0.08, (k) => { p.alvoA.lerpVectors(sobre(), toca(), k); }, entrada, p);
    tremer(forca);
    await anim.animar(0.3, (k) => { p.alvoA.lerpVectors(toca(), sobre(), k); p.pesoA = 1 - k; }, saida, p);
  }
  let maoOcupada = false;
  async function baterMinha(vezes: number, erguer: boolean, forca: number): Promise<void> {
    if (maoOcupada) { tremer(forca); return; }
    maoOcupada = true;
    if (erguer) {
      await anim.animar(0.3, (k) => maoD.position.copy(maoDBase).add(V(0, 0.16 * k, -0.04 * k)), suave, maoD);
      await anim.esperar(0.6);
    }
    for (let i = 0; i < vezes; i++) {
      await anim.animar(0.12, (k) => maoD.position.copy(maoDBase).add(V(0, 0.09 * (1 - k), -0.04)), entrada, maoD);
      tremer(forca);
      await anim.animar(0.15, (k) => maoD.position.copy(maoDBase).add(V(0, 0.09 * k, -0.04)), saida, maoD);
    }
    await anim.animar(0.25, (k) => maoD.position.copy(maoDBase).add(V(0, 0.09 * (1 - k), -0.04 * (1 - k))), suave, maoD);
    maoOcupada = false;
  }

  // ---------------------------------------------------------------- atualizar
  let anterior: Estado3D | null = null;
  let destruido = false;

  // Verso do baralho: o de quem deu (item da loja). Só redesenha quando muda (no máximo 1x por mão).
  let chaveVerso = '';
  function aplicarVerso(v: Estado3D['verso']): void {
    const chave = v ? `${v.cor}|${v.linha}` : '';
    if (chave === chaveVerso) return;
    chaveVerso = chave;
    const antiga = baralho.verso.map;
    baralho.verso.map = v ? texturaVerso(v.cor, v.linha) : tx.verso;
    baralho.verso.needsUpdate = true;
    if (antiga && antiga !== tx.verso) antiga.dispose();
  }

  function atualizar(e: Estado3D): void {
    if (destruido) return;
    aplicarVerso(e.verso ?? null);
    const primeiro = anterior === null;
    const ant = new Map<Posicao, Jogador3D>((anterior?.jogadores ?? []).map((j) => [j.pos, j]));

    // mesa
    const plasticoVisivel = e.plastico || e.aparenciaMesa === 'plastico';
    mesas.madeira.visible = !plasticoVisivel && e.aparenciaMesa !== 'feltro';
    mesas.feltro.visible = !plasticoVisivel && e.aparenciaMesa === 'feltro';
    mesas.plastico.visible = plasticoVisivel;
    for (const m of pecasCadeira) m.material = plasticoVisivel ? mesas.matPlastico : mesas.matMadeiraEsc;

    // personagens
    for (const j of e.jogadores) {
      if (j.pos === 'baixo') continue;
      const p = garantirPersonagem(j.pos, j.nome, j.roupa);
      apagar(p, j.caiu);
    }

    // vira e monte
    estadoMonte = e.monte;
    const ondeMonte = e.monte ? MONTE[e.monte.pos] : MONTE.baixo;
    if (e.monte && e.monte.qtd > 0) {
      const alt = Math.max(0.002, e.monte.qtd * 0.0009);
      monte.visible = true;
      monte.scale.set(1, 1, alt);
      monte.quaternion.copy(quatPlano(PI + 0.25, true));
      monte.position.copy(ondeMonte).setY(TOPO + alt / 2 + 0.0025);
    } else monte.visible = false;
    if (e.vira) {
      const id = `${e.vira.valor}${e.vira.naipe}`;
      if (id !== viraId) { baralho.definirFace(vira, e.vira); viraId = id; }
      vira.visible = true;
      vira.quaternion.copy(quatPlano(PI + 0.25 + PI / 2));
      // meio para fora do monte, apontando para o centro da mesa
      const paraCentro = ondeMonte.clone().setY(0).normalize().multiplyScalar(-0.06);
      vira.position.copy(ondeMonte).add(paraCentro).setY(ALTURA_CARTA);
    } else { vira.visible = false; viraId = ''; }

    // jogadas que saíram do centro
    const chaves = new Set(e.jogadas.map((j) => j.chave));
    const saindo: THREE.Mesh[] = [];
    for (const [k, m] of centro) if (!chaves.has(k)) { saindo.push(m); centro.delete(k); donoDa.delete(k); }
    const fimDeMao = e.jogadas.length === 0 && e.pilha === 0;
    if (primeiro) montarPilha(e.pilha);
    else if (e.pilha > pilhaN) recolher(saindo, e.pilha);
    else if (e.pilha < pilhaN || (fimDeMao && (saindo.length > 0 || pilhaMeshes.length > 0))) limpar(saindo, e.pilha, ondeMonte);
    else if (saindo.length) sumir(saindo);
    pilhaN = e.pilha;

    // jogadas novas
    for (const j of e.jogadas) {
      if (centro.has(j.chave)) continue;
      const m = criarJogada(j, primeiro);
      centro.set(j.chave, m);
      donoDa.set(j.chave, j.pos);
    }

    // leques
    for (const j of e.jogadores) {
      if (j.pos === 'baixo') {
        const antes = ant.get('baixo')?.qtdCartas ?? 0;
        if (!primeiro && j.qtdCartas > antes && e.monte) distribuirParaMim(j.qtdCartas - antes);
        continue;
      }
      const p = personagens[j.pos];
      if (p) sincronizarLeque(p, j.qtdCartas, primeiro);
    }

    // vez
    const daVez = e.jogadores.find((j) => j.daVez);
    if (daVez) {
      const destino = posVez(daVez.pos);
      if (!vez.visible || primeiro || reduzido) { vez.position.copy(destino); vezDe.copy(destino); vezPara.copy(destino); vezK = 1; }
      else if (!vezPara.equals(destino)) { vezDe.copy(vez.position); vezPara.copy(destino); vezK = 0; }
      vez.visible = true;
      rotuloVez.visible = true;
      nomeVez.textContent = daVez.pos === 'baixo' ? 'Sua vez' : daVez.nome;
      if (daVez.segundos === null) segVez.style.display = 'none';
      else { segVez.style.display = ''; segVez.textContent = String(Math.max(0, Math.ceil(daVez.segundos))); }
    } else { vez.visible = false; rotuloVez.visible = false; }

    // falas e gritos
    for (const j of e.jogadores) {
      const a = ant.get(j.pos);
      if ((a?.fala ?? null) !== j.fala) mostrarBalao(j.pos, j.fala);
      const novoGrito = j.gritando && j.fala !== null && (!a?.gritando || a.fala !== j.fala);
      if (novoGrito && !primeiro) {
        if (j.pos === 'baixo') void baterMinha(2, true, 0.6);
        else { const p = personagens[j.pos]; if (p) naFila(p, () => trucarPersonagem(p)); }
      }
    }
    anterior = e;
  }

  function bater(pos: Posicao, forca: number): void {
    if (destruido) return;
    const f = clamp(forca, 0, 1);
    if (pos === 'baixo') { void baterMinha(1, false, f); return; }
    const p = personagens[pos];
    if (p && !reduzido && !(ocupados.get(p) ?? 0)) naFila(p, () => baterPersonagem(p, f));
    else tremer(f);
  }

  // ---------------------------------------------------------------- câmera travada na cadeira
  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enablePan = false;
  controles.enableZoom = false;
  controles.enableDamping = !reduzido;
  controles.dampingFactor = 0.08;
  controles.rotateSpeed = 0.35;
  const GIRO = 0.14, INCLINA = 0.1;
  controles.minAzimuthAngle = -GIRO;
  controles.maxAzimuthAngle = GIRO;
  function vistaPadrao(a: number): { fov: number; pos: THREE.Vector3; alvo: THREE.Vector3 } {
    if (a >= 1.3) return { fov: 57, pos: V(0, 1.36, 1.2), alvo: V(0, 0.9, -0.12) };
    const k = clamp((1.3 - a) / 0.75, 0, 1); // 0 = largo, 1 = celular estreito
    return { fov: lerp(57, 70, k), pos: V(0, lerp(1.36, 1.46, k), lerp(1.2, 1.88, k)), alvo: V(0, lerp(0.9, 0.97, k), -0.1) };
  }
  function aplicarVista(): void {
    const w = largura(), h = altura();
    camera.aspect = w / h;
    const v = vistaPadrao(camera.aspect);
    camera.fov = v.fov;
    camera.updateProjectionMatrix();
    controles.minPolarAngle = 0;
    controles.maxPolarAngle = PI;
    controles.minDistance = 0;
    controles.maxDistance = Infinity;
    camera.position.copy(v.pos);
    controles.target.copy(v.alvo);
    controles.update();
    const polar = controles.getPolarAngle();
    controles.minPolarAngle = polar - INCLINA;
    controles.maxPolarAngle = polar + INCLINA;
    const d = camera.position.distanceTo(controles.target);
    controles.minDistance = d;
    controles.maxDistance = d;
  }
  aplicarVista();
  let ultimoTam = `${largura()}x${altura()}`;
  const observador = new ResizeObserver(() => {
    const tam = `${largura()}x${altura()}`;
    if (tam === ultimoTam) return;
    ultimoTam = tam;
    renderer.setSize(largura(), altura(), false);
    rotulos.setSize(largura(), altura());
    aplicarVista();
  });
  observador.observe(container);

  // ---------------------------------------------------------------- laço
  const relogio = new THREE.Clock();
  function quadro(): void {
    const dt = Math.min(relogio.getDelta(), 0.05);
    anim.passo(dt);
    const t = anim.relogio;
    for (const o of OUTROS) { const p = personagens[o]; if (p) viver(p, dt, t, !reduzido, ctx); }
    viver(palpiteiro, dt, t, !reduzido, ctx);
    if (!reduzido) {
      proxGole -= dt;
      if (proxGole <= 0 && goleT <= 0) { goleT = 1.6; proxGole = 6 + rnd() * 4; }
    }
    let gole = 0;
    if (goleT > 0) { goleT = Math.max(0, goleT - dt); gole = Math.sin((1 - goleT / 1.6) * PI); }
    viverEmPe(palpiteiro, copoPalp, basePalp, gole);

    vezK = Math.min(1, vezK + dt * 2.2);
    vez.position.lerpVectors(vezDe, vezPara, suave(vezK));
    const pulso = reduzido ? 1 : 0.5 + 0.5 * Math.sin(t * 4);
    anel.scale.setScalar(1 + pulso * 0.08);
    (brilho.material as THREE.MeshBasicMaterial).opacity = 0.55 + pulso * 0.45;

    if (tremor > 0.0002) {
      mesaGrupo.position.set((rnd() - 0.5) * tremor, (rnd() - 0.5) * tremor * 0.4, (rnd() - 0.5) * tremor);
      tremor *= Math.exp(-dt * 14);
    } else mesaGrupo.position.set(0, 0, 0);

    controles.update();
    renderer.render(cena, camera);
    rotulos.render(cena, camera);
  }
  const visibilidade = (): void => {
    if (destruido) return;
    if (document.hidden) renderer.setAnimationLoop(null);
    else { relogio.getDelta(); renderer.setAnimationLoop(quadro); }
  };
  document.addEventListener('visibilitychange', visibilidade);
  renderer.setAnimationLoop(document.hidden ? null : quadro);

  // ---------------------------------------------------------------- destruir
  function destruir(): void {
    if (destruido) return;
    destruido = true;
    renderer.setAnimationLoop(null);
    document.removeEventListener('visibilitychange', visibilidade);
    observador.disconnect();
    controles.dispose();
    anim.parar();
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const texs = new Set<THREE.Texture>();
    cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      geos.add(m.geometry);
      for (const mm of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mm);
    });
    for (const mm of mats) {
      const s = mm as THREE.MeshStandardMaterial;
      if (s.map) texs.add(s.map);
      if (s.emissiveMap) texs.add(s.emissiveMap);
    }
    for (const t of Object.values(tx)) texs.add(t as THREE.Texture);
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((t) => t.dispose());
    baralho.descartar();
    renderer.dispose();
    renderer.domElement.remove();
    rotulos.domElement.remove();
    centro.clear();
  }

  const api: Cena3D = { atualizar, bater, destruir };
  return api;
};

