import type { Cadeira } from '@truco/engine';
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { type Exibicao, jogadasNovas, rodadaRecolhida } from '../logica/jogadas';
import { type Posicao, posicaoRelativa } from '../logica/posicoes';

/*
 * Animações decorativas do centro da mesa: a mão que arremessa a carta e o recolher da rodada.
 * Tudo imperativo (Web Animations API) sobre o DOM que o React já montou: nada de estado, nada
 * de re-render, e nada bloqueia clique (pointer-events: none) nem atrasa a próxima jogada.
 */

export const DUR_VOO = 360;
export const DUR_RECUO = 150;
export const DUR_RECOLHER = 300;
const DUR_FADE = 120;
/** Arremesso: sai rápido e desacelera. */
const EASE_ARREMESSO = 'cubic-bezier(0.16, 0.84, 0.3, 1)';
/** Fração do voo em que a carta toca o pano (o resto é o "tapa": 1.06 → 1). */
const TOQUE = 0.82;

const ANGULO_MAO: Record<Posicao, number> = {
  baixo: 0,
  esquerda: 90,
  cima: 180,
  direita: -90,
};
const GIRO_INICIAL: Record<Posicao, number> = {
  baixo: -11,
  esquerda: -16,
  cima: 9,
  direita: 15,
};
const DIRECAO: Record<Posicao, [number, number]> = {
  baixo: [0, 1],
  cima: [0, -1],
  esquerda: [-1, 0],
  direita: [1, 0],
};

const SOMBRA_ALTA = '0 18px 22px rgba(11, 8, 6, 0.32), 0 6px 8px rgba(11, 8, 6, 0.22)';
const SOMBRA_TOQUE = '0 2px 2px rgba(11, 8, 6, 0.4), 0 5px 9px rgba(11, 8, 6, 0.45)';

/** Mão direita vista de costas, dedos dobrados sobre a borda da carta, punho e manga de camisa. */
const SVG_MAO = `<svg viewBox="0 0 100 130" aria-hidden="true" focusable="false">
<path class="manga" d="M19 104h63v26H19z"/>
<path class="pele" d="M31 78C20 74 10 64 10 54c0-8 8-10 12-5 3 5 7 11 12 13z"/>
<rect class="pele" x="26.5" y="17" width="12.5" height="38" rx="6.2"/>
<rect class="pele" x="39" y="10" width="13" height="44" rx="6.5"/>
<rect class="pele" x="52" y="13" width="12.5" height="41" rx="6.2"/>
<rect class="pele" x="64.5" y="22" width="11" height="32" rx="5.5"/>
<path class="pele" d="M26 98c-2-16-4-32-1-46 2-6 7-8 14-8h27c7 0 11 4 12 10 1 16-1 30-3 44z"/>
<path class="dobra" d="M29 27q4 3 8 0M42 20q4 3 8 0M55 23q4 3 7 0M67 31q3 2.5 6 0M36 60q8 3 16 1"/>
<rect class="punho" x="21" y="94" width="59" height="12" rx="3"/>
</svg>`;

export function movimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const podeAnimar = (el: Element): el is HTMLElement => typeof (el as HTMLElement).animate === 'function';

interface Ponto {
  x: number;
  y: number;
}
/** Retângulo relativo à camada de animação (sobrevive ao elemento sair do DOM). */
interface Ret {
  x: number;
  y: number;
  w: number;
  h: number;
}

const centroDe = (r: DOMRect): Ponto => ({
  x: r.left + r.width / 2,
  y: r.top + r.height / 2,
});

/** De onde a carta sai: a minha mão (embaixo) ou as cartas do assento. */
function origem(pos: Posicao, destino: DOMRect): Ponto {
  const seletores =
    pos === 'baixo'
      ? ['[data-testid="minha-mao"] .cartas', '[data-testid="minha-mao"]']
      : [`[data-testid="assento-${pos}"] .assento-cartas`, `[data-testid="assento-${pos}"]`];
  for (const s of seletores) {
    const r = document.querySelector(s)?.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) return centroDe(r);
  }
  const [dx, dy] = DIRECAO[pos];
  const c = centroDe(destino);
  const d = Math.max(destino.height, 60) * 2.2;
  return { x: c.x + dx * d, y: c.y + dy * d };
}

