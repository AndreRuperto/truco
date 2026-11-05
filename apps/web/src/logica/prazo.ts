import type { MsgEstado } from '@truco/protocolo';

type Prazo = MsgEstado['prazo'];

/**
 * Segundos (arredondados para cima) até `prazo.ate`. O `ate` é o relógio do servidor;
 * em produção pode haver poucos segundos de diferença — aceitável para um cronômetro.
 */
export function segundosRestantes(prazo: Prazo, agora: number): number | null {
  if (!prazo) return null;
  return Math.max(0, Math.ceil((prazo.ate - agora) / 1000));
}

/** Fração restante (0..1) para a barra, assumindo jogada de `totalMs`. */
export function fracaoRestante(prazo: Prazo, agora: number, totalMs = 20_000): number {
  if (!prazo) return 0;
  return Math.min(1, Math.max(0, (prazo.ate - agora) / totalMs));
}

export const prazoEhMeu = (msg: MsgEstado): boolean => !!msg.prazo?.cadeiras.includes(msg.minhaCadeira);
