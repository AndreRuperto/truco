import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cargaPorTempo, forcaAoSoltar } from '../logica/batida';
import { cx } from './cx';

interface Props {
  className?: string;
  children: ReactNode;
  /** O pedido (Seis!/Nove!/Doze!). Sempre enviado ao soltar, com ou sem batida. */
  aoPedir: () => void;
  /** Batida na mesa (força 0..1), enviada logo DEPOIS do pedido quando o botão foi segurado. */
  aoBater?: (forca: number) => void;
}

const agora = () => performance.now();
/** Ignora um `click` sintético (teclado/leitor de tela) logo depois de um envio já feito. */
const JANELA_CLIQUE_DUPLO_MS = 400;

/**
 * Botão de pedido que bate na mesa: segurar (ponteiro ou Espaço) carrega a força, mostrada no
 * próprio botão; soltar envia o pedido e, se segurou ≥ `TOQUE_RAPIDO_MS`, a batida. Toque rápido
 * ou Enter = pedido sem batida.
 */
export function BotaoBatida({ className, children, aoPedir, aoBater }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const inicio = useRef<number | null>(null);
  const quadro = useRef<number | null>(null);
  const ultimoEnvio = useRef(-Infinity);
  const [carregando, setCarregando] = useState(false);

  const pararQuadros = () => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
  };
  useEffect(() => pararQuadros, []);

  const desenhar = () => {
    const t0 = inicio.current;
    if (t0 === null) return;
    ref.current?.style.setProperty('--carga', cargaPorTempo(agora() - t0).toFixed(3));
    quadro.current = requestAnimationFrame(desenhar);
  };

  const comecar = () => {
    if (inicio.current !== null) return;
    inicio.current = agora();
    setCarregando(true);
    if (typeof requestAnimationFrame === 'function') quadro.current = requestAnimationFrame(desenhar);
  };

  const enviar = (forca: number | null) => {
    ultimoEnvio.current = agora();
    aoPedir();
    if (forca !== null) aoBater?.(forca);
  };

  const soltar = () => {
    const t0 = inicio.current;
    if (t0 === null) return;
    const forca = forcaAoSoltar(agora() - t0);
    inicio.current = null;
    pararQuadros();
    setCarregando(false);
    ref.current?.style.removeProperty('--carga');
    enviar(forca);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={cx(className, 'bate', carregando && 'carregando')}
      title="Segure para bater na mesa"
      onPointerDown={(e) => {
        if (e.button > 0) return; // só o botão principal (ou toque)
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // sem captura o pointerup ainda chega no botão (ou o cancel solta)
        }
        comecar();
      }}
      onPointerUp={soltar}
      // O navegador pode cancelar um toque longo: o pedido nunca se perde por causa da batida.
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          if (!e.repeat) comecar();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (!e.repeat && inicio.current === null) enviar(null);
        }
      }}
      onKeyUp={(e) => {
        if (e.key !== ' ') return;
        e.preventDefault();
        soltar();
      }}
      onBlur={soltar}
      onClick={(e) => {
        // Cliques de ponteiro já foram tratados no pointerup; sobra o clique sem ponteiro (leitor de tela).
        if (e.detail !== 0 || inicio.current !== null) return;
        if (agora() - ultimoEnvio.current < JANELA_CLIQUE_DUPLO_MS) return;
        enviar(null);
      }}
    >
      {children}
    </button>
  );
}
