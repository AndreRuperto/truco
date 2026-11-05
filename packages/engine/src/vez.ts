import { type Cadeira, duplaDe, type EstadoMao, type Fase } from './estado';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

/** O mínimo para saber de quem é a vez: serve tanto para `EstadoPartida` quanto para `Visao`. */
export interface SituacaoVez {
  fase: Fase;
  mao: Pick<EstadoMao, 'vez' | 'trucoPendente' | 'duplaNoDez'> | null;
}

/**
 * Cadeiras que precisam agir agora: a da vez ao jogar; a dupla que não pediu
 * durante um truco pendente; a dupla no dez na decisão da mão de 10.
 */
export function quemDeveAgir(s: SituacaoVez): Cadeira[] {
  const m = s.mao;
  if (!m) return [];
  if (s.fase === 'jogando') return [m.vez];
  if (s.fase === 'respondendoTruco' && m.trucoPendente) {
    const pediu = m.trucoPendente.dupla;
    return CADEIRAS.filter((c) => duplaDe(c) !== pediu);
  }
  if (s.fase === 'decisaoMao10') return CADEIRAS.filter((c) => duplaDe(c) === m.duplaNoDez);
  return [];
}
