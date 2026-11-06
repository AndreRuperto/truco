import { type Cadeira, type Variante, type VisaoMao, type VisaoResultadoMao } from '@truco/engine';
import { type ReactNode, useRef } from 'react';
import { exibicaoMesa } from '../logica/jogadas';
import { posicaoRelativa } from '../logica/posicoes';
import { marcadoresRodadas } from '../logica/textos';
import { useAnimacaoJogadas } from './animacaoMesa';
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
  /** Monte e linha de estado do ritual (por cima da cruz). */
  extra?: ReactNode;
}

/**
 * Cartas da rodada (ou, com a mesa vazia, as da rodada anterior esmaecidas), vira e rodadas
 * vencidas. Entre mãos, o mesmo da mão que acabou (última rodada esmaecida).
 */
export function CentroMesa({ mao, ultimaMao, minha, variante, extra }: Props) {
  const centro = useRef<HTMLDivElement>(null);
  const camada = useRef<HTMLDivElement>(null);
  const exibicao = exibicaoMesa(mao, ultimaMao);
  useAnimacaoJogadas(exibicao, minha, centro, camada);
  const fonte = mao ?? ultimaMao;
  // A camada de animação fica fora do centro (irmã, no tampo): mãos e cópias não contam como jogadas.
  const capa = <div ref={camada} className="camada-voo" aria-hidden="true" />;
  const { anterior } = exibicao;
  const vira = fonte?.vira ?? null;
  // Uma árvore só (com ou sem mão): o `extra` (monte, linha de estado) não é remontado entre mãos.
  return (
    <>
      <div ref={centro} className="centro" data-testid="centro">
        {extra}
        {vira && (
          <div className="vira">
            <CartaVisual carta={vira} variante={variante} vira={vira} />
            <span className="vira-rotulo">vira</span>
          </div>
        )}
        {fonte && (
          <div className="meio">
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
        )}
        {exibicao.jogadas.map(({ chave, jogada: j }) => (
          <div key={chave} data-chave={chave} className={cx('jogada', `pos-${posicaoRelativa(minha, j.cadeira)}`)}>
            <CartaVisual carta={j.coberta ? null : j.carta} variante={variante} vira={vira} esmaecida={anterior} />
          </div>
        ))}
      </div>
      {capa}
    </>
  );
}
