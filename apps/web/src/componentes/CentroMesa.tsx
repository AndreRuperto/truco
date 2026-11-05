import type { Cadeira, Variante, VisaoMao } from '@truco/engine';
import { posicaoRelativa } from '../logica/posicoes';
import { marcadoresRodadas } from '../logica/textos';
import { CartaVisual } from './CartaVisual';
import { cx } from './cx';

const SIGLA = { nos: 'N', eles: 'E', empate: '=' } as const;
const TITULO = { nos: 'Nossa', eles: 'Deles', empate: 'Cangou' } as const;

interface Props {
  mao: VisaoMao | null;
  minha: Cadeira;
  variante: Variante;
}

/** Cartas da rodada (ou, com a mesa vazia, as da rodada anterior esmaecidas), vira e rodadas vencidas. */
export function CentroMesa({ mao, minha, variante }: Props) {
  if (!mao) return <div className="centro" />;
  const anterior = mao.mesa.length === 0;
  const jogadas = anterior ? (mao.rodadasJogadas.at(-1) ?? []) : mao.mesa;
  return (
    <div className="centro" data-testid="centro">
      <div className="meio">
        {mao.vira && (
          <div className="vira">
            <CartaVisual carta={mao.vira} variante={variante} vira={mao.vira} tamanho="pequena" />
            <small>vira</small>
          </div>
        )}
        <div className="marcadores" aria-label="Rodadas">
          {marcadoresRodadas(mao.rodadas, minha).map((m, i) => (
            <span key={i} className={cx('marcador', m)} title={`${i + 1}ª rodada: ${TITULO[m]}`}>
              {SIGLA[m]}
            </span>
          ))}
        </div>
      </div>
      {jogadas.map((j) => (
        <div key={j.cadeira} className={cx('jogada', `pos-${posicaoRelativa(minha, j.cadeira)}`)}>
          <CartaVisual carta={j.coberta ? null : j.carta} variante={variante} vira={mao.vira} esmaecida={anterior} />
        </div>
      ))}
    </div>
  );
}
