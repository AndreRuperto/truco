import type { Carta } from './cartas';
import {
  type Cadeira,
  duplaDe,
  type EstadoMao,
  type EstadoPartida,
  type Jogada,
  parceiroDe,
  type ResultadoMao,
} from './estado';

export type JogadaVisivel = Omit<Jogada, 'carta'> & { carta: Carta | null };

export interface VisaoMao extends Omit<EstadoMao, 'maos' | 'mesa' | 'rodadasJogadas'> {
  /** null = carta virada (mão de ferro). */
  minhaMao: (Carta | null)[];
  maoParceiro: Carta[] | null;
  qtdCartas: number[];
  mesa: JogadaVisivel[];
  rodadasJogadas: JogadaVisivel[][];
}

export interface VisaoResultadoMao extends Omit<ResultadoMao, 'rodadasJogadas'> {
  rodadasJogadas: JogadaVisivel[][];
}

export interface Visao extends Omit<EstadoPartida, 'mao' | 'ultimaMao'> {
  cadeira: Cadeira;
  mao: VisaoMao | null;
  ultimaMao: VisaoResultadoMao | null;
}

export function visaoDoJogador(estado: EstadoPartida, cadeira: Cadeira): Visao {
  const s = structuredClone(estado);
  const esconder = (j: Jogada): JogadaVisivel =>
    j.coberta && j.cadeira !== cadeira ? { ...j, carta: null } : j;
  const ultimaMao: VisaoResultadoMao | null = s.ultimaMao && {
    ...s.ultimaMao,
    rodadasJogadas: s.ultimaMao.rodadasJogadas.map((r) => r.map(esconder)),
  };
  if (!s.mao) return { ...s, cadeira, ultimaMao, mao: null };

  const { maos, mesa, rodadasJogadas, ...resto } = s.mao;
  const veParceiro = resto.tipo === 'mao10' && resto.duplaNoDez === duplaDe(cadeira);

  return {
    ...s,
    cadeira,
    ultimaMao,
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
