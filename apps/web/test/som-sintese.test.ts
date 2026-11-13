import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * F3.5 do plano MVP, com a síntese de verdade (o som.test.tsx troca sintese.ts por um mock):
 * nenhum som antes do primeiro gesto (o navegador exige; sem contexto, nada toca) e o som
 * nunca atrasa a ação (tudo é disparado e esquecido: nada devolve promessa nem espera rede).
 */
let criados = 0;
let nos = 0;

class AudioContextFalso {
  state: 'suspended' | 'running' = 'running';
  currentTime = 0;
  sampleRate = 8_000;
  destination = {};
  constructor() {
    criados++;
  }
  private no() {
    nos++;
    const n: Record<string, unknown> = {
      connect: () => n,
      start: () => {},
      stop: () => {},
      gain: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      frequency: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      Q: { value: 1 },
      type: '',
      buffer: null,
    };
    return n;
  }
  createGain() { return this.no(); }
  createOscillator() { return this.no(); }
  createBiquadFilter() { return this.no(); }
  createBufferSource() { return this.no(); }
  createBuffer(_c: number, n: number) { return { getChannelData: () => new Float32Array(n) }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve({}); }
}

beforeEach(() => {
  criados = 0;
  nos = 0;
  vi.resetModules();
  vi.stubGlobal('AudioContext', AudioContextFalso);
});
afterEach(() => vi.unstubAllGlobals());

describe('síntese de som', () => {
  test('antes do primeiro gesto nada toca: nem contexto, nem nó de áudio', async () => {
    const { sintetizar, tocarArquivo } = await import('../src/som/sintese');
    sintetizar('carta');
    sintetizar('truco');
    tocarArquivo('/vozes/truco.mp3');
    expect(criados).toBe(0);
    expect(nos).toBe(0);
  });

  test('depois do gesto (destravarAudio) o som toca', async () => {
    const { destravarAudio, sintetizar } = await import('../src/som/sintese');
    destravarAudio();
    expect(criados).toBe(1);
    const antes = nos;
    sintetizar('carta');
    expect(nos).toBeGreaterThan(antes);
  });

  test('o som não atrasa a ação: dispara e volta na hora, mesmo com a rede presa', async () => {
    const pendurado = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', pendurado);
    const { destravarAudio, sintetizar, tocarArquivo } = await import('../src/som/sintese');
    destravarAudio();
    expect(sintetizar('truco')).toBeUndefined();
    expect(tocarArquivo('/vozes/truco.mp3')).toBeUndefined();
    expect(pendurado).toHaveBeenCalledTimes(1);
  });
});
