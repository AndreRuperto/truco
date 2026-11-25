import { createPortal } from 'react-dom';
import { type CSSProperties, type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface PassoTour {
  /** Valor do `data-tour` do elemento que fica em destaque. */
  alvo: string;
  titulo: string;
  texto: string;
}

interface Props {
  passos: PassoTour[];
  aoPular: () => void;
  /** O último passo oferece o tutorial. */
  aoComecarTutorial: () => void;
}

interface Caixa {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Folga em volta do destaque e distância até o balão. */
const FOLGA = 6;
const DISTANCIA = 14;
/** Margem mínima do balão até a borda da tela (a mesma dos 16 px do layout no celular). */
const MARGEM = 16;

/**
 * Tour da 1ª visita: escurece a tela, recorta o elemento do passo e explica num balão ao lado.
 * Teclado: o foco fica preso no balão, Esc pula. O elemento em destaque ganha `data-tour-ativo`.
 */
export function TourLobby({ passos, aoPular, aoComecarTutorial }: Props) {
  const [i, setI] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [alturaBalao, setAlturaBalao] = useState(0);
  // Rola no máximo uma vez por passo para abrir espaço ao balão.
  const rolouNoPasso = useRef(-1);
  const balao = useRef<HTMLDivElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const passo = passos[i];
  const ultimo = i === passos.length - 1;

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${passo.alvo}"]`);
    if (!el) return;
    el.setAttribute('data-tour-ativo', '');
    el.scrollIntoView?.({ block: 'center' });
    const medir = () => {
      const r = el.getBoundingClientRect();
      setCaixa({ top: r.top - FOLGA, left: r.left - FOLGA, width: r.width + FOLGA * 2, height: r.height + FOLGA * 2 });
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      el.removeAttribute('data-tour-ativo');
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [passo.alvo]);

  useLayoutEffect(() => {
    if (balao.current) setAlturaBalao(balao.current.offsetHeight);
  }, [i, caixa?.width]);

  // Sem espaço nem embaixo nem em cima: rola a página para o destaque ficar no alto da tela.
  useLayoutEffect(() => {
    if (!caixa || !alturaBalao || rolouNoPasso.current === i) return;
    const vh = window.innerHeight;
    const cabeEmbaixo = vh - (caixa.top + caixa.height) - DISTANCIA - MARGEM >= alturaBalao;
    const cabeEmCima = caixa.top - DISTANCIA - MARGEM >= alturaBalao;
    if (cabeEmbaixo || cabeEmCima) return;
    rolouNoPasso.current = i;
    window.scrollBy({ top: caixa.top - MARGEM, behavior: 'instant' as ScrollBehavior });
  }, [caixa, alturaBalao, i]);

  useEffect(() => {
    principal.current?.focus();
  }, [i]);

  const teclado = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      aoPular();
      return;
    }
    if (e.key !== 'Tab' || !balao.current) return;
    const focaveis = [...balao.current.querySelectorAll<HTMLElement>('button')];
    const primeiro = focaveis[0];
    const fim = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      fim.focus();
    } else if (!e.shiftKey && document.activeElement === fim) {
      e.preventDefault();
      primeiro.focus();
    }
  };

  // Balão embaixo do destaque quando cabe; senão em cima. Na horizontal, centrado e dentro da tela.
  const vw = typeof window === 'undefined' ? 0 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 0 : window.innerHeight;
  const largura = Math.min(360, vw - MARGEM * 2);
  const posicao: CSSProperties = { width: largura };
  if (caixa) {
    const sobraEmbaixo = vh - (caixa.top + caixa.height) - DISTANCIA - MARGEM;
    const sobraEmCima = caixa.top - DISTANCIA - MARGEM;
    // Embaixo quando cabe (ou quando ainda sobra mais espaço lá); senão em cima.
    const embaixo = sobraEmbaixo >= alturaBalao || sobraEmbaixo >= sobraEmCima;
    if (embaixo) posicao.top = caixa.top + caixa.height + DISTANCIA;
    else posicao.bottom = vh - caixa.top + DISTANCIA;
    // Último recurso (tela baixa e página no fim da rolagem): o balão rola por dentro.
    posicao.maxHeight = Math.max(120, embaixo ? sobraEmbaixo : sobraEmCima);
    posicao.left = Math.max(MARGEM, Math.min(caixa.left + caixa.width / 2 - largura / 2, vw - largura - MARGEM));
  }

  const idTitulo = 'tour-titulo';
  const idTexto = 'tour-texto';
  // No body: dentro do lobby o tour ficaria preso na camada dele, e o cabeçalho continuaria aceso.
  return createPortal(
    <div className="tour">
      {/* Tampa a tela: nada embaixo responde ao toque enquanto o tour está aberto. */}
      <div className="tour-tampa" aria-hidden="true" />
      {caixa && <div className="tour-destaque" aria-hidden="true" style={caixa} />}
      <div
        ref={balao}
        className="tour-balao"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        style={posicao}
        onKeyDown={teclado}
      >
        <p className="tour-contagem">
          {i + 1} de {passos.length}
        </p>
        <h2 id={idTitulo}>{passo.titulo}</h2>
        <p id={idTexto}>{passo.texto}</p>
        <div className="tour-botoes">
          {ultimo ? (
            <>
              <button ref={principal} type="button" className="botao-principal" onClick={aoComecarTutorial}>
                Começar tutorial
              </button>
              <button type="button" className="botao-discreto" onClick={aoPular}>
                Agora não
              </button>
            </>
          ) : (
            <>
              <button ref={principal} type="button" className="botao-principal" onClick={() => setI(i + 1)}>
                Próximo
              </button>
              <button type="button" className="botao-discreto" onClick={aoPular}>
                Pular
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
