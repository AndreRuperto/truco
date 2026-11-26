import { describe, expect, test } from 'vitest';
import { BARBAS, PENTEADOS } from '../src/componentes/mesa3d/cabelos';
import { criarPersonagem, viver, visualPorNome, type Contexto, type Visual } from '../src/componentes/mesa3d/personagens';
import type { Texturas } from '../src/componentes/mesa3d/texturas';
import * as THREE from 'three';

const NOMES = ['Bot Zé', 'Bot Tião', 'Bot Dita', 'Ana', 'Juninho', 'Rita', 'Seu Lula', 'Cida', 'Dona Neusa', 'Toninho', 'Bia', 'Marcão', 'Preta', 'Zeca', 'Lia', 'Bené', 'Tonho', 'Maria', 'Quinzinho', 'Lurdes'];
/** Visual sem estampa nem chapéu de palha: dispensa as texturas de canvas (jsdom não desenha). */
const LISO: Visual = { estilo: 'cabelo', penteado: 'topete', barba: 'cheia', sobrancelha: 'grossa', pele: '#c48d62', camisa: '#b8202a', calca: '#2a2a3a', cabelo: '#2a1a10', labios: '#7a3a2a' };
const TX = {} as Texturas;
const CTX: Contexto = { rnd: () => 0.5, mesa: new THREE.Group(), alvosOlhar: () => [] };

describe('cabelos e barbas trazidos do Conversa de Boteco', () => {
  test('o mesmo nome sempre dá o mesmo visual', () => {
    for (const n of NOMES) expect(visualPorNome(n)).toEqual(visualPorNome(` ${n.toUpperCase()} `));
  });

  test('vinte nomes dão pelo menos sete estilos de cabeça diferentes (antes eram cinco no total)', () => {
    const cabecas = new Set(NOMES.map((n) => { const v = visualPorNome(n); return v.estilo === 'cabelo' ? v.penteado : v.estilo; }));
    expect(cabecas.size).toBeGreaterThanOrEqual(7);
  });

  test('careca, boina e coque não ganham barba sorteada', () => {
    for (const n of NOMES) {
      const v = visualPorNome(n);
      if (v.estilo === 'careca' || v.estilo === 'boina' || v.estilo === 'coque') expect(v.barba).toBeUndefined();
      if (v.barba) expect(BARBAS).toContain(v.barba);
      if (v.estilo === 'cabelo') expect(PENTEADOS).toContain(v.penteado);
    }
  });

  test.each(PENTEADOS)('penteado %s monta peças presas à cabeça, acima do queixo', (penteado) => {
    const p = criarPersonagem('x', { ...LISO, penteado, barba: 'nenhuma' }, TX);
    const semCabelo = criarPersonagem('x', { ...LISO, penteado: undefined, barba: 'nenhuma' }, TX);
    expect(p.cabeca.children.length).toBeGreaterThan(semCabelo.cabeca.children.length + 1);
    const caixa = new THREE.Box3().setFromObject(p.cabeca);
    expect(caixa.max.y - caixa.min.y).toBeLessThan(0.45);
  });

  test('barba cheia põe a boca à frente dela', () => {
    const cheia = criarPersonagem('x', LISO, TX);
    const sem = criarPersonagem('x', { ...LISO, barba: 'nenhuma' }, TX);
    expect(cheia.boca.position.z).toBeGreaterThan(sem.boca.position.z);
  });
});

describe('boca que fala', () => {
  test('mexe enquanto o balão está aberto e fecha quando ele some', () => {
    const p = criarPersonagem('x', LISO, TX);
    p.falando = true;
    const aberturas = [0.1, 0.25, 0.4, 0.55].map((t) => { viver(p, 0.016, t, true, CTX); return p.boca.scale.y; });
    expect(Math.max(...aberturas)).toBeGreaterThan(1.5);
    p.falando = false;
    viver(p, 0.016, 0.7, true, CTX);
    expect(p.boca.scale.y).toBe(1);
  });

  test('com movimento reduzido fica parada', () => {
    const p = criarPersonagem('x', LISO, TX);
    p.falando = true;
    for (const t of [0.1, 0.25, 0.4]) { viver(p, 0.016, t, false, CTX); expect(p.boca.scale.y).toBe(1); }
  });
});
