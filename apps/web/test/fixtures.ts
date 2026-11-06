import {
  acoesValidas,
  type Cadeira,
  type Carta,
  type EstadoPartida,
  idCarta,
  type Naipe,
  novaPartida,
  baralhoDaMesa,
  novoBaralho,
  reduce,
  REGRAS_RANQUEADA,
  type RegrasMesa,
  type Valor,
  visaoDoJogador,
} from '@truco/engine';
import { distribuirSemRitual } from '@truco/engine/testes';
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
export function baralhoCom(maos: string[][] = [], vira?: string, base: Carta[] = novoBaralho()): Carta[] {
  const fixas: (Carta | undefined)[] = new Array(base.length).fill(undefined);
  maos.forEach((mao, cad) => mao.forEach((s, i) => (fixas[i * 4 + cad] = c(s))));
  if (vira) fixas[12] = c(vira);
  const usadas = new Set(fixas.filter((x): x is Carta => !!x).map(idCarta));
  const resto = base.filter((x) => !usadas.has(idCarta(x)));
  return fixas.map((x) => x ?? resto.shift()!);
}

export function distribuida(regras: RegrasMesa, maos?: string[][], placar: [number, number] = [0, 0], vira?: string): EstadoPartida {
  const s = novaPartida(regras, 3);
  s.placar = placar;
  return distribuirSemRitual(s, baralhoCom(maos, vira, baralhoDaMesa(regras)));
}

/** Começo do ritual com pe = 3 (a 3 embaralha e dá, a 2 corta); monte na ordem do baralho da mesa. */
export function noRitual(regras: RegrasMesa = PAULISTA): EstadoPartida {
  return reduce(novaPartida(regras, 3), { tipo: 'monte', baralho: baralhoDaMesa(regras) });
}

/** Joga em sequência [cadeira, índice] (cartas abertas). */
export function jogar(s: EstadoPartida, seq: [Cadeira, number][]): EstadoPartida {
  return seq.reduce((acc, [cadeira, indice]) => reduce(acc, { tipo: 'jogar', cadeira, indice }), s);
}

/**
 * Joga a 1ª rodada inteira (índice 0, a partir de quem está na vez): truco só vale da 2ª rodada em diante.
 * Com o `novoBaralho()` padrão: no paulista os quatro 4 cangam e a cadeira 0 volta a ter a vez;
 * no mineiro o zap da cadeira 3 leva a rodada e a vez é dela.
 */
export function naSegundaRodada(s: EstadoPartida): EstadoPartida {
  for (let k = 0; k < 4; k++) s = reduce(s, { tipo: 'jogar', cadeira: s.mao!.vez, indice: 0 });
  return s;
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
    humanosEsperados: 1,
    visao: s ? visaoDoJogador(s, minha) : null,
    prazo: null,
    minhasAcoes: s ? acoesValidas(s, minha) : [],
    modo: 'classica',
    ...extra,
  };
}
