import type { Carta, Variante } from '@truco/engine';
import { ehVermelha, nomeManilha, rotuloCarta, SIMBOLO } from '../logica/cartas';
import { cx } from './cx';

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
  return (
    <span className={cx(base, ehVermelha(carta) ? 'vermelha' : 'preta', manilha && 'manilha')} role="img" aria-label={rotuloCarta(carta, variante, vira)}>
      <span className="canto" aria-hidden="true">
        {carta.valor}
        <br />
        {SIMBOLO[carta.naipe]}
      </span>
      <span className="naipe-central" aria-hidden="true">
        {SIMBOLO[carta.naipe]}
      </span>
      {manilha && (
        <span className="selo" aria-hidden="true">
          {manilha}
        </span>
      )}
    </span>
  );
}
