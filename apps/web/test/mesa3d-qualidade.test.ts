import { describe, expect, test } from 'vitest';
import { AJUSTES, FPS_MINIMO, JANELA_S, MedidorFps, nivelAbaixo, nivelInicial } from '../src/componentes/mesa3d/qualidade';

describe('nível inicial da cena 3D', () => {
  test('computador começa em alta e celular em média (o mesmo de antes: 2 e 1,5 pixel por ponto)', () => {
    expect(nivelInicial({ menorLado: 800, nucleos: 8 })).toBe('alta');
    expect(nivelInicial({ menorLado: 390, nucleos: 8 })).toBe('media');
    expect(AJUSTES.alta).toMatchObject({ pixels: 2, sombra: 1024, sombraSuave: true });
    expect(AJUSTES.media).toMatchObject({ pixels: 1.5, sombra: 512, sombraSuave: false });
  });

  test('aparelho fraco (2 núcleos ou 2 GB) começa em baixa: 1 pixel por ponto e sombra pequena', () => {
    expect(nivelInicial({ menorLado: 800, nucleos: 2 })).toBe('baixa');
    expect(nivelInicial({ menorLado: 390, memoria: 2 })).toBe('baixa');
    expect(AJUSTES.baixa).toMatchObject({ pixels: 1, sombra: 256 });
  });

  test('?qualidade= força o nível; valor estranho é ignorado', () => {
    expect(nivelInicial({ menorLado: 800, pedido: 'baixa' })).toBe('baixa');
    expect(nivelInicial({ menorLado: 390, pedido: 'alta' })).toBe('alta');
    expect(nivelInicial({ menorLado: 390, pedido: 'ultra' })).toBe('media');
  });

  test('desce um nível por vez e para em baixa', () => {
    expect(nivelAbaixo('alta')).toBe('media');
    expect(nivelAbaixo('media')).toBe('baixa');
    expect(nivelAbaixo('baixa')).toBeNull();
  });
});

describe('MedidorFps', () => {
  /** Simula `segundos` de quadros a `fps`; devolve quantas vezes pediu para descer. */
  function rodar(m: MedidorFps, fps: number, segundos: number): number {
    let pedidos = 0;
    for (let t = 0; t < segundos; t += 1 / fps) if (m.registrar(1 / fps)) pedidos++;
    return pedidos;
  }

  test('ignora a primeira janela (shaders compilando) e desce quando a média fica abaixo do mínimo', () => {
    const m = new MedidorFps(false);
    expect(rodar(m, 10, JANELA_S + 0.1)).toBe(0);
    expect(rodar(m, 10, JANELA_S)).toBe(1);
  });

  test(`a ${FPS_MINIMO + 6} FPS não desce`, () => {
    const m = new MedidorFps(false);
    expect(rodar(m, FPS_MINIMO + 6, JANELA_S * 4)).toBe(0);
  });

  test('nível forçado pela URL nunca muda', () => {
    const m = new MedidorFps(true);
    expect(rodar(m, 5, JANELA_S * 4)).toBe(0);
  });
});
