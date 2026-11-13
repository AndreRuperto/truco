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
  /** Começa outra partida igual; sem ele, só dá para voltar ao início. */
  aoJogarDeNovo?: () => void;
  aoVoltar: () => void;
  /**
   * Revanche na mesma mesa (mesma turma): no lugar de "Jogar de novo". `jaPedi` = esperando os
   * outros; `quantos` = quem pediu / quantos humanos são.
   */
  revanche?: { aoPedir: () => void; jaPedi: boolean; quantos: [number, number] } | null;
  /** Mesa valendo Fichas: o que estava em jogo. */
  cacife?: { efetivo: number | null; pote: number } | null;
  /** Ranqueada repetida entre o mesmo grupo de contas em 24 h: o Elo não mudou. */
  eloCongelado?: boolean;
}

export function FimDePartida({ titulo, placar, venceu, aoJogarDeNovo, aoVoltar, revanche = null, cacife = null, eloCongelado = false }: PropsFim) {
  const [pediram, total] = revanche?.quantos ?? [0, 0];
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-fim" data-testid="fim-partida">
      <div className={cx('overlay-caixa', 'resultado-partida', venceu ? 'vitoria' : 'derrota')}>
        <div className="resultado-decoracao" aria-hidden="true">{venceu ? '★' : '♠'}</div>
        <span className="resultado-selo">Fim de partida</span>
        <h2 id="titulo-fim">{titulo}</h2>
        <p className="resultado-placar">{placar}</p>
        <p className="resultado-legenda">{venceu ? 'Vitória da sua dupla. Boa jogada!' : 'Partida encerrada. A próxima mão pode ser sua.'}</p>
        {cacife?.efetivo ? (
          <p className="resultado-fichas" data-testid="resultado-fichas">
            {venceu
              ? `O pote de ${cacife.pote} Fichas vai para a sua dupla.`
              : `Valia ${cacife.efetivo} Fichas: o pote foi para os adversários.`}
          </p>
        ) : null}
        {eloCongelado && (
          <p className="resultado-fichas" data-testid="elo-congelado">
            Vocês já se enfrentaram 5 vezes hoje. Esta partida não mudou o ranking.
          </p>
        )}
        {revanche ? (
          <>
            <button type="button" className="botao-principal" onClick={revanche.aoPedir} disabled={revanche.jaPedi} autoFocus>
              {revanche.jaPedi ? 'Esperando os outros…' : total > 1 ? 'Revanche com a mesma turma' : 'Jogar de novo'}
            </button>
            {total > 1 && (
              <p className="revanche-placar" role="status">
                {pediram} de {total} querem revanche
              </p>
            )}
          </>
        ) : (
          aoJogarDeNovo && (
            <button type="button" className="botao-principal" onClick={aoJogarDeNovo} autoFocus>
              Jogar de novo
            </button>
          )
        )}
        <button
          type="button"
          className={aoJogarDeNovo || revanche ? 'botao-secundario' : 'botao-principal'}
          onClick={aoVoltar}
          autoFocus={!aoJogarDeNovo && !revanche}
        >
          Voltar ao início
        </button>
      </div>
    </div>
  );
}
