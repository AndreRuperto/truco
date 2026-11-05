import type { Carta } from './cartas';
import type { RegrasMesa } from './regras';
import type { ModoDistribuicao } from './ritual';

export type Cadeira = 0 | 1 | 2 | 3;
export type Dupla = 0 | 1;
export const duplaDe = (c: Cadeira): Dupla => (c % 2) as Dupla;
export const parceiroDe = (c: Cadeira): Cadeira => ((c + 2) % 4) as Cadeira;
export const proximaCadeira = (c: Cadeira): Cadeira => ((c + 1) % 4) as Cadeira;

export type Fase =
  | 'aguardandoMonte'
  | 'embaralhando'
  | 'cortando'
  | 'escolhendoDistribuicao'
  | 'decisaoMao10'
  | 'jogando'
  | 'respondendoTruco'
  | 'conferindoFamilia'
  | 'fimPartida';

const FASES_RITUAL: readonly Fase[] = ['embaralhando', 'cortando', 'escolhendoDistribuicao'];
/** Embaralhar, cortar ou escolher como dar (o monte está na mão de alguém). */
export const ehFaseRitual = (f: Fase): boolean => FASES_RITUAL.includes(f);

export type TipoMao = 'normal' | 'mao10' | 'mao11';
export type ResultadoRodada = Dupla | 'empate';

export interface Jogada {
  cadeira: Cadeira;
  carta: Carta;
  coberta: boolean;
  forca: number;
}

export interface EstadoRitual {
  /** Quem embaralha e dá as cartas (= pe). */
  embaralhador: Cadeira;
  /** Quem corta: à esquerda do embaralhador, (pe + 3) % 4. */
  cortador: Cadeira;
  /** Riffles do embaralhador nesta mão. */
  embaralhadas: number;
  /** Movimentos já gastos pelo cortador (0..3). */
  movimentos: number;
  /** "Abrir 3": as 3 de cima, viradas para todos; saem desta mão. */
  abertas: Carta[];
  /** "Dar 3": as 3 de cima, fechadas, são a mão do parceiro do cortador. */
  dadas: { cadeira: Cadeira; cartas: Carta[] } | null;
}

export interface FamiliaPedida {
  cadeira: Cadeira;
  tipo: 'fechada' | 'aberta';
  /** As 3 cartas que quem pediu pôs na mesa (fechada pode ser blefe). */
  cartas: Carta[];
  /** null = ninguém conferiu (ainda, ou não vai mais). */
  conferida: { por: Cadeira; real: boolean } | null;
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
  /** Como o pé deu as cartas. */
  modo: ModoDistribuicao;
  /** Quem recebeu o "dar 3" e ficou fora da distribuição. */
  pulada: Cadeira | null;
  /** As 3 do "abrir 3" (contam como uma família fechada no limite). */
  abertasNoCorte: Carta[];
  /** Famílias pedidas nesta mão, na ordem. */
  familias: FamiliaPedida[];
  /** Índice em `familias` da fechada esperando a dupla adversária conferir. */
  familiaPendente: number | null;
}

export interface ResultadoMao {
  vencedor: Dupla | null;
  pontos: number;
  motivo: 'rodadas' | 'correu' | 'mao10Correu' | 'familia';
  /** Resultado de cada rodada encerrada. */
  rodadas: ResultadoRodada[];
  /**
   * Cartas jogadas na mão, por rodada. Se a mão acabou no meio de uma rodada
   * (correu), a última entrada é a rodada incompleta e não tem item em `rodadas`.
   */
  rodadasJogadas: Jogada[][];
  vira: Carta | null;
}

export interface EstadoPartida {
  regras: RegrasMesa;
  placar: [number, number];
  pe: Cadeira;
  fase: Fase;
  /** Monte físico (índice 0 = topo). Persiste entre mãos; ninguém vê a ordem. */
  monte: Carta[];
  /** Embaralhar/cortar/escolher como dar; null fora dessas fases. */
  ritual: EstadoRitual | null;
  mao: EstadoMao | null;
  ultimaMao: ResultadoMao | null;
  vencedor: Dupla | null;
}

/**
 * Ações que um jogador (humano ou bot) pode enviar. `bits` e `ponto` são a sorte do
 * servidor: quem decide manda sem, e só o servidor completa (ver `completarSorte`).
 */
export type AcaoJogador =
  | { tipo: 'jogar'; cadeira: Cadeira; indice: number; coberta?: boolean }
  | { tipo: 'truco'; cadeira: Cadeira }
  | { tipo: 'aceitar'; cadeira: Cadeira }
  | { tipo: 'correr'; cadeira: Cadeira }
  | { tipo: 'aumentar'; cadeira: Cadeira }
  | { tipo: 'familia'; cadeira: Cadeira }
  | { tipo: 'mao10'; cadeira: Cadeira; jogar: boolean }
  | { tipo: 'embaralhar'; cadeira: Cadeira; bits?: (0 | 1)[] }
  | { tipo: 'passarCorte'; cadeira: Cadeira }
  | { tipo: 'cortar'; cadeira: Cadeira; ponto?: number }
  | { tipo: 'abrir3'; cadeira: Cadeira }
  | { tipo: 'dar3'; cadeira: Cadeira }
  | { tipo: 'devolver'; cadeira: Cadeira }
  | { tipo: 'distribuir'; cadeira: Cadeira; modo: ModoDistribuicao }
  | { tipo: 'conferir'; cadeira: Cadeira; conferir: boolean };

/** Ações exclusivas do servidor; nunca aceite de um cliente. Só na 1ª mão da partida. */
export type AcaoServidor = { tipo: 'monte'; baralho: Carta[] };

export type Acao = AcaoJogador | AcaoServidor;

export function novaPartida(regras: RegrasMesa, pe: Cadeira = 0): EstadoPartida {
  return {
    regras: { ...regras },
    placar: [0, 0],
    pe,
    fase: 'aguardandoMonte',
    monte: [],
    ritual: null,
    mao: null,
    ultimaMao: null,
    vencedor: null,
  };
}
