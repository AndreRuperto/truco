import type { Carta } from './cartas';
import { type Cadeira, duplaDe, type EstadoMao, type EstadoPartida, type Jogada, parceiroDe } from './estado';

export type JogadaVisivel = Omit<Jogada, 'carta'> & { carta: Carta | null };

export interface VisaoMao extends Omit<EstadoMao, 'maos' | 'mesa' | 'rodadasJogadas'> {
  /** null = carta virada (mão de ferro). */
  minhaMao: (Carta | null)[];
  maoParceiro: Carta[] | null;
  qtdCartas: number[];
  mesa: JogadaVisivel[];
  rodadasJogadas: JogadaVisivel[][];
}

export interface Visao extends Omit<EstadoPartida, 'mao'> {
  cadeira: Cadeira;
  mao: VisaoMao | null;
}

export function visaoDoJogador(estado: EstadoPartida, cadeira: Cadeira): Visao {
  const s = structuredClone(estado);
  if (!s.mao) return { ...s, cadeira, mao: null };

  const { maos, mesa, rodadasJogadas, ...resto } = s.mao;
  const esconder = (j: Jogada): JogadaVisivel =>
    j.coberta && j.cadeira !== cadeira ? { ...j, carta: null } : j;
  const veParceiro = resto.tipo === 'mao10' && resto.duplaNoDez === duplaDe(cadeira);

  return {
    ...s,
    cadeira,
    mao: {
      ...resto,
      minhaMao: resto.tipo === 'mao11' ? maos[cadeira].map(() => null) : maos[cadeira],
      maoParceiro: veParceiro ? maos[parceiroDe(cadeira)] : null,
      qtdCartas: maos.map((m) => m.length),
      mesa: mesa.map(esconder),
      rodadasJogadas: rodadasJogadas.map((r) => r.map(esconder)),
    },
  };
}
