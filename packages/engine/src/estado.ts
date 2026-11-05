import type { Carta } from './cartas';
import type { RegrasMesa } from './regras';

export type Cadeira = 0 | 1 | 2 | 3;
export type Dupla = 0 | 1;
export const duplaDe = (c: Cadeira): Dupla => (c % 2) as Dupla;
export const parceiroDe = (c: Cadeira): Cadeira => ((c + 2) % 4) as Cadeira;
export const proximaCadeira = (c: Cadeira): Cadeira => ((c + 1) % 4) as Cadeira;

export type Fase = 'aguardandoDistribuicao' | 'decisaoMao10' | 'jogando' | 'respondendoTruco' | 'fimPartida';
export type TipoMao = 'normal' | 'mao10' | 'mao11';
export type ResultadoRodada = Dupla | 'empate';

export interface Jogada {
  cadeira: Cadeira;
  carta: Carta;
  coberta: boolean;
  forca: number;
}

export interface EstadoMao {
  tipo: TipoMao;
  vira: Carta | null;
  maos: Carta[][];
  /** Jogadas da rodada em andamento. */
  mesa: Jogada[];
  /** Jogadas das rodadas já encerradas. */
  rodadasJogadas: Jogada[][];
  rodadas: ResultadoRodada[];
  vez: Cadeira;
  /** Índice em ESCADAS[pontuacao]: 0 = mão, 1 = truco, 2 = seis, 3 = nove, 4 = doze. */
  nivel: number;
  /** Dupla cuja aposta foi aceita por último; ela não pode aumentar de novo. */
  ultimoAumento: Dupla | null;
  trucoPendente: { dupla: Dupla; proposto: number } | null;
  duplaNoDez: Dupla | null;
}

export interface ResultadoMao {
  vencedor: Dupla | null;
  pontos: number;
  motivo: 'rodadas' | 'correu' | 'mao10Correu';
}

export interface EstadoPartida {
  regras: RegrasMesa;
  placar: [number, number];
  pe: Cadeira;
  fase: Fase;
  mao: EstadoMao | null;
  ultimaMao: ResultadoMao | null;
  /** Último pedido de família; cartas só aparecem na família aberta. */
  ultimaFamilia: { cadeira: Cadeira; cartas: Carta[] | null } | null;
  vencedor: Dupla | null;
}

/** Ações que um jogador (humano ou bot) pode enviar. */
export type AcaoJogador =
  | { tipo: 'jogar'; cadeira: Cadeira; indice: number; coberta?: boolean }
  | { tipo: 'truco'; cadeira: Cadeira }
  | { tipo: 'aceitar'; cadeira: Cadeira }
  | { tipo: 'correr'; cadeira: Cadeira }
  | { tipo: 'aumentar'; cadeira: Cadeira }
  | { tipo: 'familia'; cadeira: Cadeira }
  | { tipo: 'mao10'; cadeira: Cadeira; jogar: boolean };

/** Ações exclusivas do servidor; nunca aceite de um cliente. */
export type AcaoServidor = { tipo: 'distribuir'; baralho: Carta[] };

export type Acao = AcaoJogador | AcaoServidor;

export function novaPartida(regras: RegrasMesa, pe: Cadeira = 0): EstadoPartida {
  return {
    regras,
    placar: [0, 0],
    pe,
    fase: 'aguardandoDistribuicao',
    mao: null,
    ultimaMao: null,
    ultimaFamilia: null,
    vencedor: null,
  };
}
