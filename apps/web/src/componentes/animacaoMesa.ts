import type { Cadeira } from '@truco/engine';
import type { MsgAcao } from '@truco/protocolo';
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { type Exibicao, jogadasNovas, rodadaRecolhida } from '../logica/jogadas';
import { type Posicao, posicaoRelativa } from '../logica/posicoes';
import { passosDistribuicao } from '../logica/ritual';
import type { Movimento } from '../rede/loja';

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

export const DUR_DESLIZE = 380;

/** FLIP: `el` já está no lugar novo; desliza de onde estava (`de`). Movimento reduzido: nada. */
export function deslizarDe(el: HTMLElement, de: DOMRect): void {
  if (movimentoReduzido() || !podeAnimar(el)) return;
  const para = el.getBoundingClientRect();
  const dx = de.left - para.left;
  const dy = de.top - para.top;
  if (dx === 0 && dy === 0) return;
  el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }], {
    duration: DUR_DESLIZE,
    easing: EASE_ARREMESSO,
  });
}

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

/* ---------- Ritual: embaralhar, cortar, dar, abrir 3, família e conferir ---------- */

export const DUR_RIFFLE = 560;
export const DUR_CORTE = 480;
export const DUR_DADA = 650;
/** Intervalo entre um voo e o próximo na distribuição (leva de 3 cartas). */
export const PASSO_DADA = 380;
/** Intervalo entre voos de uma carta só (dar "subindo"): 12 voos, mais curtos. */
export const PASSO_DADA_UMA = 240;
const DUR_ENTRADA = 380;
/** Quanto esperar o `estado` (que chega depois da mensagem `acao`) montar o alvo. */
const ESPERA_ESTADO = 900;
const INTERVALO_ESPERA = 30;

function retDe(seletor: string): DOMRect | null {
  const r = document.querySelector(seletor)?.getBoundingClientRect();
  return r && r.width > 0 ? r : null;
}
const retAssento = (pos: Posicao) => retDe(`[data-testid="assento-${pos}"]`);
/** Para onde as cartas vão: as cartas do assento (ou o assento); a minha mão é a faixa de baixo. */
function retDestino(pos: Posicao): DOMRect | null {
  if (pos === 'baixo') return retDe('[data-testid="minha-mao"]') ?? retAssento('baixo');
  return retDe(`[data-testid="assento-${pos}"] .assento-cartas`) ?? retAssento(pos);
}
const familiaDe = (pos: Posicao) => document.querySelector<HTMLElement>(`figure.familia.pos-${pos}`);

/** Animações do ritual: fantasmas (pilhas de versos) na camada; o monte real só ganha `data-anim`. */
class AnimadorRitual {
  private vivas = new Set<Animation>();
  private nos = new Set<Element>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private mesaDando: HTMLElement | null = null;

  constructor(private camada: HTMLElement) {}

