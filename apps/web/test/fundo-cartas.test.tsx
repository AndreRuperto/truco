import type React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FundoCartas } from '../src/componentes/FundoCartas';
import {
  aproximar,
  atrasosDaDistribuicao,
  CARTAS_SOLTAS,
  CHAVE_CARTAS_DADAS,
  DAR_PASSO,
  DAR_PAUSA,
  mexidaDaCarta,
  PARADA,
  parada,
  vaiDarCartas,
} from '../src/logica/fundoCartas';

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

  test('discreto (telas internas): só as cartas das bordas, longe do texto do meio', () => {
    const { container } = render(<FundoCartas discreto />);
    const camada = container.querySelector('.fundo-cartas.discreto')!;
    const soltas = [...camada.querySelectorAll<HTMLElement>('[data-solta]')];
    expect(soltas.length).toBeGreaterThan(4);
    expect(soltas.length).toBeLessThan(CARTAS_SOLTAS.length);
    for (const el of soltas) {
      const x = Number.parseFloat(el.style.left);
      expect(x < 20 || x > 80).toBe(true);
    }
  });
});

describe('giro 3D no lobby', () => {
  afterEach(() => vi.restoreAllMocks());

  test('renderiza frente e verso em cada carta', () => {
    const { container } = render(<FundoCartas />);
    const giratorias = container.querySelectorAll('.carta-solta-gira');
    expect(giratorias).toHaveLength(CARTAS_SOLTAS.length);
    giratorias.forEach((el) => {
      expect(el.querySelectorAll('.carta')).toHaveLength(2);
      expect(el.querySelector('.carta.verso')).toBeInTheDocument();
    });
  });

  test('duplo clique sobre uma carta aciona o giro, mas não sobre controles', () => {
    const matchMediaOriginal = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    const animar = vi.fn().mockReturnValue({ cancel: vi.fn() });
    const animacoes = vi.fn().mockReturnValue([]);
    const animateOriginal = Element.prototype.animate;
    const getAnimationsOriginal = Element.prototype.getAnimations;
    Element.prototype.animate = animar;
    Element.prototype.getAnimations = animacoes;
    const rectOriginal = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      // A carta desenhada (camada da flutuação) cobre o ponto do clique.
      if ((this as Element).classList.contains('carta-solta-flutua')) {
        return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => ({}) };
      }
      return rectOriginal.call(this);
    };
    try {
      const { container } = render(<div><FundoCartas /><button type="button">Jogar</button></div>);
      // A abertura pode ter distribuído as cartas: conta só o que o duplo clique acrescenta.
      const antes = animar.mock.calls.length;
      fireEvent.dblClick(container.querySelector('.fundo-cartas')!, { clientX: 100, clientY: 100 });
      expect(animar).toHaveBeenCalledTimes(antes + 1);
      fireEvent.dblClick(container.querySelector('button')!, { clientX: 100, clientY: 100 });
      expect(animar).toHaveBeenCalledTimes(antes + 1);
    } finally {
      window.matchMedia = matchMediaOriginal;
      Element.prototype.animate = animateOriginal;
      Element.prototype.getAnimations = getAnimationsOriginal;
      Element.prototype.getBoundingClientRect = rectOriginal;
    }
  });
});

describe('duplo clique segue a carta onde ela está na tela', () => {
  test('vale o lugar visível (empurrada pelo mouse, flutuando), não a posição de origem', () => {
    const matchMediaOriginal = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    const animar = vi.fn().mockReturnValue({ cancel: vi.fn() });
    const animateOriginal = Element.prototype.animate;
    const getAnimationsOriginal = Element.prototype.getAnimations;
    Element.prototype.animate = animar;
    Element.prototype.getAnimations = vi.fn().mockReturnValue([]);
    const rectOriginal = Element.prototype.getBoundingClientRect;
    const caixa = (l: number, t: number) => ({ x: l, y: t, left: l, top: t, right: l + 100, bottom: t + 145, width: 100, height: 145, toJSON: () => ({}) });
    const longe = { x: -999, y: -999, left: -999, top: -999, right: -990, bottom: -990, width: 9, height: 9, toJSON: () => ({}) };
    Element.prototype.getBoundingClientRect = function () {
      const el = this as Element;
      const solta = el.closest('[data-solta]');
      // Só a primeira carta está na tela: origem em (0,0), mas desenhada em (60,0) pela mexida do mouse.
      if (!solta || solta !== document.querySelector('[data-solta]')) return el.hasAttribute('data-solta') || solta ? longe : rectOriginal.call(el);
      if (el.hasAttribute('data-solta')) return caixa(0, 0);
      return caixa(60, 0);
    };
    try {
      const { container } = render(<FundoCartas />);
      const camada = container.querySelector('.fundo-cartas')!;
      const antes = animar.mock.calls.length;
      // Na ponta direita da carta como ela aparece (fora da posição de origem): gira.
      fireEvent.dblClick(camada, { clientX: 150, clientY: 70 });
      expect(animar).toHaveBeenCalledTimes(antes + 1);
      // No espaço vazio de onde ela saiu: não gira.
      fireEvent.dblClick(camada, { clientX: 20, clientY: 70 });
      expect(animar).toHaveBeenCalledTimes(antes + 1);
    } finally {
      window.matchMedia = matchMediaOriginal;
      Element.prototype.animate = animateOriginal;
      Element.prototype.getAnimations = getAnimationsOriginal;
      Element.prototype.getBoundingClientRect = rectOriginal;
    }
  });
});

