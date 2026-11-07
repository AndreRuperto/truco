/**
 * Sons da mesa, sintetizados na hora (Web Audio): nada de arquivo para baixar nem licença.
 * Curtos e baixos: madeira, papel e um sino de boteco. Tudo passa por um ganho mestre, que
 * o botão "Som" zera.
 */
export type NomeSom =
  | 'carta'
  | 'embaralhar'
  | 'corte'
  | 'truco'
  | 'aceito'
  | 'corre'
  | 'familia'
  | 'rodadaNossa'
  | 'rodadaDeles'
  | 'cangou'
  | 'maoNossa'
  | 'maoDeles'
  | 'vitoria'
  | 'derrota'
  | 'vez'
  | 'tique'
  | 'tum'
  | 'grito';

const VOLUME = 0.45;

let ctx: AudioContext | null = null;
let mestre: GainNode | null = null;
let ruidoBuf: AudioBuffer | null = null;

/** O navegador só libera áudio depois de um toque/tecla: cria (ou retoma) o contexto aí. */
export function destravarAudio(): void {
  if (typeof AudioContext === 'undefined') return;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      mestre = ctx.createGain();
      mestre.gain.value = VOLUME;
      mestre.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function ruido(c: AudioContext): AudioBuffer {
  if (ruidoBuf) return ruidoBuf;
  const b = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (ruidoBuf = b);
}

/** Papel raspando: ruído filtrado com envelope curto. */
function raspar(c: AudioContext, t: number, dur: number, freq: number, vol: number): void {
  const fonte = c.createBufferSource();
  fonte.buffer = ruido(c);
  const filtro = c.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.setValueAtTime(freq, t);
  filtro.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  filtro.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fonte.connect(filtro).connect(g).connect(mestre!);
  fonte.start(t, Math.random() * 0.3, dur + 0.02);
}

/** Pancada de madeira (mesa): seno grave que cai rápido. */
function pancada(c: AudioContext, t: number, freq: number, vol: number, dur = 0.16): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.45, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(mestre!);
  o.start(t);
  o.stop(t + dur + 0.02);
  raspar(c, t, 0.03, 1800, vol * 0.25);
}

/** Nota de marimba/sino: seno com um harmônico e decaimento. */
function nota(c: AudioContext, t: number, freq: number, vol: number, dur = 0.35, tipo: OscillatorType = 'sine'): void {
  for (const [mult, v] of [
    [1, 1],
    [3.98, 0.18],
  ] as const) {
    const o = c.createOscillator();
    o.type = tipo;
    o.frequency.value = freq * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (mult === 1 ? 1 : 0.4));
    o.connect(g).connect(mestre!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** Metal de grito (truco): dente-de-serra filtrado, ataque forte. */
function grito(c: AudioContext, t: number, freq: number, vol: number, dur: number): void {
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = freq;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(700, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(mestre!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const audios = new Map<string, Promise<AudioBuffer | null>>();

/** Toca um áudio do site (as falas gravadas), pelo mesmo volume/botão "Som"; baixa e guarda na 1ª vez. */
export function tocarArquivo(url: string, atraso = 0): void {
  const c = ctx;
  if (!c || !mestre || c.state !== 'running') return;
  let carregando = audios.get(url);
  if (!carregando) {
    carregando = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => c.decodeAudioData(b))
      .catch(() => null);
    audios.set(url, carregando);
  }
  const pedidoEm = c.currentTime;
  void carregando.then((buf) => {
    // chegou tarde demais (rede lenta): a fala perdeu a hora, não toca
    if (!buf || !mestre || c.currentTime - pedidoEm > 1.5) return;
    const fonte = c.createBufferSource();
    fonte.buffer = buf;
    const g = c.createGain();
    g.gain.value = 1.6;
    fonte.connect(g).connect(mestre);
    fonte.start(Math.max(c.currentTime, pedidoEm + atraso));
  });
}

const DO = 523.25;
const MI = 659.25;
const SOL = 783.99;
const LA = 880;

/** Toca um som agora (+ `atraso` s). Sem contexto liberado ou com som desligado, nada. */
export function sintetizar(nome: NomeSom, atraso = 0, forca = 0.6): void {
  const c = ctx;
  if (!c || !mestre || c.state !== 'running') return;
  const t = c.currentTime + 0.01 + atraso;
  switch (nome) {
    case 'carta':
      raspar(c, t, 0.07, 2600, 0.5);
      pancada(c, t + 0.05, 180, 0.12, 0.06);
      break;
    case 'embaralhar':
      for (let i = 0; i < 22; i++) raspar(c, t + i * 0.018 + Math.random() * 0.006, 0.025, 3200 + Math.random() * 900, 0.22);
      break;
    case 'corte':
      raspar(c, t, 0.12, 1600, 0.35);
      pancada(c, t + 0.1, 140, 0.25);
      break;
    case 'truco':
      // As batidas na mesa; o grito vem da voz gravada (ou, sem ela, o metal sintetizado).
      pancada(c, t, 95, 0.6);
      pancada(c, t + 0.14, 95, 0.55);
      break;
    case 'grito':
      grito(c, t, 233, 0.12, 0.35);
      grito(c, t, 311, 0.08, 0.35);
      break;
    case 'aceito':
      nota(c, t, SOL, 0.3, 0.25);
      nota(c, t + 0.1, DO * 2, 0.3, 0.4);
      break;
    case 'corre':
      nota(c, t, MI, 0.25, 0.22);
      nota(c, t + 0.12, DO * 0.75, 0.25, 0.45);
      break;
    case 'familia':
      raspar(c, t, 0.18, 2200, 0.3);
      nota(c, t + 0.12, LA, 0.22, 0.3);
      break;
    case 'rodadaNossa':
      nota(c, t, DO, 0.28, 0.3);
      nota(c, t + 0.09, MI, 0.28, 0.4);
      break;
    case 'rodadaDeles':
      nota(c, t, MI * 0.75, 0.22, 0.3);
      nota(c, t + 0.11, DO * 0.75, 0.22, 0.45);
      break;
    case 'cangou':
      nota(c, t, SOL * 0.75, 0.22, 0.2);
      nota(c, t + 0.13, SOL * 0.75, 0.22, 0.3);
      break;
    case 'maoNossa':
      [DO, MI, SOL, DO * 2].forEach((f, i) => nota(c, t + i * 0.08, f, 0.28, 0.5));
      break;
    case 'maoDeles':
      [SOL * 0.75, MI * 0.75 * 0.944, DO * 0.75].forEach((f, i) => nota(c, t + i * 0.13, f, 0.22, 0.55));
      break;
    case 'vitoria':
      [DO, MI, SOL, DO * 2, SOL, DO * 2].forEach((f, i) => nota(c, t + i * 0.11, f, 0.32, i === 5 ? 1.2 : 0.4, 'triangle'));
      break;
    case 'derrota':
      [SOL * 0.75, MI * 0.7, DO * 0.66, DO * 0.5].forEach((f, i) => nota(c, t + i * 0.22, f, 0.22, 0.8, 'triangle'));
      break;
    case 'vez':
      nota(c, t, LA * 1.5, 0.18, 0.5);
      break;
    case 'tique':
      pancada(c, t, 900, 0.08, 0.03);
      break;
    case 'tum':
      pancada(c, t, 110, 0.35 + 0.5 * forca, 0.25);
      break;
  }
}
