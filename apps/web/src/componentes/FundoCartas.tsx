import type { Carta, Naipe, Valor } from '@truco/engine';
import { type CSSProperties, useEffect, useLayoutEffect, useRef } from 'react';
import {
  aproximar,
  atrasosDaDistribuicao,
  CARTAS_SOLTAS,
  CHAVE_CARTAS_DADAS,
  DAR_VOO,
  giroNoMonte,
  type Mexida,
  mexidaDaCarta,
  PARADA,
  parada,
  vaiDarCartas,
} from '../logica/fundoCartas';
import { CartaVisual } from './CartaVisual';

const NAIPE: Record<string, Naipe> = { p: 'paus', c: 'copas', e: 'espadas', o: 'ouros' };
const carta = (id: string): Carta => ({ valor: id.slice(0, -1) as Valor, naipe: NAIPE[id.slice(-1)] });

/**
 * Cartas espalhadas atrás da tela inicial, em profundidades diferentes. Com mouse, andam em
 * paralaxe e a que está debaixo do ponteiro se afasta e levanta. Em tela de toque só
 * flutuam devagar; com movimento reduzido ficam paradas. Puramente decorativo.
 */
/** No modo discreto (telas internas) só ficam as cartas das bordas, longe do texto. */
const CARTAS_DAS_BORDAS = CARTAS_SOLTAS.filter((c) => c.x < 20 || c.x > 80);

/** Tamanho relativo de uma carta de profundidade `d` (o mesmo cálculo de `.carta-solta` no CSS). */
const tamanho = (d: number) => 0.55 + d * 0.85;
/** No monte todas têm o tamanho de uma carta de meia distância, como um baralho de verdade. */
const TAMANHO_NO_MONTE = tamanho(0.7);

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lê e marca o dia da última distribuição; sem armazenamento, distribui. */
function sortearDistribuicao(): boolean {
  const hoje = hojeLocal();
  try {
    const dar = vaiDarCartas(hoje, localStorage.getItem(CHAVE_CARTAS_DADAS), Math.random());
    localStorage.setItem(CHAVE_CARTAS_DADAS, hoje);
    return dar;
  } catch {
    return true;
  }
}

/**
 * As cartas saem de um monte virado para baixo, logo abaixo do formulário (na altura da dica
 * do duplo clique), e voam até o lugar de cada uma, desvirando no caminho. Só anima o que
 * o CSS posiciona por cima (`translate`, `rotate`, `scale`), então ao fim fica tudo como antes.
 */