describe('duplo clique pergunta ao navegador qual carta está desenhada no ponto', () => {
  test('gira a carta que o navegador diz estar no ponto (inclinada, empurrada), mesmo com outra na frente pela caixa', () => {
    const matchMediaOriginal = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    const animateOriginal = Element.prototype.animate;
    const getAnimationsOriginal = Element.prototype.getAnimations;
    const animados: Element[] = [];
    Element.prototype.animate = function (this: Element) {
      animados.push(this);
      return { cancel: vi.fn() } as unknown as Animation;
    };
    Element.prototype.getAnimations = vi.fn().mockReturnValue([]);
    const doc = document as Document & { elementsFromPoint?: Document['elementsFromPoint'] };
    const original = doc.elementsFromPoint;
    let medindo: boolean[] = [];
    try {
      const { container } = render(<FundoCartas />);
      const camada = container.querySelector('.fundo-cartas')!;
      const soltas = container.querySelectorAll('[data-solta]');
      const terceira = soltas[2];
      doc.elementsFromPoint = vi.fn(() => {
        // Só durante a medição as cartas recebem o ponteiro (classe `medindo` na camada).
        medindo.push(camada.classList.contains('medindo'));
        return [document.body, terceira.querySelector('.carta')!];
      }) as Document['elementsFromPoint'];
      animados.length = 0;
      medindo = [];
      fireEvent.dblClick(camada, { clientX: 10, clientY: 10 });
      expect(animados).toEqual([terceira.querySelector('.carta-solta-gira')]);
      expect(medindo).toEqual([true]);
      expect(camada).not.toHaveClass('medindo');
      // Nada do fundo no ponto: nenhuma gira.
      doc.elementsFromPoint = vi.fn(() => [document.body]) as Document['elementsFromPoint'];
      fireEvent.dblClick(camada, { clientX: 10, clientY: 10 });
      expect(animados).toHaveLength(1);
    } finally {
      doc.elementsFromPoint = original as Document['elementsFromPoint'];
      window.matchMedia = matchMediaOriginal;
      Element.prototype.animate = animateOriginal;
      Element.prototype.getAnimations = getAnimationsOriginal;
    }
  });
});

describe('duplo clique com movimento reduzido', () => {
  test('vira a carta na hora (sem animação) e desvira no próximo duplo clique', () => {
    const matchMediaOriginal = window.matchMedia;
    window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce') })) as unknown as typeof window.matchMedia;
    const animateOriginal = Element.prototype.animate;
    const animar = vi.fn();
    Element.prototype.animate = animar;
    const rectOriginal = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if ((this as Element).classList.contains('carta-solta-flutua') && (this as Element).closest('[data-solta]') === document.querySelector('[data-solta]'))
        return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => ({}) };
      return { x: -999, y: -999, left: -999, top: -999, right: -990, bottom: -990, width: 9, height: 9, toJSON: () => ({}) };
    };
    try {
      const { container } = render(<FundoCartas />);
      const gira = container.querySelector('[data-solta] .carta-solta-gira')!;
      fireEvent.dblClick(container.querySelector('.fundo-cartas')!, { clientX: 100, clientY: 100 });
      expect(gira).toHaveClass('outro-lado');
      fireEvent.dblClick(container.querySelector('.fundo-cartas')!, { clientX: 100, clientY: 100 });
      expect(gira).not.toHaveClass('outro-lado');
      expect(animar).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = matchMediaOriginal;
      Element.prototype.animate = animateOriginal;
      Element.prototype.getBoundingClientRect = rectOriginal;
    }
  });
});