  private depois(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  /** Chama `fn` assim que `achar()` devolver algo (o estado chega depois da mensagem); desiste depois de um tempo. */
  private quando<T>(achar: () => T | null, fn: (x: T) => void, gasto = 0) {
    const x = achar();
    if (x) fn(x);
    else if (gasto < ESPERA_ESTADO) this.depois(INTERVALO_ESPERA, () => this.quando(achar, fn, gasto + INTERVALO_ESPERA));
  }

  /** O CSS (e os testes) leem `data-anim` no monte enquanto a animação dura. */
  private marcar(el: HTMLElement, nome: string, ms: number) {
    el.dataset.anim = nome;
    this.depois(ms, () => {
      if (el.dataset.anim === nome) delete el.dataset.anim;
    });
  }

  private seguir(a: Animation, aoFim?: () => void) {
    this.vivas.add(a);
    const fim = () => {
      this.vivas.delete(a);
      aoFim?.();
    };
    a.onfinish = fim;
    a.oncancel = fim;
  }

  /** Pilhinha de `qtd` versos do tamanho de `ret` (em coordenadas da página) na camada. */
  private fantasma(ret: DOMRect, qtd: number, classe = ''): HTMLElement {
    const base = this.camada.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = `fantasma-ritual ${classe}`.trim();
    Object.assign(f.style, {
      left: `${ret.left - base.left}px`,
      top: `${ret.top - base.top}px`,
      width: `${ret.width}px`,
      height: `${ret.height}px`,
    });
    for (let i = 0; i < qtd; i++) {
      const c = document.createElement('span');
      c.className = 'carta verso';
      c.style.setProperty('--i', String(i));
      f.appendChild(c);
    }
    this.camada.appendChild(f);
    this.nos.add(f);
    return f;
  }

  private remover(f: Element) {
    f.remove();
    this.nos.delete(f);
  }

  /**
   * Uma pilhinha sai do monte (do topo ou escorregando por baixo) e voa até `para`; some ao chegar
   * (a carta real aparece pelo estado).
   */
  private voo(de: DOMRect, para: DOMRect, qtd: number, deBaixo: boolean, giro: number) {
    const f = this.fantasma(de, qtd, deBaixo ? 'de-baixo' : '');
    const a = centroDe(de);
    const b = centroDe(para);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // Do fundo: a carta aparece por baixo da pilha (desce um pouco antes de partir); do topo: levanta.
    const saida = deBaixo ? `translate(0px, ${de.height * 0.28}px) scale(0.98)` : `translate(0px, ${-de.height * 0.14}px) scale(1.05)`;
    this.seguir(
      f.animate(
        [
          { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: deBaixo ? 0 : 1 },
          { offset: 0.2, transform: `${saida} rotate(0deg)`, opacity: 1 },
          { offset: 0.88, opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${giro}deg) scale(0.86)`, opacity: 0 },
        ],
        { duration: DUR_DADA, easing: EASE_ARREMESSO, fill: 'forwards' },
      ),
      () => this.remover(f),
    );
  }

  /** A mão do pé segurando o monte; dá um "piparote" para o lado de cada voo. */
  private maoNoMonte(monte: DOMRect, dono: Posicao, alvos: (DOMRect | null)[]) {
    const base = this.camada.getBoundingClientRect();
    const lateral = dono === 'esquerda' || dono === 'direita';
    const w = lateral ? monte.height : monte.width;
    const h = lateral ? monte.width : monte.height;
    const c = centroDe(monte);
    const caixa = document.createElement('div');
    caixa.className = 'mao-jogando mao-pe';
    Object.assign(caixa.style, {
      left: `${c.x - base.left - w / 2}px`,
      top: `${c.y - base.top - h / 2}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
    caixa.innerHTML = SVG_MAO;
    const svg = caixa.firstElementChild as SVGElement;
    const larguraMao = w * 1.15;
    Object.assign(svg.style, { width: `${larguraMao}px`, left: `${(w - larguraMao) / 2}px`, top: `${h * 0.55}px` });
    this.camada.appendChild(caixa);
    this.nos.add(caixa);

    const ang = ANGULO_MAO[dono];
    const [ox, oy] = DIRECAO[dono];
    const longe = `translate(${ox * h * 0.9}px, ${oy * h * 0.9}px) rotate(${ang}deg)`;
    const parado = `translate(0px, 0px) rotate(${ang}deg)`;
    const total = alvos.length * PASSO_DADA + DUR_DADA;
    const entrada = Math.min(0.2, 120 / total);
    const quadros: Keyframe[] = [
      { offset: 0, transform: longe, opacity: 0 },
      { offset: entrada, transform: parado, opacity: 1 },
    ];
    let ultimo = entrada;
    alvos.forEach((r, i) => {
      const t = (i * PASSO_DADA + 40) / total;
      if (!r || t <= ultimo || t >= 0.9) return;
      ultimo = t;
      const d = centroDe(r);
      const vx = d.x - c.x;
      const vy = d.y - c.y;
      const n = Math.hypot(vx, vy) || 1;
      quadros.push({ offset: t, transform: `translate(${(vx / n) * 7}px, ${(vy / n) * 7}px) rotate(${ang + Math.sign(vx || vy) * 4}deg)` });
    });
    quadros.push({ offset: 0.92, transform: parado, opacity: 1 }, { offset: 1, transform: longe, opacity: 0 });
    this.seguir(caixa.animate(quadros, { duration: total, easing: 'ease-in-out', fill: 'forwards' }), () => this.remover(caixa));
  }

  embaralhar(monte: HTMLElement) {
    this.marcar(monte, 'embaralhar', DUR_RIFFLE);
    if (!podeAnimar(this.camada)) return;
    const r = monte.getBoundingClientRect();
    // As duas metades se abrem em leque e as cartas caem intercaladas, uma de cada lado.
    for (const lado of [-1, 1]) {
      const f = this.fantasma(r, 4, 'riffle');
      Array.from(f.children).forEach((carta, i) => {
        if (!podeAnimar(carta)) return;
        const atraso = 0.5 + ((i * 2 + (lado > 0 ? 1 : 0)) / 8) * 0.3;
        this.seguir(
          carta.animate(
            [
              { transform: 'translate(0px, 0px)' },
              { offset: 0.4, transform: `translate(0px, ${-i * 2}px) rotate(${lado * -4}deg)` },
              { offset: atraso, transform: `translate(0px, ${-i * 2}px) rotate(${lado * -4}deg)` },
              { transform: 'translate(0px, 0px) rotate(0deg)' },
            ],
            { duration: DUR_RIFFLE, easing: 'ease-in-out', fill: 'forwards' },
          ),
        );
      });
      this.seguir(
        f.animate(
          [
            { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
            { offset: 0.35, transform: `translate(${lado * r.width * 0.62}px, -6px) rotate(${lado * 10}deg)` },
            { offset: 0.55, transform: `translate(${lado * r.width * 0.5}px, -4px) rotate(${lado * 6}deg)` },
            { offset: 0.85, transform: `translate(${lado * r.width * 0.08}px, -1px) rotate(${lado * 1}deg)`, opacity: 1 },
            { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 0 },
          ],
          { duration: DUR_RIFFLE, easing: 'ease-in-out', fill: 'forwards' },
        ),
        () => this.remover(f),
      );
    }
  }

  /** A parte de cima (aprox. `fracao` do monte: o servidor só manda 0.3, 0.5 ou 0.7) sobe, vai para o lado e o resto passa por cima dela. */
  cortar(monte: HTMLElement, fracao: number) {
    this.marcar(monte, 'cortar', DUR_CORTE);
    if (!podeAnimar(this.camada)) return;
    const r = monte.getBoundingClientRect();
    const f = Math.min(0.9, Math.max(0.1, fracao));
    const cima = this.fantasma(r, Math.max(1, Math.round(f * 5)));
    const resto = this.fantasma(r, Math.max(1, Math.round((1 - f) * 5)));
    const lado = r.width * 1.15;
    const alto = -r.height * (0.25 + f * 0.25);
    this.seguir(
      cima.animate(
        [
          { transform: 'translate(0px, 0px)', opacity: 1, zIndex: 2 },
          { offset: 0.3, transform: `translate(0px, ${alto}px)`, zIndex: 2 },
          { offset: 0.55, transform: `translate(${lado}px, 0px)`, zIndex: 1 },
          { offset: 0.8, transform: `translate(${lado * 0.3}px, 0px)`, opacity: 1, zIndex: 1 },
          { transform: 'translate(0px, 0px)', opacity: 0, zIndex: 1 },
        ],
        { duration: DUR_CORTE, easing: 'ease-in-out', fill: 'forwards' },
      ),
      () => this.remover(cima),
    );
    this.seguir(
      resto.animate(
        [
          { transform: 'translate(0px, 0px)', opacity: 0, zIndex: 1 },
          { offset: 0.5, transform: 'translate(0px, 0px)', opacity: 0.9, zIndex: 1 },
          { offset: 0.7, transform: `translate(${lado * 0.4}px, ${alto * 0.6}px)`, zIndex: 3 },
          { offset: 0.9, transform: `translate(${lado * 0.15}px, -3px)`, opacity: 1, zIndex: 3 },
          { transform: 'translate(0px, 0px)', opacity: 0, zIndex: 3 },
        ],
        { duration: DUR_CORTE, easing: 'ease-in-out', fill: 'forwards' },
      ),
      () => this.remover(resto),
    );
  }

  /** Cartas saindo do monte (do topo ou do fundo) para cada destino, uma leva por vez. */
  dar(monte: HTMLElement, dono: Posicao, passos: { para: DOMRect | null; qtd: number; deBaixo: boolean; pos?: Posicao }[]) {
    const inicio = passos.map((p, i) => passos.slice(0, i).reduce((t, q) => t + (q.qtd === 1 ? PASSO_DADA_UMA : PASSO_DADA), 0));
    const total = (inicio.at(-1) ?? 0) + DUR_DADA;
    this.marcar(monte, 'distribuir', total);
    if (!podeAnimar(this.camada)) return;
    // As cartas de verdade (que chegam pelo estado) ficam escondidas até o último voo chegar ao lugar delas.
    const chegada = new Map<Posicao, number>();
    passos.forEach((p, i) => {
      if (p.pos) chegada.set(p.pos, inicio[i] + DUR_DADA * 0.85);
    });
    this.esconderAte(chegada);
    const r = monte.getBoundingClientRect();
    if (passos.length > 1)
      this.maoNoMonte(
        r,
        dono,
        passos.map((p) => p.para),
      );
    passos.forEach((p, i) => {
      const para = p.para;
      if (para) this.depois(inicio[i], () => this.voo(r, para, p.qtd, p.deBaixo, (i % 2 ? 1 : -1) * 12));
    });
  }

  /** As 3 abertas no corte saem do monte e viram de face ao chegar. */
  abrir(monte: HTMLElement) {
    this.marcar(monte, 'abrir', DUR_ENTRADA);
    if (!podeAnimar(this.camada)) return;
    const de = monte.getBoundingClientRect();
    this.quando(
      () => document.querySelector<HTMLElement>('[data-testid="abertas-corte"] .familia-cartas'),
      (el) => this.entrarDe(el, de, true),
    );
  }

  /** O elemento real (já no lugar) vem de `de`, opcionalmente virando de face no caminho. */
  private entrarDe(el: HTMLElement, de: DOMRect, virar: boolean) {
    if (!podeAnimar(el)) return;
    const para = el.getBoundingClientRect();
    const a = centroDe(de);
    const b = centroDe(para);
    const s = Math.min(1, de.height / Math.max(1, para.height));
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    this.seguir(
      el.animate(
        virar
          ? [
              { transform: `translate(${dx}px, ${dy}px) scale(${s}) scaleX(1)`, opacity: 0.6 },
              { offset: 0.55, transform: `translate(${dx * 0.25}px, ${dy * 0.25}px) scale(${(s + 1) / 2}) scaleX(0.05)`, opacity: 1 },
              { transform: 'translate(0px, 0px) scale(1) scaleX(1)', opacity: 1 },
            ]
          : [
              { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.4 },
              { offset: 0.2, opacity: 1 },
              { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
            ],
        { duration: DUR_ENTRADA, easing: EASE_ARREMESSO },
      ),
    );
  }

  /** As 3 da mão vão para a frente do jogador (a figura real da família); depois 3 novas vêm do monte. */
  familia(monte: HTMLElement | null, pos: Posicao) {
    if (!podeAnimar(this.camada)) return;
    const assento = retDestino(pos);
    const antes = familiaDe(pos)?.dataset.familia ?? null;
    if (assento)
      this.quando(
        () => {
          const f = familiaDe(pos);
          return f && f.dataset.familia !== antes ? f.querySelector<HTMLElement>('.familia-cartas') : null;
        },
        (el) => this.entrarDe(el, assento, false),
      );
    if (monte && assento) {
      const de = monte.getBoundingClientRect();
      this.depois(DUR_ENTRADA * 0.6, () => this.voo(de, assento, 3, false, 0));
    }
  }

  /** Conferiu: as 3 da família viram de face uma a uma. */
  conferir() {
    if (!podeAnimar(this.camada)) return;
    const conferidas = () => Array.from(document.querySelectorAll<HTMLElement>('figure.familia[data-conferida="sim"]'));
    const vistas = new Set(conferidas().map((f) => f.dataset.familia));
    this.quando(
      () => conferidas().find((f) => !vistas.has(f.dataset.familia)) ?? null,
      (fig) =>
        fig.querySelectorAll<HTMLElement>('.carta').forEach((c, i) => {
          if (!podeAnimar(c)) return;
          this.seguir(
            c.animate(
              [
                { transform: 'translateY(-8px) scaleX(0)' },
                { offset: 0.6, transform: 'translateY(-8px) scaleX(1.08)' },
                { transform: 'translateY(0px) scaleX(1)' },
              ],
              { duration: DUR_CORTE, delay: i * 140, easing: 'ease-out', fill: 'backwards' },
            ),
          );
        }),
    );
  }

  tocar(a: MsgAcao, minha: Cadeira) {
    const monte = document.querySelector<HTMLElement>('[data-testid="monte"]');
    const pos = posicaoRelativa(minha, a.cadeira);
    switch (a.tipo) {
      case 'embaralhar':
        if (monte) this.embaralhar(monte);
        break;
      case 'cortar':
        if (monte) this.cortar(monte, a.fracao ?? 0.5);
        break;
      case 'abrir3':
        if (monte) this.abrir(monte);
        break;
      case 'dar3':
        if (monte && a.para !== undefined) this.dar(monte, pos, [{ para: retDestino(posicaoRelativa(minha, a.para)), qtd: 3, deBaixo: false }]);
        break;
      case 'distribuir':
        if (monte)
          this.dar(
            monte,
            pos,
            passosDistribuicao(a, minha).map((p) => ({ para: retDestino(p.pos), qtd: p.qtd, deBaixo: p.deBaixo, pos: p.pos })),
          );
        break;
      case 'familia':
        this.familia(monte, pos);
        break;
      case 'conferir':
        if (a.conferir) this.conferir();
        break;
      default:
        break;
    }
  }

  /** Marca a mesa com `data-dando` (as posições cujas cartas ainda estão voando) e tira cada uma na hora. */
  private esconderAte(chegada: Map<Posicao, number>) {
    const mesa = this.camada.closest<HTMLElement>('.tela-mesa');
    if (!mesa || chegada.size === 0) return;
    this.mesaDando = mesa;
    const pendentes = new Set(chegada.keys());
    const escrever = () => {
      if (pendentes.size) mesa.dataset.dando = [...pendentes].join(' ');
      else delete mesa.dataset.dando;
    };
    escrever();
    for (const [pos, ms] of chegada)
      this.depois(ms, () => {
        pendentes.delete(pos);
        escrever();
      });
  }

  limpar() {
    if (this.mesaDando) delete this.mesaDando.dataset.dando;
    for (const a of Array.from(this.vivas)) a.cancel();
    for (const t of this.timers) clearTimeout(t);
    for (const n of this.nos) n.remove();
    this.vivas.clear();
    this.timers.clear();
    this.nos.clear();
  }
}

/**
 * Anima as mensagens `acao` novas do ritual e da família (`movimentos` da loja), reagindo só a ids
 * maiores que o último visto. O primeiro render (F5, reconexão) não anima; movimento reduzido também
 * não. A `camada` recebe os fantasmas; nada aqui mexe em estado nem pega clique.
 */
export function useAnimacaoRitual(movimentos: readonly Movimento[] | undefined, minha: Cadeira, camada: RefObject<HTMLElement>) {
  const visto = useRef<number | null>(null);
  const animador = useRef<AnimadorRitual | null>(null);

  useLayoutEffect(() => {
    const lista = movimentos ?? [];
    const desde = visto.current;
    const ultimo = lista.at(-1)?.id ?? 0;
    visto.current = ultimo;
    // A loja zera os ids ao conectar de novo: último menor que o visto = recomeço, sem animar.
    if (desde === null || ultimo < desde || movimentoReduzido()) return;
    const capa = camada.current;
    if (!capa) return;
    const ani = (animador.current ??= new AnimadorRitual(capa));
    for (const { id, msg } of lista) if (id > desde) ani.tocar(msg, minha);
  }, [movimentos, minha, camada]);

  useEffect(
    () => () => {
      animador.current?.limpar();
      animador.current = null;
    },
    [],
  );
}
