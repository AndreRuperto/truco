import { type Cadeira, duplaDe, type Visao } from '@truco/engine';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

/**
 * Quem tem que agir agora — o mesmo `quemDeveAgir` do servidor (`apps/server/src/mesa/Mesa.ts`),
 * a partir da `Visao`. O indicador de vez vem daqui; o `prazo` só alimenta os cronômetros
 * (ele só lista humanos, e na resposta a truco o parceiro bot também pode responder).
 */
export function quemDeveAgir(v: Visao): Cadeira[] {
  const m = v.mao;
  if (!m) return [];
  if (v.fase === 'jogando') return [m.vez];
  if (v.fase === 'respondendoTruco' && m.trucoPendente) {
    const pediu = m.trucoPendente.dupla;
    return CADEIRAS.filter((c) => duplaDe(c) !== pediu);
  }
  if (v.fase === 'decisaoMao10') return CADEIRAS.filter((c) => duplaDe(c) === m.duplaNoDez);
  return [];
}
