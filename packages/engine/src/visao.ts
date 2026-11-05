import type { Carta } from './cartas';
import {
  type Cadeira,
  duplaDe,
  type EstadoMao,
  type EstadoPartida,
  type EstadoRitual,
  type FamiliaPedida,
  type Jogada,
  parceiroDe,
  type ResultadoMao,
} from './estado';

export type JogadaVisivel = Omit<Jogada, 'carta'> & { carta: Carta | null };

export interface FamiliaVisivel extends Omit<FamiliaPedida, 'cartas'> {
  /** null = fechada e não conferida, vista por quem não pediu (3 versos). */
  cartas: Carta[] | null;
}

export interface VisaoMao extends Omit<EstadoMao, 'maos' | 'mesa' | 'rodadasJogadas' | 'familias'> {
  /** null = carta virada (mão de ferro). */
  minhaMao: (Carta | null)[];
  maoParceiro: Carta[] | null;
  qtdCartas: number[];
  mesa: JogadaVisivel[];
  rodadasJogadas: JogadaVisivel[][];
  familias: FamiliaVisivel[];
}

export interface VisaoRitual extends Omit<EstadoRitual, 'dadas'> {
  /** Quem vai receber o "dar 3"; as cartas ninguém vê. */
  dadas: Cadeira | null;
}

export interface VisaoResultadoMao extends Omit<ResultadoMao, 'rodadasJogadas'> {
  rodadasJogadas: JogadaVisivel[][];
}

export interface Visao extends Omit<EstadoPartida, 'mao' | 'ultimaMao' | 'monte' | 'ritual'> {
  cadeira: Cadeira;
  mao: VisaoMao | null;
  ultimaMao: VisaoResultadoMao | null;
  /** Cartas no monte (a ordem ninguém vê). */
  qtdMonte: number;
  ritual: VisaoRitual | null;
}

export function visaoDoJogador(estado: EstadoPartida, cadeira: Cadeira): Visao {
  const { monte, ritual, ...s } = structuredClone(estado);
  const esconder = (j: Jogada): JogadaVisivel =>
    j.coberta && j.cadeira !== cadeira ? { ...j, carta: null } : j;
  const ultimaMao: VisaoResultadoMao | null = s.ultimaMao && {
    ...s.ultimaMao,
    rodadasJogadas: s.ultimaMao.rodadasJogadas.map((r) => r.map(esconder)),
  };
  const base = {
    ...s,
    cadeira,
    ultimaMao,
    qtdMonte: monte.length,
    ritual: ritual ? { ...ritual, dadas: ritual.dadas?.cadeira ?? null } : null,
  };
  if (!s.mao) return { ...base, mao: null };

  const { maos, mesa, rodadasJogadas, familias, ...resto } = s.mao;
  const veParceiro = resto.tipo === 'mao10' && resto.duplaNoDez === duplaDe(cadeira);
  const familia = (f: FamiliaPedida): FamiliaVisivel => ({
    ...f,
    cartas: f.tipo === 'aberta' || f.conferida !== null || f.cadeira === cadeira ? f.cartas : null,
  });

  return {
    ...base,
    mao: {
      ...resto,
      minhaMao: resto.tipo === 'mao11' ? maos[cadeira].map(() => null) : maos[cadeira],
      maoParceiro: veParceiro ? maos[parceiroDe(cadeira)] : null,
      qtdCartas: maos.map((m) => m.length),
      mesa: mesa.map(esconder),
      rodadasJogadas: rodadasJogadas.map((r) => r.map(esconder)),
      familias: familias.map(familia),
    },
  };
}