class Animador {
  private vivas = new Set<Animation>();
  private nos = new Set<Element>();
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private camada: HTMLElement) {}

  private seguir(a: Animation, aoFim?: () => void) {
    this.vivas.add(a);
    const fim = () => {
      this.vivas.delete(a);
      aoFim?.();
    };
    a.onfinish = fim;
    a.oncancel = fim;
  }

  private adicionar(no: HTMLElement) {
    this.camada.appendChild(no);
    this.nos.add(no);
    return () => {
      no.remove();
      this.nos.delete(no);
    };
  }

  /** A carta parte do assento de quem jogou, levada por uma mão, e assenta com um tapa. */
  voar(el: HTMLElement, pos: Posicao) {
    el.dataset.anim = 'voo';
    const soltar = () => {
      if (el.dataset.anim === 'voo') delete el.dataset.anim;
    };
    if (!podeAnimar(el)) {
      // jsdom: sem Web Animations; o atributo sai depois do tempo do voo.
      const t = setTimeout(() => {
        this.timers.delete(t);
        soltar();
      }, DUR_VOO);
      this.timers.add(t);
      return;
    }
    const destino = el.getBoundingClientRect();
    const de = origem(pos, destino);
    const para = centroDe(destino);
    const dx = de.x - para.x;
    const dy = de.y - para.y;
    const g = GIRO_INICIAL[pos];

    const voo = el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) rotate(${g}deg) scale(0.94)`,
          easing: EASE_ARREMESSO,
        },
        {
          offset: TOQUE,
          transform: `translate(0px, 0px) rotate(${g * 0.08}deg) scale(1.06)`,
          easing: 'ease-out',
        },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(1)' },
      ],
      { duration: DUR_VOO },
    );
    this.seguir(voo, soltar);

    const carta = el.querySelector<HTMLElement>('.carta');
    if (carta) {
      const final = getComputedStyle(carta).boxShadow || 'none';
      this.seguir(
        carta.animate([{ boxShadow: SOMBRA_ALTA, easing: EASE_ARREMESSO }, { offset: TOQUE, boxShadow: SOMBRA_TOQUE }, { boxShadow: final }], {
          duration: DUR_VOO,
        }),
      );
    }
    this.mao(destino, pos, dx, dy, g);
  }

  /** A mão segura a carta pela borda do lado de quem jogou, acompanha o voo, solta e recua. */
  private mao(destino: DOMRect, pos: Posicao, dx: number, dy: number, g: number) {
    const base = this.camada.getBoundingClientRect();
    const lateral = pos === 'esquerda' || pos === 'direita';
    // A caixa gira com a mão; nas laterais ela troca largura e altura para a borda bater com a carta.
    const w = lateral ? destino.height : destino.width;
    const h = lateral ? destino.width : destino.height;
    const c = centroDe(destino);
    const caixa = document.createElement('div');
    caixa.className = 'mao-jogando';
    Object.assign(caixa.style, {
      left: `${c.x - base.left - w / 2}px`,
      top: `${c.y - base.top - h / 2}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
    caixa.innerHTML = SVG_MAO;
    const svg = caixa.firstElementChild as SVGElement;
    const larguraMao = destino.width * 1.02;
    Object.assign(svg.style, {
      width: `${larguraMao}px`,
      left: `${(w - larguraMao) / 2}px`,
      top: `${h * 0.72}px`,
    });
    const remover = this.adicionar(caixa);

    const a = ANGULO_MAO[pos];
    const total = DUR_VOO + DUR_RECUO;
    const toque = (DUR_VOO * TOQUE) / total;
    const solta = DUR_VOO / total;
    const anim = caixa.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) rotate(${a + g}deg)`,
          opacity: 0,
          easing: EASE_ARREMESSO,
        },
        { offset: 0.05, opacity: 1 },
        {
          offset: toque,
          transform: `translate(0px, 0px) rotate(${a + g * 0.08}deg)`,
          easing: 'ease-out',
        },
        {
          offset: solta,
          transform: `translate(0px, 0px) rotate(${a}deg) scale(1)`,
          opacity: 1,
          easing: 'cubic-bezier(0.45, 0, 0.8, 0.5)',
        },
        {
          transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) rotate(${a}deg) scale(0.96)`,
          opacity: 0,
        },
      ],
      { duration: total, fill: 'forwards' },
    );
    this.seguir(anim, remover);
  }

  /** Movimento reduzido: só um fade curto. */
  surgir(el: HTMLElement) {
    if (podeAnimar(el))
      this.seguir(
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: DUR_FADE,
          easing: 'ease-out',
        }),
      );
  }

  /** Cópias das cartas da rodada que saiu deslizam juntas para quem levou (ou somem no lugar). */
  recolher(cartas: { el: HTMLElement; ret: Ret }[], destino: Posicao | null) {
    if (cartas.length === 0 || !podeAnimar(this.camada)) return;
    const base = this.camada.getBoundingClientRect();
    let vx = 0;
    let vy = 0;
    if (destino) {
      const meio = {
        x: base.left + cartas.reduce((s, c) => s + c.ret.x + c.ret.w / 2, 0) / cartas.length,
        y: base.top + cartas.reduce((s, c) => s + c.ret.y + c.ret.h / 2, 0) / cartas.length,
      };
      const alvo = origem(destino, new DOMRect(meio.x - 30, meio.y - 40, 60, 80));
      vx = (alvo.x - meio.x) * 0.6;
      vy = (alvo.y - meio.y) * 0.6;
    }
    for (const { el, ret } of cartas) {
      const f = document.createElement('div');
      f.className = 'fantasma';
      Object.assign(f.style, {
        left: `${ret.x}px`,
        top: `${ret.y}px`,
        width: `${ret.w}px`,
        height: `${ret.h}px`,
      });
      for (const filho of Array.from(el.childNodes)) f.appendChild(filho.cloneNode(true));
      const remover = this.adicionar(f);
      const quadros = destino
        ? [
            { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
            { offset: 0.6, opacity: 0.9 },
            {
              transform: `translate(${vx}px, ${vy}px) scale(0.82)`,
              opacity: 0,
            },
          ]
        : [
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(0.96)', opacity: 0 },
          ];
      this.seguir(
        f.animate(quadros, {
          duration: DUR_RECOLHER,
          easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
          fill: 'forwards',
        }),
        remover,
      );
    }
  }

  limpar() {
    for (const a of Array.from(this.vivas)) a.cancel();
    for (const t of this.timers) clearTimeout(t);
    for (const n of this.nos) n.remove();
    this.vivas.clear();
    this.timers.clear();
    this.nos.clear();
  }
}

