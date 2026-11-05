import type { Cadeira } from '@truco/engine';
import type { MesaFisica, MsgBatida } from '@truco/protocolo';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { posicaoRelativa } from '../logica/posicoes';
import { movimentoReduzido } from './animacaoMesa';
import { cx } from './cx';
import { Rachaduras } from './Rachaduras';
import './estilos-mesa-fisica.css';

/** Linha da quebra (x% y%), a mesma dos `clip-path` dos pedaços no CSS. */
const LINHA_QUEBRA = '53,0 47,22 55,41 45,63 52,81 47,100';

/**
 * Som da batida (thump sintetizado). O app ainda não tem controle de som/mudo, então fica
 * DESLIGADO por padrão; ligar só junto com um botão de mudo.
 */
export const SOM_BATIDA = false;

/** Quanto tempo a batida fica "viva" na tela (tremor ~250 ms, TUM!, quebra ~900 ms). */
export const DURACAO_BATIDA_MS = 1_000;

type Batida = MsgBatida & { id: number; em: number };

interface Props {
  /** Ausente (servidor antigo) = madeira inteira. */
  fisica?: MesaFisica;
  minha: Cadeira;
  batida?: Batida | null;
  children: ReactNode;
}

let audio: AudioContext | null = null;
/** "Tum" grave e curto, volume baixo. Só toca depois de interação (o AudioContext exige). */
function tocarTum(forca: number): void {
  if (!SOM_BATIDA || typeof AudioContext === 'undefined') return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const ganho = audio.createGain();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    ganho.gain.setValueAtTime(0.08 + 0.12 * forca, t);
    ganho.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(ganho).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  } catch {
    // som é enfeite
  }
}

/** O tampo da mesa: madeira (com rachaduras) ou, depois de quebrada, plástico amarelo de bar. */
export function Tampo({ fisica, minha, batida, children }: Props) {
  const [ativa, setAtiva] = useState<Batida | null>(null);
  const id = batida?.id;

  useEffect(() => {
    if (!batida || Date.now() - batida.em > DURACAO_BATIDA_MS) return;
    setAtiva(batida);
    tocarTum(batida.forca);
    const t = setTimeout(() => setAtiva(null), DURACAO_BATIDA_MS);
    return () => clearTimeout(t);
    // só reage a uma batida nova (o id muda a cada uma)
  }, [id]);

  const tipo = fisica?.tipo ?? 'madeira';
  const quebrando = !!ativa?.quebrou;
  const estilo = ativa ? ({ '--forca': ativa.forca.toFixed(2) } as CSSProperties) : undefined;

  return (
    <div data-testid="tampo" className={cx('tampo', tipo === 'plastico' && 'tampo-plastico', ativa && 'tremendo')} style={estilo}>
      <Rachaduras rachaduras={fisica?.rachaduras ?? []} tipo={tipo} minha={minha} novaId={ativa?.rachadura?.id ?? null} />
      {children}
      {ativa && (
        <span key={ativa.id} className={cx('tum', `pos-${posicaoRelativa(minha, ativa.de)}`)} aria-hidden="true">
          TUM!
        </span>
      )}
      {quebrando && !movimentoReduzido() && (
        <div className="quebra" aria-hidden="true">
          <div className="pedaco esq" />
          <div className="pedaco dir" />
          <svg className="fenda-quebra" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            <polyline className="borda" points={LINHA_QUEBRA} pathLength={1} vectorEffect="non-scaling-stroke" />
            <polyline className="fenda" points={LINHA_QUEBRA} pathLength={1} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      )}
      {quebrando && (
        <span className="so-leitor" role="status">
          Bateram tão forte que a mesa quebrou! Trouxeram uma de plástico.
        </span>
      )}
    </div>
  );
}
