import type { AcaoJogador } from '@truco/engine';

export interface Contadores {
  trucosPedidos: number;
  respostasTruco: number;
  trucosAceitos: number;
  corridas: number;
}

export const contadoresZerados = (): Contadores => ({ trucosPedidos: 0, respostasTruco: 0, trucosAceitos: 0, corridas: 0 });

/** Conta uma ação deliberada de humano (as automáticas por tempo não passam por aqui). */
export function contarAcao(c: Contadores, a: AcaoJogador): Contadores {
  const n = { ...c };
  if (a.tipo === 'truco') n.trucosPedidos++;
  else if (a.tipo === 'aumentar') {
    n.trucosPedidos++;
    n.respostasTruco++;
    n.trucosAceitos++;
  } else if (a.tipo === 'aceitar') {
    n.respostasTruco++;
    n.trucosAceitos++;
  } else if (a.tipo === 'correr') {
    n.respostasTruco++;
    n.corridas++;
  } else if (a.tipo === 'mao10' && !a.jogar) n.corridas++;
  return n;
}

/** Porcentagem inteira; null quando não há base. */
export function percentual(parte: number, total: number): number | null {
  return total > 0 ? Math.round((100 * parte) / total) : null;
}