const relativo = (r: DOMRect, base: DOMRect): Ret => ({
  x: r.left - base.left,
  y: r.top - base.top,
  w: r.width,
  h: r.height,
});
const chaves = (e: Exibicao) => e.jogadas.map((j) => j.chave).join(',');

/**
 * Compara as jogadas mostradas com as do render anterior: as novas voam do assento de quem jogou;
 * as que saíram (rodada fechou) são recolhidas. O primeiro render (F5, reconexão) não anima.
 * As jogadas precisam de `data-chave` dentro de `centro`; a `camada` recebe mãos e cópias.
 */
export function useAnimacaoJogadas(exibicao: Exibicao, minha: Cadeira, centro: RefObject<HTMLElement>, camada: RefObject<HTMLElement>) {
  const antesRef = useRef<Exibicao | null>(null);
  const animador = useRef<Animador | null>(null);
  const memoria = useRef({
    elementos: new Map<string, HTMLElement>(),
    rets: new Map<string, Ret>(),
  });

  useLayoutEffect(() => {
    const antes = antesRef.current;
    antesRef.current = exibicao;
    const raiz = centro.current;
    const capa = camada.current;
    if (!raiz || !capa) return;
    if (antes && chaves(antes) === chaves(exibicao)) return;
    const mem = memoria.current;
    const ani = (animador.current ??= new Animador(capa));
    const reduzido = movimentoReduzido();

    const recolhida = rodadaRecolhida(antes, exibicao, minha);
    if (recolhida && !reduzido) {
      const cartas = recolhida.chaves.flatMap((k) => {
        const el = mem.elementos.get(k);
        const ret = mem.rets.get(k);
        return el && ret ? [{ el, ret }] : [];
      });
      ani.recolher(cartas, recolhida.destino);
    }

    const base = capa.getBoundingClientRect();
    const elementos = new Map<string, HTMLElement>();
    const rets = new Map<string, Ret>();
    raiz.querySelectorAll<HTMLElement>('[data-chave]').forEach((el) => {
      const k = el.dataset.chave!;
      elementos.set(k, el);
      // Carta ainda voando: vale a posição medida quando ela entrou.
      const anterior = mem.rets.get(k);
      rets.set(k, el.dataset.anim && anterior ? anterior : relativo(el.getBoundingClientRect(), base));
    });
    mem.elementos = elementos;
    mem.rets = rets;

    for (const k of jogadasNovas(antes, exibicao)) {
      const el = elementos.get(k);
      const j = exibicao.jogadas.find((x) => x.chave === k);
      if (!el || !j) continue;
      if (reduzido) ani.surgir(el);
      else ani.voar(el, posicaoRelativa(minha, j.jogada.cadeira));
    }
  });

  useEffect(
    () => () => {
      animador.current?.limpar();
      animador.current = null;
    },
    [],
  );
}