describe('distribuição na abertura', () => {
  test('primeira visita do dia sempre; depois, só no sorteio de 1 em 5', () => {
    expect(vaiDarCartas('2026-11-08', null, 0.99)).toBe(true);
    expect(vaiDarCartas('2026-11-08', '2026-11-07', 0.99)).toBe(true);
    expect(vaiDarCartas('2026-11-08', '2026-11-08', 0.99)).toBe(false);
    expect(vaiDarCartas('2026-11-08', '2026-11-08', 0.1)).toBe(true);
  });

  test('a carta de cima do monte (mais perto) sai primeiro', () => {
    expect(atrasosDaDistribuicao([0.2, 1, 0.5])).toEqual([DAR_PAUSA + 2 * DAR_PASSO, DAR_PAUSA, DAR_PAUSA + DAR_PASSO]);
  });

  function comAnimacao(reduzido: boolean, rodar: (animar: ReturnType<typeof vi.fn>) => void) {
    const matchMediaOriginal = window.matchMedia;
    const animateOriginal = Element.prototype.animate;
    window.matchMedia = vi.fn((q: string) => ({ matches: reduzido && q.includes('reduced-motion') })) as unknown as typeof window.matchMedia;
    const animar = vi.fn().mockReturnValue({ cancel: vi.fn(), finished: Promise.resolve() });
    Element.prototype.animate = animar;
    try {
      rodar(animar);
    } finally {
      window.matchMedia = matchMediaOriginal;
      Element.prototype.animate = animateOriginal;
      localStorage.removeItem(CHAVE_CARTAS_DADAS);
    }
  }

  test('na primeira visita, cada carta sai do monte e desvira (menos as que ficam viradas); marca o dia', () => {
    localStorage.removeItem(CHAVE_CARTAS_DADAS);
    comAnimacao(false, (animar) => {
      render(<FundoCartas />);
      // um voo por carta e um desvirar por carta que fica de face para cima
      const viradas = CARTAS_SOLTAS.filter((c) => c.virada).length;
      expect(viradas).toBeGreaterThan(0);
      expect(animar).toHaveBeenCalledTimes(CARTAS_SOLTAS.length * 2 - viradas);
      expect(localStorage.getItem(CHAVE_CARTAS_DADAS)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  test('com movimento reduzido, nas telas internas ou já distribuídas hoje: nada se mexe', () => {
    localStorage.removeItem(CHAVE_CARTAS_DADAS);
    comAnimacao(true, (animar) => {
      render(<FundoCartas />);
      expect(animar).not.toHaveBeenCalled();
    });
    comAnimacao(false, (animar) => {
      render(<FundoCartas discreto />);
      expect(animar).not.toHaveBeenCalled();
    });
    comAnimacao(false, (animar) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      render(<FundoCartas />);
      const primeira = animar.mock.calls.length;
      render(<FundoCartas />);
      expect(animar.mock.calls.length).toBe(primeira);
      vi.restoreAllMocks();
    });
  });
});

describe('FundoCartas com o baralho equipado', () => {
  const listra = { style: { '--verso': '#b8202a', '--verso-linha': '#fbf3dc' } as React.CSSProperties, estampa: 'listra' };

  test('o verso equipado vale para as cartas do fundo (estampa e cores)', () => {
    const { container } = render(<FundoCartas verso={listra} />);
    const camada = container.querySelector<HTMLElement>('.fundo-cartas')!;
    expect(camada).toHaveAttribute('data-verso', 'listra');
    expect(camada.style.getPropertyValue('--verso')).toBe('#b8202a');
    expect(camada.style.getPropertyValue('--verso-linha')).toBe('#fbf3dc');
  });

  test('sem baralho equipado, fica o verso clássico', () => {
    const { container } = render(<FundoCartas />);
    expect(container.querySelector('.fundo-cartas')).not.toHaveAttribute('data-verso');
  });

  test('algumas cartas ficam viradas para baixo: o baralho aparece sem precisar girar', () => {
    const { container } = render(<FundoCartas verso={listra} />);
    const viradas = container.querySelectorAll('[data-solta][data-virada]');
    expect(viradas).toHaveLength(CARTAS_SOLTAS.filter((c) => c.virada).length);
    expect(viradas.length).toBeGreaterThanOrEqual(3);
    for (const v of viradas) expect(v.querySelector('.carta-solta-gira')).toHaveClass('virada');
  });

  test('no modo discreto (telas internas) também sobra ao menos uma virada', () => {
    const { container } = render(<FundoCartas discreto verso={listra} />);
    expect(container.querySelectorAll('[data-solta][data-virada]').length).toBeGreaterThanOrEqual(1);
  });
});
