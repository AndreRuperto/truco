import * as THREE from 'three';
import type { Carta, Naipe } from '@truco/engine';

/** Paleta: os mesmos valores dos tokens de `estilos.css` e `estilos-mesa-fisica.css`. */
export const COR = {
  madeira: '#9a6337',
  madeiraFunda: '#5e3a1f',
  lousa: '#1f2b25',
  papel: '#fbf8f1',
  papelBorda: '#d9d1c0',
  tinta: '#1c1916',
  vermelho: '#b8202a',
  verso: '#7a1a22',
  versoLinha: '#c9767b',
  grito: '#e9b02c',
  plastico: '#f4c430',
  plasticoBorda: '#c99712',
  zVerde: '#1f5a36',
  zCreme: '#fbf3dc',
  pele: '#dcae86',
  coringaAzul: '#2f68b8',
  coringaRosa: '#d9478a',
  nos: '#3f9b66',
} as const;

const PI = Math.PI;

/** Gerador determinístico (mulberry32): a sala sai igual em toda abertura. */
export function semente(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Desenho = (g: CanvasRenderingContext2D, w: number, h: number) => void;

export function tela(w: number, h: number, desenhar: Desenho, repetir = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) desenhar(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function repetida(base: THREE.Texture, rx: number, ry: number): THREE.Texture {
  const t = base.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function retRedondo(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export interface Texturas {
  azulejo: THREE.CanvasTexture;
  reboco: THREE.CanvasTexture;
  piso: THREE.CanvasTexture;
  madeira: THREE.CanvasTexture;
  palha: THREE.CanvasTexture;
  xadrez: THREE.CanvasTexture;
  bolinhas: THREE.CanvasTexture;
  listras: THREE.CanvasTexture;
  rotulo: THREE.CanvasTexture;
  discoZapada: THREE.CanvasTexture;
  placa: THREE.CanvasTexture;
  lousa: THREE.CanvasTexture;
  brilho: THREE.CanvasTexture;
  verso: THREE.CanvasTexture;
}

export function criarTexturas(): Texturas {
  const rnd = semente(11);
  const ruido = (g: CanvasRenderingContext2D, w: number, h: number, n: number, alfa: number, claro = false): void => {
    const v = claro ? 255 : 0;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(${v},${v},${v},${rnd() * alfa})`;
      const s = 1 + rnd() * 3;
      g.fillRect(rnd() * w, rnd() * h, s, s);
    }
  };

  const azulejo = tela(256, 256, (g, w) => {
    const creme = '#e8dcc2', azul = '#2c5770', terra = '#a33a2a', ocre = '#d39c34';
    g.fillStyle = creme;
    g.fillRect(0, 0, w, w);
    for (const [x, y] of [[0, 0], [w, 0], [0, w], [w, w]]) {
      for (const [cor, r] of [[azul, 0.34], [creme, 0.25], [terra, 0.15], [ocre, 0.06]] as const) {
        g.fillStyle = cor;
        g.beginPath();
        g.arc(x, y, w * r, 0, PI * 2);
        g.fill();
      }
    }
    g.save();
    g.translate(w / 2, w / 2);
    for (let k = 0; k < 4; k++) {
      g.rotate(PI / 2);
      g.fillStyle = azul;
      g.beginPath();
      g.ellipse(0, -w * 0.15, w * 0.055, w * 0.13, 0, 0, PI * 2);
      g.fill();
      g.fillStyle = ocre;
      g.beginPath();
      g.ellipse(0, -w * 0.15, w * 0.02, w * 0.06, 0, 0, PI * 2);
      g.fill();
    }
    g.rotate(PI / 4);
    for (let k = 0; k < 4; k++) {
      g.rotate(PI / 2);
      g.fillStyle = terra;
      g.beginPath();
      g.moveTo(0, -w * 0.06);
      g.lineTo(w * 0.03, -w * 0.19);
      g.lineTo(0, -w * 0.24);
      g.lineTo(-w * 0.03, -w * 0.19);
      g.fill();
    }
    g.fillStyle = terra;
    g.beginPath();
    g.arc(0, 0, w * 0.06, 0, PI * 2);
    g.fill();
    g.fillStyle = creme;
    g.beginPath();
    g.arc(0, 0, w * 0.025, 0, PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(40,30,20,.45)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, w);
    ruido(g, w, w, 900, 0.09);
    ruido(g, w, w, 300, 0.12, true);
  }, true);

  const reboco = tela(256, 256, (g, w) => {
    g.fillStyle = '#6f8572';
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = rnd() * w, r = 10 + rnd() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = rnd() > 0.5 ? '255,250,230' : '20,25,15';
      gr.addColorStop(0, `rgba(${c},${0.05 + rnd() * 0.06})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ruido(g, w, w, 2500, 0.08);
    ruido(g, w, w, 1200, 0.06, true);
  }, true);

  const piso = tela(256, 256, (g, w) => {
    const h = w / 2;
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#d6c8ad' : '#7c3626';
        g.fillRect(i * h, j * h, h, h);
      }
    g.strokeStyle = 'rgba(20,10,5,.5)';
    g.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * h, 0); g.lineTo(i * h, w); g.stroke();
      g.beginPath(); g.moveTo(0, i * h); g.lineTo(w, i * h); g.stroke();
    }
    ruido(g, w, w, 2500, 0.14);
    ruido(g, w, w, 500, 0.08, true);
  }, true);

  const madeira = tela(512, 512, (g, w) => {
    g.fillStyle = COR.madeira;
    g.fillRect(0, 0, w, w);
    const tabua = w / 4;
    for (let p = 0; p < 4; p++) {
      const x0 = p * tabua;
      const tom = [0, 12, -8, 6][p];
      g.fillStyle = `rgba(${tom > 0 ? '255,220,170' : '40,20,5'},${Math.abs(tom) / 120})`;
      g.fillRect(x0, 0, tabua, w);
      for (let l = 0; l < 26; l++) {
        g.strokeStyle = `rgba(94,58,31,${0.12 + rnd() * 0.25})`;
        g.lineWidth = 0.6 + rnd() * 1.8;
        const bx = x0 + rnd() * tabua, fase = rnd() * 6, amp = 2 + rnd() * 5;
        g.beginPath();
        for (let y = 0; y <= w; y += 16) {
          const x = bx + Math.sin(y / 70 + fase) * amp;
          if (y) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      }
      if (rnd() > 0.3) {
        g.fillStyle = 'rgba(70,40,18,.55)';
        g.beginPath();
        g.ellipse(x0 + tabua * (0.3 + rnd() * 0.4), rnd() * w, 5, 11, 0, 0, PI * 2);
        g.fill();
      }
      g.fillStyle = COR.madeiraFunda;
      g.fillRect(x0, 0, 3, w);
    }
    ruido(g, w, w, 3000, 0.08);
    g.strokeStyle = 'rgba(60,35,15,.35)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(w * 0.82, w * 0.2, 30, 0.3, 5.6);
    g.stroke();
  });

  const palha = tela(128, 128, (g, w) => {
    g.fillStyle = '#d4b062';
    g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 6)
      for (let x = 0; x < w; x += 6) {
        g.fillStyle = ((x + y) / 6) % 2 ? 'rgba(120,80,20,.35)' : 'rgba(255,240,190,.3)';
        g.fillRect(x, y, 6, 3);
      }
  }, true);

  const xadrez = tela(128, 128, (g, w) => {
    g.fillStyle = '#8c2f24';
    g.fillRect(0, 0, w, w);
    g.fillStyle = 'rgba(20,10,10,.45)';
    for (let i = 0; i < w; i += 32) { g.fillRect(i, 0, 12, w); g.fillRect(0, i, w, 12); }
    g.fillStyle = 'rgba(240,210,160,.35)';
    for (let i = 20; i < w; i += 32) { g.fillRect(i, 0, 3, w); g.fillRect(0, i, w, 3); }
  }, true);

  const bolinhas = tela(128, 128, (g, w) => {
    g.fillStyle = '#2b7a78';
    g.fillRect(0, 0, w, w);
    g.fillStyle = '#f3ead6';
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.beginPath();
        g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 5, 0, PI * 2);
        g.fill();
      }
  }, true);

  const listras = tela(128, 128, (g, w) => {
    g.fillStyle = '#c9932a';
    g.fillRect(0, 0, w, w);
    g.fillStyle = 'rgba(60,30,10,.35)';
    for (let y = 0; y < w; y += 24) g.fillRect(0, y, w, 9);
  }, true);

  const rotuloZapada = (g: CanvasRenderingContext2D, w: number, h: number, x: number): void => {
    g.fillStyle = COR.zCreme;
    g.beginPath();
    g.ellipse(x, h / 2, w * 0.2, h * 0.42, 0, 0, PI * 2);
    g.fill();
    g.strokeStyle = COR.vermelho;
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = COR.zVerde;
    g.font = 'italic 900 34px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('Zapada', x, h / 2 + 8);
    g.font = '700 12px sans-serif';
    g.fillText('PILSEN', x, h / 2 + 28);
  };
  const rotulo = tela(256, 128, (g, w, h) => {
    g.fillStyle = COR.zVerde;
    g.fillRect(0, 0, w, h);
    g.fillStyle = COR.grito;
    g.fillRect(0, 8, w, 4);
    g.fillRect(0, h - 12, w, 4);
    rotuloZapada(g, w, h, w * 0.25);
    rotuloZapada(g, w, h, w * 0.75);
  });

  const discoZapada = tela(512, 512, (g, w) => {
    const c = w / 2;
    g.fillStyle = COR.zVerde;
    g.beginPath(); g.arc(c, c, c - 2, 0, PI * 2); g.fill();
    g.strokeStyle = COR.zCreme;
    g.lineWidth = 10;
    g.beginPath(); g.arc(c, c, c - 22, 0, PI * 2); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.arc(c, c, c - 40, 0, PI * 2); g.stroke();
    g.fillStyle = COR.zCreme;
    g.textAlign = 'center';
    g.font = 'italic 900 118px Georgia, serif';
    g.fillText('Zapada', c, c + 30);
    g.font = '700 30px sans-serif';
    g.fillText('CERVEJA DE BOTECO', c, c + 92);
    g.fillText('★  DESDE 1987  ★', c, c - 92);
    g.fillStyle = COR.grito;
    g.fillRect(c - 150, c + 48, 300, 6);
  });

  const placa = tela(512, 256, (g, w, h) => {
    g.fillStyle = COR.zVerde;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = COR.grito;
    g.lineWidth = 8;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = COR.zCreme;
    g.textAlign = 'center';
    g.font = 'italic 900 104px Georgia, serif';
    g.fillText('Zapada', w / 2, h / 2 + 20);
    g.font = '700 26px sans-serif';
    g.fillText('A GELADA DO BAIRRO', w / 2, h / 2 + 70);
  });

  const lousa = tela(384, 256, (g, w, h) => {
    g.fillStyle = COR.lousa;
    g.fillRect(0, 0, w, h);
    ruido(g, w, h, 1500, 0.05, true);
    g.fillStyle = 'rgba(239,234,223,.9)';
    g.textAlign = 'center';
    g.font = '700 38px "Comic Sans MS", "Segoe Print", cursive';
    g.fillText('TRUCO', w / 2, 62);
    g.font = '28px "Comic Sans MS", "Segoe Print", cursive';
    g.fillText('toda sexta • 20h', w / 2, 108);
    g.textAlign = 'left';
    g.fillText('Nós', 60, 168);
    g.fillText('Eles', 230, 168);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(239,234,223,.85)';
    const risca = (x: number, n: number): void => {
      for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(x + i * 12, 190); g.lineTo(x + i * 12 + 3, 228); g.stroke(); }
    };
    risca(60, 4);
    risca(230, 3);
    g.beginPath(); g.moveTo(192, 140); g.lineTo(192, 236); g.stroke();
  });

  const brilho = tela(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,214,110,.9)');
    gr.addColorStop(0.45, 'rgba(233,176,44,.35)');
    gr.addColorStop(1, 'rgba(233,176,44,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });

  const verso = tela(140, 200, (g, w, h) => {
    g.fillStyle = COR.papel;
    g.fillRect(0, 0, w, h);
    retRedondo(g, 8, 8, w - 16, h - 16, 8);
    g.fillStyle = COR.verso;
    g.fill();
    g.save();
    retRedondo(g, 8, 8, w - 16, h - 16, 8);
    g.clip();
    g.strokeStyle = COR.versoLinha;
    g.lineWidth = 2.2;
    for (let i = -h; i < w + h; i += 15) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
      g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke();
    }
    g.restore();
    g.strokeStyle = COR.versoLinha;
    g.lineWidth = 3;
    retRedondo(g, 15, 15, w - 30, h - 30, 6);
    g.stroke();
    g.fillStyle = COR.papel;
    g.beginPath();
    g.moveTo(w / 2, h / 2 - 18); g.lineTo(w / 2 + 12, h / 2); g.lineTo(w / 2, h / 2 + 18); g.lineTo(w / 2 - 12, h / 2);
    g.fill();
  });

  return { azulejo, reboco, piso, madeira, palha, xadrez, bolinhas, listras, rotulo, discoZapada, placa, lousa, brilho, verso };
}