function darCartas(raiz: HTMLElement): void {
  const soltas = [...raiz.querySelectorAll<HTMLElement>('[data-solta]')];
  if (soltas.length === 0 || typeof soltas[0].animate !== 'function') return;
  const largura = window.innerWidth;
  const altura = window.innerHeight;
  // O que estiver visível mais embaixo: a dica do duplo clique (some no celular), o convite
  // de instalação (some depois de instalar) ou o próprio formulário.
  const base = Math.max(
    0,
    ...['.lobby form', '.instalar-truco', '.lobby-dica-cartas'].map((sel) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r && r.height > 0 ? r.bottom : 0;
    }),
  );
  // Altura do monte: largura-base da carta (clamp(56px, 11vw, 112px) no CSS) × tamanho no monte × 1,45.
  const metadeDoMonte = (Math.min(Math.max(56, largura * 0.11), 112) * TAMANHO_NO_MONTE * 1.45) / 2;
  const ancora = {
    x: largura / 2,
    // Logo abaixo do formulário, mas o monte inteiro dentro da janela.
    y: Math.min(Math.max(base ? base + metadeDoMonte * 0.5 : altura * 0.8, altura * 0.4), altura - metadeDoMonte - 12),
  };
  const ds = soltas.map((el) => Number(el.dataset.d));
  const atrasos = atrasosDaDistribuicao(ds);
  let restantes = soltas.length;
  const assentou = () => {
    restantes -= 1;
    if (restantes === 0) raiz.dispatchEvent(new Event('assentaram'));
  };
  soltas.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const dx = ancora.x - (r.left + r.width / 2);
    // Monte com espessura: cada carta de cima fica um pouco acima da de baixo.
    const dy = ancora.y - (r.top + r.height / 2) - ds[i] * 6;
    const d = ds[i];
    const tempo = { delay: atrasos[i], duration: DAR_VOO, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' as const };
    const voo = el.animate(
      [
        {
          translate: `calc(-50% + ${dx.toFixed(1)}px) calc(-50% + ${dy.toFixed(1)}px)`,
          rotate: `${giroNoMonte(i)}deg`,
          scale: String((TAMANHO_NO_MONTE / tamanho(d)).toFixed(3)),
          opacity: '1',
          filter: 'blur(0px)',
        },
        {
          translate: '-50% -50%',
          rotate: el.style.getPropertyValue('--giro') || '0deg',
          scale: '1',
          opacity: String(0.3 + d * 0.6),
          filter: `blur(${((1 - d) * 3.2).toFixed(2)}px)`,
        },
      ],
      tempo,
    );
    // Sem `finished` (navegador antigo), considera assentada na hora.
    (voo?.finished ?? Promise.resolve()).then(assentou, assentou);
    // As que ficam viradas saem do monte já com o verso para cima: não desviram.
    if (el.dataset.virada === undefined)
      el.querySelector<HTMLElement>('.carta-solta-gira')?.animate(
        [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }],
        tempo,
      );
  });
}

interface Props {
  /** Telas internas: só as cartas das bordas, sem mouse nem distribuição. */
  discreto?: boolean;
  /** Baralho equipado na loja (`estiloVerso`): estampa e cores do verso. Sem ele, o clássico. */
  verso?: { style: CSSProperties; estampa: string } | null;
}

