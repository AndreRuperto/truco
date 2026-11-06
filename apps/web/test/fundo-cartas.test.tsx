import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { FundoCartas } from '../src/componentes/FundoCartas';
import { aproximar, CARTAS_SOLTAS, mexidaDaCarta, PARADA, parada } from '../src/logica/fundoCartas';

const janela = { l: 1000, a: 800 };

describe('mexidaDaCarta', () => {
  test('sem ponteiro, a carta fica parada', () => {
    expect(mexidaDaCarta(1, { x: 100, y: 100 }, 80, null, janela)).toEqual(PARADA);
  });

  test('paralaxe: ponteiro à direita leva para a esquerda; carta de perto anda mais', () => {
    const longe = mexidaDaCarta(0.2, { x: 0, y: 0 }, 10, { x: 1000, y: 400 }, janela);
    const perto = mexidaDaCarta(1, { x: 0, y: 0 }, 10, { x: 1000, y: 400 }, janela);
    expect(perto.x).toBeLessThan(longe.x);
    expect(longe.x).toBeLessThan(0);
    expect(perto.y).toBeCloseTo(0);
    expect(perto.escala).toBe(1);
  });

  test('ponteiro em cima: a carta se afasta, gira e levanta; fora do alcance, não', () => {
    // ponteiro à esquerda do centro da carta: ela vai para a direita
    const perto = mexidaDaCarta(0, { x: 500, y: 400 }, 100, { x: 470, y: 400 }, janela);
    expect(perto.x).toBeGreaterThan(0);
    expect(perto.giro).toBeGreaterThan(0);
    expect(perto.escala).toBeGreaterThan(1);
    const fora = mexidaDaCarta(0, { x: 500, y: 400 }, 100, { x: 300, y: 400 }, janela);
    expect(fora.x).toBeCloseTo(0);
    expect(fora.y).toBeCloseTo(0);
    expect(fora.giro).toBe(0);
    expect(fora.escala).toBe(1);
  });

  test('aproximar converge e parada reconhece a chegada', () => {
    const alvo = { x: 10, y: -4, giro: 6, escala: 1.1 };
    let m = PARADA;
    for (let i = 0; i < 200; i++) m = aproximar(m, alvo, 0.14);
    expect(parada(m, alvo)).toBe(true);
    expect(parada(PARADA, alvo)).toBe(false);
  });
});

describe('FundoCartas', () => {
  test('decorativo: escondido da leitura de tela, uma carta por posição', () => {
    const { container } = render(<FundoCartas />);
    const camada = container.querySelector('.fundo-cartas');
    expect(camada).toHaveAttribute('aria-hidden', 'true');
    expect(camada?.querySelectorAll('[data-solta]')).toHaveLength(CARTAS_SOLTAS.length);
  });
});
