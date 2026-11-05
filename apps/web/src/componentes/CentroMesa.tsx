import { type Cadeira, valorManilhaPaulista, type Variante, type VisaoMao, type VisaoResultadoMao } from '@truco/engine';
import { nomeValor } from '../logica/cartas';
import { posicaoRelativa } from '../logica/posicoes';
import { marcadoresRodadas } from '../logica/textos';
import { CartaVisual } from './CartaVisual';
import { cx } from './cx';

const SIGLA = { nos: 'N', eles: 'E', empate: '=' } as const;
const TITULO = { nos: 'Nossa', eles: 'Deles', empate: 'Cangou' } as const;

interface Props {
  mao: VisaoMao | null;
  /** Mostrada (esmaecida) entre mãos, quando `mao` é null: a carta que decidiu e a vira. */
  ultimaMao: VisaoResultadoMao | null;
  minha: Cadeira;
  variante: Variante;
}

/**
 * Cartas da rodada (ou, com a mesa vazia, as da rodada anterior esmaecidas), vira e rodadas
 * vencidas. Entre mãos, o mesmo da mão que acabou (última rodada esmaecida).
 */
export function CentroMesa({ mao, ultimaMao, minha, variante }: Props) {
  const fonte = mao ?? ultimaMao;
  if (!fonte) return <div className="centro" />;
  const anterior = !mao || mao.mesa.length === 0;
  const jogadas = mao && !anterior ? mao.mesa : (fonte.rodadasJogadas.at(-1) ?? []);
  const vira = fonte.vira;
  return (
    <div className="centro" data-testid="centro">
      {vira && (
        <div className="vira">
          <CartaVisual carta={vira} variante={variante} vira={vira} />
          <span className="vira-rotulo">vira</span>
        </div>
      )}
      <div className="meio">
        {vira && variante === 'paulista' && <span className="vira-manilha">manilha: {nomeValor(valorManilhaPaulista(vira))}</span>}
        <div className="marcadores" aria-label="Rodadas">
          {marcadoresRodadas(fonte.rodadas, minha).map((m, i) => (
            <span key={i} className={cx('marcador', m)} title={`${i + 1}ª rodada: ${TITULO[m]}`}>
              {SIGLA[m]}
            </span>
          ))}
          {Array.from({ length: Math.max(0, 3 - fonte.rodadas.length) }, (_, i) => (
            <span key={`vaga-${i}`} className="marcador vaga" aria-hidden="true" />
          ))}
        </div>
      </div>
      {jogadas.map((j) => (
        <div key={j.cadeira} className={cx('jogada', `pos-${posicaoRelativa(minha, j.cadeira)}`)}>
          <CartaVisual carta={j.coberta ? null : j.carta} variante={variante} vira={vira} esmaecida={anterior} />
        </div>
      ))}
    </div>
  );
}
