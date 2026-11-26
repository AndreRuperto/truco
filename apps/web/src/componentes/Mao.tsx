import { type Carta, idCarta, type Variante } from '@truco/engine';
import { type PointerEvent as EventoPonteiro, useEffect, useRef, useState } from 'react';
import { rotuloCarta } from '../logica/cartas';
import { CartaVisual } from './CartaVisual';
import { cx } from './cx';

interface Props {
  /** Minha mão; null = carta virada (mão de ferro). */
  cartas: (Carta | null)[];
  jogaveis: number[];
  cobriveis: number[];
  variante: Variante;
  vira: Carta | null;
  aoJogar: (indice: number, coberta: boolean) => void;
  /** Cangada: 'escolher' = clicar põe a carta por cima; 'empilhada' = a 1ª está por cima, a 2ª escondida embaixo. */
  pilha?: 'escolher' | 'empilhada' | null;
}

/** Quanto arrastar antes de virar "arrasto" (abaixo disso é toque). */
const LIMIAR_ARRASTO = 8;
/** Soltar a carta pelo menos isto acima de onde pegou = jogar na mesa. */
export const DISTANCIA_JOGAR = 70;

interface Arrasto {
  indice: number;
  id: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  /** Já passou do limiar: o clique que vem depois do soltar não pode jogar de novo. */
  moveu: boolean;
}

export function Mao({ cartas, jogaveis, cobriveis, variante, vira, aoJogar, pilha = null }: Props) {
  const [cobrir, setCobrir] = useState(false);
  const podeCobrir = cobriveis.length > 0;
  const cobrindo = cobrir && podeCobrir;
  // Sem cartas cobríveis (ex.: a vez passou) o modo desliga, para não voltar ligado depois.
  useEffect(() => {
    if (!podeCobrir) setCobrir(false);
  }, [podeCobrir]);

  // Segurar e arrastar: a carta segue o dedo/mouse; soltar acima da mão joga, perto dela volta.
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const ignorarClique = useRef(false);
  const jogar = (i: number) => {
    aoJogar(i, cobrindo);
    setCobrir(false);
  };
  const pegar = (i: number, e: EventoPonteiro<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // sem captura (jsdom, navegador antigo): segue sem
    }
    setArrasto({ indice: i, id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moveu: false });
  };
  const mover = (e: EventoPonteiro<HTMLButtonElement>) => {
    setArrasto((a) => {
      if (!a || a.id !== e.pointerId) return a;
      const dx = e.clientX - a.x0;
      const dy = e.clientY - a.y0;
      return { ...a, dx, dy, moveu: a.moveu || Math.hypot(dx, dy) > LIMIAR_ARRASTO };
    });
  };
  const soltar = (e: EventoPonteiro<HTMLButtonElement>) => {
    const a = arrasto;
    if (!a || a.id !== e.pointerId) return;
    setArrasto(null);
    const moveu = a.moveu || Math.hypot(e.clientX - a.x0, e.clientY - a.y0) > LIMIAR_ARRASTO;
    if (!moveu) return; // foi um toque: o clique cuida
    ignorarClique.current = true;
    if (e.clientY - a.y0 <= -DISTANCIA_JOGAR) jogar(a.indice);
  };

  return (
    <div className={cx('minha-mao', pilha && `pilha-${pilha}`)} data-testid="minha-mao">
      {pilha === 'escolher' && <p className="dica-pilha">Toque na carta que vai por cima</p>}
      <div className="cartas">
        {cartas.map((carta, i) => {
          const ok = (cobrindo ? cobriveis : jogaveis).includes(i);
          const posPilha = pilha === 'empilhada' ? (i === 0 ? ', por cima' : ', embaixo') : pilha === 'escolher' ? ': pôr por cima' : '';
          const nome = (carta ? rotuloCarta(carta, variante, vira) : `Carta virada ${i + 1}`) + (cobrindo ? ' (coberta)' : '') + posPilha;
          const meu = arrasto?.indice === i && arrasto.moveu ? arrasto : null;
          return (
            <button
              key={carta ? idCarta(carta) : `virada-${i}`}
              type="button"
              className={cx('carta-botao', ok && 'jogavel', cobrindo && 'cobrindo', meu && 'arrastando', meu && meu.dy <= -DISTANCIA_JOGAR && 'vai-jogar')}
              disabled={!ok}
              aria-label={nome}
              style={meu ? { translate: `${meu.dx}px ${meu.dy}px` } : undefined}
              onPointerDown={ok ? (e) => pegar(i, e) : undefined}
              onPointerMove={ok ? mover : undefined}
              onPointerUp={ok ? soltar : undefined}
              onPointerCancel={() => setArrasto(null)}
              onClick={() => {
                if (ignorarClique.current) {
                  ignorarClique.current = false;
                  return;
                }
                jogar(i);
              }}
            >
              <CartaVisual carta={carta} variante={variante} vira={vira} />
            </button>
          );
        })}
      </div>
      {podeCobrir && (
        // Uma palavra visível ("Coberta") e um versinho de carta; o nome completo vai no aria-label.
        <button
          type="button"
          className="alternar-coberta"
          aria-label="Jogar coberta"
          title="Jogar a próxima carta virada para baixo"
          aria-pressed={cobrindo}
          onClick={() => setCobrir((x) => !x)}
        >
          <span className="alternar-coberta-verso" aria-hidden="true" />
          <span className="alternar-coberta-rotulo">Coberta</span>
        </button>
      )}
    </div>
  );
}
