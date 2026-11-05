import type { ReactNode } from 'react';
import { cx } from './cx';

/** Resumo rápido entre mãos (não bloqueia cliques; some quando a próxima mão é distribuída). */
export function FimDeMao({ titulo, detalhe, children }: { titulo: string; detalhe: string; children?: ReactNode }) {
  return (
    <div className="overlay leve" role="status" data-testid="fim-mao">
      <div className="overlay-caixa">
        <h2>{titulo}</h2>
        <p>{detalhe}</p>
        {children}
      </div>
    </div>
  );
}

interface PropsFim {
  titulo: string;
  placar: string;
  venceu: boolean;
  aoJogarDeNovo: () => void;
}

export function FimDePartida({ titulo, placar, venceu, aoJogarDeNovo }: PropsFim) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-fim" data-testid="fim-partida">
      <div className={cx('overlay-caixa', venceu && 'vitoria')}>
        <h2 id="titulo-fim">{titulo}</h2>
        <p>{placar}</p>
        <button type="button" className="botao-principal" onClick={aoJogarDeNovo} autoFocus>
          Jogar de novo
        </button>
      </div>
    </div>
  );
}