// ---------------------------------------------------------------- faces das cartas
const SIMBOLO: Record<Naipe, string> = {
  ouros: '♦︎',
  espadas: '♠︎',
  copas: '♥︎',
  paus: '♣︎',
};
const FONTE_NAIPE = '"Segoe UI Symbol", "DejaVu Sans", "Apple Symbols", "Noto Sans Symbols2", sans-serif';

export const ehVermelha = (c: Carta): boolean => c.naipe === 'ouros' || c.naipe === 'copas';

/** Face desenhada em canvas: valor + naipe nos cantos e naipe grande no meio; coringa com chapéu de bobo. */
export function texturaFace(c: Carta): THREE.CanvasTexture {
  const cor = ehVermelha(c) ? COR.vermelho : COR.tinta;
  const simb = SIMBOLO[c.naipe];
  return tela(140, 200, (g, w, h) => {
    g.fillStyle = COR.papel;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = COR.papelBorda;
    g.lineWidth = 4;
    retRedondo(g, 3, 3, w - 6, h - 6, 10);
    g.stroke();
    const canto = (): void => {
      g.fillStyle = cor;
      g.textAlign = 'center';
      g.font = 'bold 40px Georgia, "Times New Roman", serif';
      g.fillText(c.valor === 'C' ? 'C' : c.valor, 26, 44);
      g.font = c.valor === 'C' ? `26px ${FONTE_NAIPE}` : `32px ${FONTE_NAIPE}`;
      g.fillText(c.valor === 'C' ? '★' : simb, 26, 74);
    };
    canto();
    g.save();
    g.translate(w, h);
    g.rotate(PI);
    canto();
    g.restore();
    if (c.valor === 'C') {
      desenharBobo(g, w, h, cor);
    } else {
      g.fillStyle = cor;
      g.textAlign = 'center';
      g.font = `86px ${FONTE_NAIPE}`;
      g.fillText(simb, w / 2 + 4, h / 2 + 30);
    }
  });
}

/** Chapéu de bobo de três pontas com guizos (as cores das fitas do coringa) e uma estrela. */
function desenharBobo(g: CanvasRenderingContext2D, w: number, h: number, cor: string): void {
  const cx = w / 2, base = h / 2 + 22;
  const pontas: Array<[number, number, string]> = [
    [cx - 38, base - 50, COR.coringaAzul],
    [cx, base - 70, cor],
    [cx + 38, base - 50, COR.coringaRosa],
  ];
  for (const [px, py, c] of pontas) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(cx - 30, base);
    g.quadraticCurveTo((cx + px) / 2 - 6, (base + py) / 2, px, py);
    g.quadraticCurveTo((cx + px) / 2 + 6, (base + py) / 2 + 8, cx + 30, base);
    g.closePath();
    g.fill();
    g.fillStyle = COR.grito;
    g.beginPath();
    g.arc(px, py, 7, 0, PI * 2);
    g.fill();
  }
  g.fillStyle = COR.grito;
  retRedondo(g, cx - 34, base - 4, 68, 12, 5);
  g.fill();
  g.fillStyle = cor;
  g.textAlign = 'center';
  g.font = `30px ${FONTE_NAIPE}`;
  g.fillText('★', cx, base + 44);
}
