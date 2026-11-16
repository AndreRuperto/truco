import { type Cadeira, type Variante, type VisaoMao, type VisaoResultadoMao } from '@truco/engine';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import type { Exibicao } from '../logica/jogadas';
import { exibicaoMesa } from '../logica/jogadas';
import { posicaoRelativa } from '../logica/posicoes';
import { marcadoresRodadas } from '../logica/textos';
import { useAnimacaoJogadas } from './animacaoMesa';
import { CartaVisual } from './CartaVisual';
import { cx } from './cx';

const SIGLA = { nos: 'N', eles: 'E', empate: '=' } as const;
/** Quanto a rodada que acabou fica no meio (para ver quem levou) antes de ir para a pilha do canto. */
export const MOSTRA_RODADA_MS = 1_400;
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
  const { exibicao, naPilha } = useRodadaNaMesa(mao, ultimaMao);
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
        {mao && (
          <div className="pilha-rodadas" aria-label={naPilha > 0 ? `${naPilha} ${naPilha === 1 ? 'rodada recolhida' : 'rodadas recolhidas'}` : undefined}>
            {Array.from({ length: naPilha }, (_, i) => (
              <span key={i} className="pilha-rodada" style={{ '--i': i } as CSSProperties} aria-hidden="true">
                <CartaVisual carta={null} variante={variante} vira={null} />
              </span>
            ))}
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

/**
 * O que fica no meio da mesa: a rodada em andamento ou, no meio da mão, a que acabou de fechar
 * por `MOSTRA_RODADA_MS` (para ver quem levou); depois o meio fica limpo e ela conta na pilha.
 * Serve ao centro 2D e à vista 3D.
 */
export function useRodadaNaMesa(mao: VisaoMao | null, ultimaMao: VisaoResultadoMao | null): { exibicao: Exibicao; naPilha: number } {
  const completa = exibicaoMesa(mao, ultimaMao);
  const chaveRodada = mao && completa.anterior && completa.jogadas.length > 0 ? completa.jogadas.map((j) => j.chave).join(',') : null;
  const [limpa, setLimpa] = useState<string | null>(null);
  useEffect(() => {
    if (!chaveRodada) return;
    const t = setTimeout(() => setLimpa(chaveRodada), MOSTRA_RODADA_MS);
    return () => clearTimeout(t);
  }, [chaveRodada]);
  // Na cangada cada um mostra a sua na vez dele: as cartas entram no centro como jogadas normais.
  // Cangada indo para as de baixo (no mineiro, as de cima viram juntas): as de cima ficam à vista
  // até a 1ª de baixo ser aberta.
  const deCimaAVista = mao?.cangada?.etapa === 'baixo' && mao.mesa.length === 0 && mao.rodadas.length === 2;
  const limpou = chaveRodada !== null && limpa === chaveRodada && !deCimaAVista;
  const exibicao = limpou ? { ...completa, jogadas: [] } : completa;
  // Rodadas já recolhidas: todas as encerradas, menos a que ainda está no meio.
  const naPilha = mao ? mao.rodadasJogadas.length - (completa.anterior && !limpou && completa.jogadas.length > 0 ? 1 : 0) : 0;
  return { exibicao, naPilha };
}

