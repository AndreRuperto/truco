import {
  acoesValidas,
  type Cadeira,
  type Carta,
  type EstadoPartida,
  idCarta,
  type Naipe,
  novaPartida,
  novoBaralho,
  reduce,
  REGRAS_RANQUEADA,
  type RegrasMesa,
  type Valor,
  visaoDoJogador,
} from '@truco/engine';
import type { InfoCadeira, MsgEstado } from '@truco/protocolo';

const N: Record<string, Naipe> = { o: 'ouros', e: 'espadas', c: 'copas', p: 'paus' };
export const c = (s: string): Carta => ({ valor: s.slice(0, -1) as Valor, naipe: N[s.slice(-1)] });

export const PAULISTA: RegrasMesa = { ...REGRAS_RANQUEADA.paulista };
export const MINEIRO: RegrasMesa = { ...REGRAS_RANQUEADA.mineiro };

/**
 * Baralho que entrega `maos[cadeira]` com pe = 3 (a cadeira 0 começa). Sem `maos`, é a
 * ordem de `novoBaralho()`: cadeira 0 = 4♦ 5♦ 6♦, 1 = 4♠ 5♠ 6♠, 2 = 4♥ 5♥ 6♥,
 * 3 = 4♣ 5♣ 6♣ e vira 7♦ (no paulista a manilha é a Dama; no mineiro a 3 tem o zap).
 */
export function baralhoCom(maos: string[][] = [], vira?: string): Carta[] {
  const fixas: (Carta | undefined)[] = new Array(40).fill(undefined);
  maos.forEach((mao, cad) => mao.forEach((s, i) => (fixas[i * 4 + cad] = c(s))));
  if (vira) fixas[12] = c(vira);
  const usadas = new Set(fixas.filter((x): x is Carta => !!x).map(idCarta));
  const resto = novoBaralho().filter((x) => !usadas.has(idCarta(x)));
  return fixas.map((x) => x ?? resto.shift()!);
}

export function distribuida(regras: RegrasMesa, maos?: string[][], placar: [number, number] = [0, 0], vira?: string): EstadoPartida {
  const s = novaPartida(regras, 3);
  s.placar = placar;
  return reduce(s, { tipo: 'distribuir', baralho: baralhoCom(maos, vira) });
}

/** Joga em sequência [cadeira, índice] (cartas abertas). */
export function jogar(s: EstadoPartida, seq: [Cadeira, number][]): EstadoPartida {
  return seq.reduce((acc, [cadeira, indice]) => reduce(acc, { tipo: 'jogar', cadeira, indice }), s);
}

export const CADEIRAS_PADRAO: InfoCadeira[] = [
  { tipo: 'humano', nome: 'Ana', conectado: true },
  { tipo: 'bot', nome: 'Bot Zé', conectado: true },
  { tipo: 'bot', nome: 'Bot Tião', conectado: true },
  { tipo: 'bot', nome: 'Bot Dita', conectado: true },
];

/** O `MsgEstado` que o servidor mandaria para `minha` (sem prazo, salvo `extra`). */
export function msgEstado(s: EstadoPartida | null, minha: Cadeira = 0, extra: Partial<MsgEstado> = {}): MsgEstado {
  return {
    minhaCadeira: minha,
    cadeiras: CADEIRAS_PADRAO,
    regras: s?.regras ?? PAULISTA,
    chanceInterceptarSinal: 0,
    visao: s ? visaoDoJogador(s, minha) : null,
    prazo: null,
    minhasAcoes: s ? acoesValidas(s, minha) : [],
    ...extra,
  };
}
