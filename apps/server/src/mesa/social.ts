import {
  type Cadeira,
  type Carta,
  duplaDe,
  ehCoringa,
  type EstadoPartida,
  manilhaDoNaipe,
  melhorManilha,
  type Naipe,
  type ResultadoRodada,
  type Variante,
} from '@truco/engine';
import type { Fala, Sinal } from './protocolo';

const SINAL_DO_NAIPE: Record<Naipe, Sinal> = { paus: 'zap', copas: 'copas', espadas: 'espadilha', ouros: 'picafumo' };
const NAIPE_DO_SINAL: Partial<Record<Sinal, Naipe>> = { zap: 'paus', copas: 'copas', espadilha: 'espadas', picafumo: 'ouros' };
const SEM_MANILHA: [Carta['valor'], Sinal][] = [
  ['3', 'tres'],
  ['2', 'dois'],
  ['A', 'as'],
];

/** O sinal que um bot manda ao parceiro com esta mão: a melhor manilha; senão coringa (mão limpa); senão 3, 2, Ás; senão "nada". */
export function sinalDaMao(mao: readonly Carta[], variante: Variante, vira: Carta | null): Sinal {
  const m = melhorManilha(mao, variante, vira);
  if (m) return SINAL_DO_NAIPE[m.naipe];
  if (mao.some(ehCoringa)) return 'coringa';
  for (const [valor, sinal] of SEM_MANILHA) if (mao.some((c) => c.valor === valor)) return sinal;
  return 'nada';
}

/** A carta exata que um sinal anuncia (só sinais de manilha), ou null. */
export function cartaDoSinal(sinal: Sinal, variante: Variante, vira: Carta | null): Carta | null {
  const naipe = NAIPE_DO_SINAL[sinal];
  return naipe ? manilhaDoNaipe(naipe, variante, vira) : null;
}

/** Comentário de um bot ao fim de uma rodada. `sorte` ∈ [0, 1) escolhe entre "boa" e "bora". */
export function falaDaRodada(resultado: ResultadoRodada, cadeira: Cadeira, sorte: number): Fala | null {
  if (resultado === 'empate') return null;
  if (resultado !== duplaDe(cadeira)) return 'vixe';
  return sorte < 0.5 ? 'boa' : 'bora';
}

/**
 * Resultado da rodada que a jogada `antes → depois` fechou (inclusive a que encerrou a mão), ou null.
 * Use só depois de uma ação `jogar` (pedir família zera a mão e deixaria a `ultimaMao` antiga à vista).
 */
export function rodadaFechada(antes: EstadoPartida, depois: EstadoPartida): ResultadoRodada | null {
  if (!antes.mao) return null;
  const n = antes.mao.rodadas.length;
  const rodadas = depois.mao ? depois.mao.rodadas : (depois.ultimaMao?.rodadas ?? []);
  return rodadas.length > n ? rodadas[rodadas.length - 1] : null;
}
