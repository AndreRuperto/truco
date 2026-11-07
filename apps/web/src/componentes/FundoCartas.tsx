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
/** No modo discreto (telas internas) só ficam as cartas das bordas, longe do texto. */
const CARTAS_DAS_BORDAS = CARTAS_SOLTAS.filter((c) => c.x < 20 || c.x > 80);

export function FundoCartas({ discreto = false }: { discreto?: boolean }) {
  const camada = useRef<HTMLDivElement>(null);
  const cartas = discreto ? CARTAS_DAS_BORDAS : CARTAS_SOLTAS;

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
    return () => {
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
      giratoria.animate(
        [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }],
        { duration: 850, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)' },
      );
    };
    window.addEventListener('dblclick', aoDuploClique);
    return () => window.removeEventListener('dblclick', aoDuploClique);
  }, [discreto]);

  return (
    <div className={discreto ? 'fundo-cartas discreto' : 'fundo-cartas'} ref={camada} aria-hidden="true" data-testid="fundo-cartas">
      {cartas.map((c, i) => (
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
              <span className="carta-solta-gira">
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
