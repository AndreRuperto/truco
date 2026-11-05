import { type Carta, ehCoringa, type Variante } from '@truco/engine';
import type { ReactNode } from 'react';
import { ehVermelha, nomeManilha, rotuloCarta, simboloCarta } from '../logica/cartas';
import { cx } from './cx';
import { type Figura, FiguraCarta, OrnamentoAs } from './FiguraCarta';

const FIGURA: Partial<Record<Carta['valor'], Figura>> = { K: 'rei', Q: 'dama', J: 'valete' };

interface Props {
  /** null = verso (carta virada/escondida). */
  carta: Carta | null;
  variante: Variante;
  vira: Carta | null;
  tamanho?: 'normal' | 'pequena';
  esmaecida?: boolean;
}

export function CartaVisual({ carta, variante, vira, tamanho = 'normal', esmaecida = false }: Props) {
  const base = cx('carta', tamanho === 'pequena' && 'pequena', esmaecida && 'esmaecida');
  if (!carta) return <span className={cx(base, 'verso')} role="img" aria-label="carta virada" />;
  const manilha = nomeManilha(carta, variante, vira);
  const coringa = ehCoringa(carta);
  const simbolo = simboloCarta(carta);
  const figura = coringa ? undefined : FIGURA[carta.valor];
  const as = !coringa && carta.valor === 'A';
  // O coringa não tem valor impresso: o canto mostra só a estrela.
  const canto: ReactNode = coringa ? (
    simbolo
  ) : (
    <>
      {carta.valor}
      <br />
      {simbolo}
    </>
  );
  return (
    <span
      className={cx(
        base,
        ehVermelha(carta) ? 'vermelha' : 'preta',
        manilha && 'manilha',
        coringa && 'coringa',
        (figura || as) && 'figurada',
      )}
      role="img"
      aria-label={rotuloCarta(carta, variante, vira)}
    >
      <span className="canto" aria-hidden="true">
        {canto}
      </span>
      <span className="canto canto-b" aria-hidden="true">
        {canto}
      </span>
      <span className="naipe-central" aria-hidden="true">
        {simbolo}
      </span>
      {/* Figura/ornamento por cima do naipe simples; o CSS volta ao naipe em carta estreita. */}
      {figura && (
        <span className="figura">
          <FiguraCarta figura={figura} naipe={carta.naipe} />
        </span>
      )}
      {as && (
        <span className="figura figura-as">
          <OrnamentoAs naipe={carta.naipe} />
        </span>
      )}
      {manilha && (
        <span className="selo" aria-hidden="true">
          {manilha}
        </span>
      )}
    </span>
  );
}
