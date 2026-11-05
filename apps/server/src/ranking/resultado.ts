import type { Dupla } from '@truco/engine';
import { deltaElo, K_PADRAO, media } from './elo';

/** Humano logado numa ranqueada, com o Elo do começo da partida. */
export interface JogadorRanqueado {
  usuarioId: number;
  dupla: Dupla;
  elo: number;
}

function mediaDaDupla(todos: readonly JogadorRanqueado[], d: Dupla): number {
  const elos = todos.filter((x) => x.dupla === d).map((x) => x.elo);
  if (elos.length === 0) throw new Error(`dupla ${d} sem humano ranqueado`);
  return media(elos);
}

/** Delta de quem é da dupla `d`: média da dupla contra a média da outra. */
function deltaDaDupla(todos: readonly JogadorRanqueado[], d: Dupla, venceu: boolean, k: number): number {
  const outra = (1 - d) as Dupla;
  return deltaElo(mediaDaDupla(todos, d), mediaDaDupla(todos, outra), venceu ? 1 : 0, k);
}

/**
 * Deltas de fim de partida para os `alvos` (quem ficou até o fim). As médias usam
 * `todos` os humanos ranqueados, inclusive quem abandonou.
 */
export function deltasDoFim(
  todos: readonly JogadorRanqueado[],
  alvos: readonly number[],
  vencedora: Dupla,
  k = K_PADRAO,
): Map<number, number> {
  const porDupla = [deltaDaDupla(todos, 0, vencedora === 0, k), deltaDaDupla(todos, 1, vencedora === 1, k)];
  const out = new Map<number, number>();
  for (const id of alvos) {
    const x = todos.find((y) => y.usuarioId === id);
    if (!x) throw new Error(`usuário ${id} não está na partida`);
    out.set(id, porDupla[x.dupla]);
  }
  return out;
}

/** Abandono = derrota da dupla de quem saiu, calculada na hora. */
export function deltaAbandono(todos: readonly JogadorRanqueado[], usuarioId: number, k = K_PADRAO): number {
  const x = todos.find((y) => y.usuarioId === usuarioId);
  if (!x) throw new Error(`usuário ${usuarioId} não está na partida`);
  return deltaDaDupla(todos, x.dupla, false, k);
}
