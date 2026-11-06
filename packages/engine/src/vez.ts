import { type Cadeira, duplaDe, type EstadoMao, type EstadoRitual, type Fase } from './estado';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

/** O mínimo para saber de quem é a vez: serve tanto para `EstadoPartida` quanto para `Visao`. */
export interface SituacaoVez {
  fase: Fase;
  mao:
    | (Pick<EstadoMao, 'vez' | 'trucoPendente' | 'duplaNoDez' | 'familiaPendente' | 'cangada'> & {
        familias: readonly { cadeira: Cadeira }[];
      })
    | null;
  ritual?: Pick<EstadoRitual, 'embaralhador' | 'cortador'> | null;
}

/**
 * Cadeiras que precisam agir agora: no ritual, quem está com o monte (embaralhador ou
 * cortador); a da vez ao jogar; a dupla que não pediu durante um truco pendente ou uma
 * família fechada esperando conferência; a dupla no dez na decisão da mão de 10.
 *
 * Atenção: em `jogando` devolve só a da vez, mas na janela de família (`janelaDeFamilia`)
 * qualquer cadeira pode pedir. Quem roda a mesa precisa consultar também quem NÃO é da vez
 * (a `Mesa` do servidor pergunta aos bots fora da vez a cada mudança de estado). Na
 * conferência, um `conferir` de qualquer um dos dois fecha para a dupla, e o engine não tem
 * prazo: o servidor manda `conferir: false` quando o prazo acaba.
 */
export function quemDeveAgir(s: SituacaoVez): Cadeira[] {
  const r = s.ritual;
  if (r && (s.fase === 'embaralhando' || s.fase === 'escolhendoDistribuicao')) return [r.embaralhador];
  if (r && s.fase === 'cortando') return [r.cortador];
  const m = s.mao;
  if (!m) return [];
  if (s.fase === 'jogando') return [m.vez];
  // Cangou: todos escolhem a de cima ao mesmo tempo.
  if (s.fase === 'empilhando' && m.cangada) return CADEIRAS.filter((c) => !m.cangada!.empilhou[c]);
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
