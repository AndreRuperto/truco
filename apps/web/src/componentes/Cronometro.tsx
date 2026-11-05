import type { MsgEstado } from '@truco/protocolo';
import { fracaoRestante, segundosRestantes } from '../logica/prazo';
import { cx } from './cx';

interface Props {
  prazo: NonNullable<MsgEstado['prazo']>;
  agora: number;
  totalMs?: number;
}

export function Cronometro({ prazo, agora, totalMs = 20_000 }: Props) {
  const s = segundosRestantes(prazo, agora) ?? 0;
  return (
    <div className={cx('cronometro', s <= 5 && 'urgente')} role="timer" aria-label={`Sua vez: ${s} segundos`}>
      <div className="cronometro-barra" style={{ transform: `scaleX(${fracaoRestante(prazo, agora, totalMs)})` }} />
      <span>{s}s</span>
    </div>
  );
}
