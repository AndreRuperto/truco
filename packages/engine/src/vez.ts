import { type Cadeira, duplaDe, type EstadoMao, type EstadoRitual, type Fase } from './estado';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

/** O mínimo para saber de quem é a vez: serve tanto para `EstadoPartida` quanto para `Visao`. */
export interface SituacaoVez {
  fase: Fase;
  mao:
    | (Pick<EstadoMao, 'vez' | 'trucoPendente' | 'duplaNoDez' | 'familiaPendente'> & {
        familias: readonly { cadeira: Cadeira }[];
      })
    | null;
  ritual?: Pick<EstadoRitual, 'embaralhador' | 'cortador'> | null;
}

/**
 * Cadeiras que precisam agir agora: no ritual, quem está com o monte (embaralhador ou
 * cortador); a da vez ao jogar; a dupla que não pediu durante um truco pendente ou uma
 * família fechada esperando conferência; a dupla no dez na decisão da mão de 10.
 */
export function quemDeveAgir(s: SituacaoVez): Cadeira[] {
  const r = s.ritual;
  if (r && (s.fase === 'embaralhando' || s.fase === 'escolhendoDistribuicao')) return [r.embaralhador];
  if (r && s.fase === 'cortando') return [r.cortador];
  const m = s.mao;
  if (!m) return [];
  if (s.fase === 'jogando') return [m.vez];
  if (s.fase === 'respondendoTruco' && m.trucoPendente) {
    const pediu = m.trucoPendente.dupla;
    return CADEIRAS.filter((c) => duplaDe(c) !== pediu);
  }
  if (s.fase === 'conferindoFamilia' && m.familiaPendente !== null) {
    const pediu = duplaDe(m.familias[m.familiaPendente].cadeira);
    return CADEIRAS.filter((c) => duplaDe(c) !== pediu);
  }
  if (s.fase === 'decisaoMao10') return CADEIRAS.filter((c) => duplaDe(c) === m.duplaNoDez);
  return [];
}
