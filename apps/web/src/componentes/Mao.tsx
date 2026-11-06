import { type Carta, idCarta, type Variante } from '@truco/engine';
import { useEffect, useState } from 'react';
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

export function Mao({ cartas, jogaveis, cobriveis, variante, vira, aoJogar, pilha = null }: Props) {
  const [cobrir, setCobrir] = useState(false);
  const podeCobrir = cobriveis.length > 0;
  const cobrindo = cobrir && podeCobrir;
  // Sem cartas cobríveis (ex.: a vez passou) o modo desliga, para não voltar ligado depois.
  useEffect(() => {
    if (!podeCobrir) setCobrir(false);
  }, [podeCobrir]);

  return (
    <div className={cx('minha-mao', pilha && `pilha-${pilha}`)} data-testid="minha-mao">
      {pilha === 'escolher' && <p className="dica-pilha">Toque na carta que vai por cima</p>}
      <div className="cartas">
        {cartas.map((carta, i) => {
          const ok = (cobrindo ? cobriveis : jogaveis).includes(i);
          const posPilha = pilha === 'empilhada' ? (i === 0 ? ', por cima' : ', embaixo') : pilha === 'escolher' ? ': pôr por cima' : '';
          const nome = (carta ? rotuloCarta(carta, variante, vira) : `Carta virada ${i + 1}`) + (cobrindo ? ' (coberta)' : '') + posPilha;
          return (
            <button
              key={carta ? idCarta(carta) : `virada-${i}`}
              type="button"
              className={cx('carta-botao', ok && 'jogavel', cobrindo && 'cobrindo')}
              disabled={!ok}
              aria-label={nome}
              onClick={() => {
                aoJogar(i, cobrindo);
                setCobrir(false);
              }}
            >
              <CartaVisual carta={carta} variante={variante} vira={vira} />
            </button>
          );
        })}
      </div>
      {podeCobrir && (
        <button type="button" className="alternar-coberta" aria-pressed={cobrindo} onClick={() => setCobrir((x) => !x)}>
          Jogar coberta
        </button>
      )}
    </div>
  );
}
