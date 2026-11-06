import type { Carta, Naipe, Valor } from '@truco/engine';
import { type CSSProperties, useEffect, useRef } from 'react';
import { aproximar, CARTAS_SOLTAS, type Mexida, mexidaDaCarta, PARADA, parada } from '../logica/fundoCartas';
import { CartaVisual } from './CartaVisual';

const NAIPE: Record<string, Naipe> = { p: 'paus', c: 'copas', e: 'espadas', o: 'ouros' };
const carta = (id: string): Carta => ({ valor: id.slice(0, -1) as Valor, naipe: NAIPE[id.slice(-1)] });

/**
 * Cartas espalhadas atrás da tela inicial, em profundidades diferentes. Com mouse, andam em
 * paralaxe e a que está debaixo do ponteiro se afasta e levanta. Em tela de toque só
 * flutuam devagar; com movimento reduzido ficam paradas. Puramente decorativo.
 */
export function FundoCartas() {
  const camada = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = camada.current;
    const mm = window.matchMedia;
    if (!raiz || !mm) return;
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
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('pointermove', aoMover);
      document.documentElement.removeEventListener('pointerleave', aoSair);
      window.removeEventListener('blur', aoSair);
      window.removeEventListener('resize', aoRedimensionar);
    };
  }, []);

  return (
    <div className="fundo-cartas" ref={camada} aria-hidden="true">
      {CARTAS_SOLTAS.map((c, i) => (
        <span
          key={c.id}
          className="carta-solta"
          data-solta=""
          data-d={c.d}
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
              <CartaVisual carta={carta(c.id)} variante="mineiro" vira={null} />
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
