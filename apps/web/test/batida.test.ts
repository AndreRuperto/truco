import { describe, expect, test } from 'vitest';
import type { BotaoAcao } from '../src/logica/acoes';
import {
  botaoBate,
  cargaPorTempo,
  forcaAoSoltar,
  gerarRachadura,
  paraRelativa,
  TEMPO_CARGA_MS,
  TOQUE_RAPIDO_MS,
} from '../src/logica/batida';

const botao = (chave: BotaoAcao['chave']): BotaoAcao => ({ chave, rotulo: '', acao: { tipo: 'truco', cadeira: 0 }, tom: 'principal' });
const mao = (nivel: number, proposto?: number) => ({ nivel, trucoPendente: proposto ? { dupla: 0, proposto } : null }) as never;

describe('batida: carga', () => {
  test('carrega de 0 a 1 em ~1,2 s e para no 1', () => {
    expect(TEMPO_CARGA_MS).toBe(1200);
    expect(cargaPorTempo(0)).toBe(0);
    expect(cargaPorTempo(600)).toBeCloseTo(0.5);
    expect(cargaPorTempo(1200)).toBe(1);
    expect(cargaPorTempo(5000)).toBe(1);
    expect(cargaPorTempo(-10)).toBe(0);
  });

  test('toque rápido não bate; segurar bate com a carga', () => {
    expect(forcaAoSoltar(TOQUE_RAPIDO_MS - 1)).toBeNull();
    expect(forcaAoSoltar(TOQUE_RAPIDO_MS)).toBeCloseTo(TOQUE_RAPIDO_MS / 1200);
    expect(forcaAoSoltar(2000)).toBe(1);
  });
});

describe('batida: quais botões batem', () => {
  test('seis, nove e doze batem; truco não; outros botões não', () => {
    expect(botaoBate(botao('truco'), mao(0))).toBe(false); // pedir truco
    expect(botaoBate(botao('truco'), mao(1))).toBe(true); // pedir seis com truco aceito
    expect(botaoBate(botao('aumentar'), mao(0, 1))).toBe(true); // truco pendente → seis
    expect(botaoBate(botao('aumentar'), mao(1, 3))).toBe(true); // nove pendente → doze
    expect(botaoBate(botao('aceitar'), mao(1, 3))).toBe(false);
    expect(botaoBate(botao('truco'), null)).toBe(false);
  });
});

describe('batida: posição relativa', () => {
  const embaixo = { x: 0.5, y: 0.9, angulo: 270 };
  test('a cadeira 0 vê o referencial absoluto como está', () => {
    expect(paraRelativa(embaixo, 0)).toEqual(embaixo);
  });
  test('quem bateu sempre aparece do lado certo para quem olha', () => {
    // a rachadura da cadeira 0 (embaixo no absoluto):
    const vista1 = paraRelativa(embaixo, 1); // para a cadeira 1, a 0 está à esquerda
    expect(vista1.x).toBeCloseTo(0.1);
    expect(vista1.y).toBeCloseTo(0.5);
    expect(vista1.angulo).toBe(0); // apontando para dentro (para a direita)
    const vista2 = paraRelativa(embaixo, 2); // parceiro: em cima
    expect(vista2.x).toBeCloseTo(0.5);
    expect(vista2.y).toBeCloseTo(0.1);
    const vista3 = paraRelativa(embaixo, 3); // para a 3, a 0 está à direita
    expect(vista3.x).toBeCloseTo(0.9);
    expect(vista3.angulo).toBe(180);
  });
  test('a rachadura de quem olha volta para baixo', () => {
    // cadeira 1 bateu: no absoluto ela fica à direita
    const daUm = { x: 0.9, y: 0.5, angulo: 180 };
    expect(paraRelativa(daUm, 1)).toEqual({ x: 0.5, y: expect.closeTo(0.9), angulo: 270 });
  });
});

describe('batida: desenho da rachadura', () => {
  test('determinística pela semente', () => {
    expect(gerarRachadura(42, 0.3)).toEqual(gerarRachadura(42, 0.3));
    expect(gerarRachadura(42, 0.3)).not.toEqual(gerarRachadura(43, 0.3));
  });
  test('linha principal irregular e 2–4 ramificações, na escala do tamanho', () => {
    for (const semente of [1, 2, 3, 99, 12345]) {
      const r = gerarRachadura(semente, 0.3);
      expect(r.principal.length).toBeGreaterThanOrEqual(5);
      expect(r.ramos.length).toBeGreaterThanOrEqual(2);
      expect(r.ramos.length).toBeLessThanOrEqual(4);
      const [x0, y0] = r.principal[0];
      expect([x0, y0]).toEqual([0, 0]);
      const fim = r.principal.at(-1)!;
      expect(fim[0]).toBeCloseTo(30, 0);
      // irregular: algum ponto sai do eixo
      expect(r.principal.some(([, y]) => Math.abs(y) > 0.3)).toBe(true);
    }
    const grande = gerarRachadura(7, 0.6).principal.at(-1)![0];
    const pequena = gerarRachadura(7, 0.2).principal.at(-1)![0];
    expect(grande).toBeGreaterThan(pequena * 2);
  });
});
