import type { MsgEstado } from '@truco/protocolo';
import { useState } from 'react';
import { fracaoRestante, segundosRestantes } from '../logica/prazo';
import { cx } from './cx';

interface Props {
  prazo: NonNullable<MsgEstado['prazo']>;
  agora: number;
  /** Início do rótulo acessível ("Sua vez", "Vez de Bia"). */
  rotulo?: string;
  /** Versão compacta, dentro do assento de outro jogador. */
  pequeno?: boolean;
}

/**
 * A mensagem `prazo` só traz `ate`; o total da barra é o que restava quando esse `ate`
 * apareceu (o prazo varia: jogada, resposta a truco, mão de onze...).
 */
function useTotalDoPrazo(ate: number, agora: number): number {
  const [atual, setAtual] = useState(() => ({ ate, total: ate - agora }));
  if (atual.ate === ate) return atual.total;
  const novo = { ate, total: ate - agora };
  setAtual(novo); // atualização durante o render (padrão "estado derivado" do React)
  return novo.total;
}

export function Cronometro({ prazo, agora, rotulo = 'Sua vez', pequeno = false }: Props) {
  const totalMs = useTotalDoPrazo(prazo.ate, agora);
  const s = segundosRestantes(prazo, agora) ?? 0;
  return (
    <div className={cx('cronometro', pequeno && 'pequeno', s <= 5 && 'urgente')} role="timer" aria-label={`${rotulo}: ${s} segundos`}>
      <div className="cronometro-barra" style={{ transform: `scaleX(${fracaoRestante(prazo, agora, totalMs)})` }} />
      <span>{s}s</span>
    </div>
  );
}