export function FundoCartas({ discreto = false, verso = null }: Props) {
  const camada = useRef<HTMLDivElement>(null);
  const cartas = discreto ? CARTAS_DAS_BORDAS : CARTAS_SOLTAS;

  // Antes do primeiro quadro, para as cartas já nascerem no monte (sem piscar no lugar final).
  useLayoutEffect(() => {
    const raiz = camada.current;
    if (!raiz || discreto || !window.matchMedia) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (sortearDistribuicao()) darCartas(raiz);
  }, [discreto]);

  useEffect(() => {
    const raiz = camada.current;
    const mm = window.matchMedia;
    // Discreto: só flutua (o mouse não mexe nada; o conteúdo é que importa nessas telas).
    if (!raiz || !mm || discreto) return;
    if (!mm('(hover: hover) and (pointer: fine)').matches || mm('(prefers-reduced-motion: reduce)').matches) return;

    const cartas = [...raiz.querySelectorAll<HTMLElement>('[data-solta]')];
    const atual: Mexida[] = cartas.map(() => PARADA);
    let centros: { x: number; y: number; raio: number }[] = [];
    let ponteiro: { x: number; y: number } | null = null;
    let quadro = 0;

    // A posição de cada carta não depende da mexida (ela vai num filho), então mede uma vez.
    const medir = () => {
      centros = cartas.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, raio: Math.max(r.width, r.height) * 0.75 };
      });
    };

    const passo = () => {
      quadro = 0;
      const janela = { l: window.innerWidth, a: window.innerHeight };
      let mexendo = false;
      cartas.forEach((el, i) => {
        const d = Number(el.dataset.d);
        const alvo = mexidaDaCarta(d, centros[i], centros[i].raio, ponteiro, janela);
        const prox = aproximar(atual[i], alvo, 0.14);
        atual[i] = parada(prox, alvo) ? alvo : prox;
        if (atual[i] !== alvo) mexendo = true;
        const m = atual[i];
        const filho = el.firstElementChild as HTMLElement;
        filho.style.transform = `translate(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px) rotate(${m.giro.toFixed(2)}deg) scale(${m.escala.toFixed(4)})`;
      });
      if (mexendo) quadro = requestAnimationFrame(passo);
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(passo);
    };

    const aoMover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      ponteiro = { x: e.clientX, y: e.clientY };
      agendar();
    };
    const aoSair = () => {
      ponteiro = null;
      agendar();
    };
    const aoRedimensionar = () => {
      medir();
      agendar();
    };

    medir();
    window.addEventListener('pointermove', aoMover, { passive: true });
    document.documentElement.addEventListener('pointerleave', aoSair);
    window.addEventListener('blur', aoSair);
    window.addEventListener('resize', aoRedimensionar);
    // Depois da distribuição as cartas estão no lugar certo: mede de novo.
    raiz.addEventListener('assentaram', aoRedimensionar);
    return () => {
      raiz.removeEventListener('assentaram', aoRedimensionar);
      cancelAnimationFrame(quadro);
      window.removeEventListener('pointermove', aoMover);
      document.documentElement.removeEventListener('pointerleave', aoSair);
      window.removeEventListener('blur', aoSair);
      window.removeEventListener('resize', aoRedimensionar);
    };
  }, [discreto]);

  // Como o fundo é decorativo e não recebe pointer-events, detectamos o duplo clique
  // na janela e verificamos se ele ocorreu sobre uma carta, sem bloquear o formulário.
  useEffect(() => {
    const raiz = camada.current;
    if (!raiz || discreto || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const aoDuploClique = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('form, button, a, input, select, textarea, summary, label, [role="button"]')) return;

      // Quando se sobrepõem, vence a carta visualmente mais próxima.
      const soltas = [...raiz.querySelectorAll<HTMLElement>('[data-solta]')]
        .sort((a, b) => Number(b.dataset.d) - Number(a.dataset.d));
      const escolhida = soltas.find((el) => {
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top && e.clientY <= r.bottom;
      });
      const giratoria = escolhida?.querySelector<HTMLElement>('.carta-solta-gira');
      if (!giratoria) return;

      // Reinicia o movimento a cada duplo clique, inclusive durante outro giro.
      giratoria.getAnimations().forEach((a) => a.cancel());
      const base = giratoria.classList.contains('virada') ? 180 : 0;
      giratoria.animate(
        [{ transform: `rotateY(${base}deg)` }, { transform: `rotateY(${base + 360}deg)` }],
        { duration: 850, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)' },
      );
    };
    window.addEventListener('dblclick', aoDuploClique);
    return () => window.removeEventListener('dblclick', aoDuploClique);
  }, [discreto]);

  return (
    <div
      className={discreto ? 'fundo-cartas discreto' : 'fundo-cartas'}
      ref={camada}
      aria-hidden="true"
      data-testid="fundo-cartas"
      data-verso={verso?.estampa}
      style={verso?.style}
    >
      {cartas.map((c, i) => (
        <span
          key={c.id}
          className="carta-solta"
          data-solta=""
          data-d={c.d}
          data-virada={c.virada ? '' : undefined}
          style={
            {
              left: `${c.x}%`,
              top: `${c.y}%`,
              zIndex: Math.round(c.d * 10),
              '--d': c.d,
              '--giro': `${c.giro}deg`,
              '--flutua-dur': `${7 + (i % 5) * 1.3}s`,
              '--flutua-atraso': `${-(i * 1.7)}s`,
            } as CSSProperties
          }
        >
          <span className="carta-solta-mexe">
            <span className="carta-solta-flutua">
              <span className={c.virada ? 'carta-solta-gira virada' : 'carta-solta-gira'}>
                <CartaVisual carta={carta(c.id)} variante="mineiro" vira={null} />
                <CartaVisual carta={null} variante="mineiro" vira={null} />
              </span>
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
