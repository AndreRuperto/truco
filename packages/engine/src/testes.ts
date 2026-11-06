/**
 * Atalhos só para testes e simulações (fora da API pública: importe de `@truco/engine/testes`,
 * ou de `../src/testes` dentro do engine). Pulam o ritual, que no jogo real vem dos jogadores.
 */
import type { Carta } from './cartas';
import type { EstadoPartida } from './estado';
import { reduce } from './reducer';
import { monteRodaARoda } from './ritual';

/**
 * Testes e simulações: ritual mínimo — o pé passa sem embaralhar, o cortador devolve e as
 * cartas saem por cima. Exige a partida no começo do ritual (`embaralhando`).
 */
export function ritualMinimo(s: EstadoPartida): EstadoPartida {
  const r = s.ritual;
  if (s.fase !== 'embaralhando' || !r) throw new Error('ritualMinimo: a partida não está no começo do ritual');
  let t = reduce(s, { tipo: 'passarCorte', cadeira: r.embaralhador });
  t = reduce(t, { tipo: 'devolver', cadeira: r.cortador });
  return reduce(t, { tipo: 'distribuir', cadeira: r.embaralhador, modo: 'porCima' });
}

/**
 * Testes e simulações: põe o monte no começo da partida e distribui sem ritual. `baralho` vem na
 * ordem "roda a roda" de antes do ritual (ver `monteRodaARoda`): as mãos e a vira saem iguais.
 */
export function distribuirSemRitual(s: EstadoPartida, baralho: readonly Carta[]): EstadoPartida {
  return ritualMinimo(reduce(s, { tipo: 'monte', baralho: monteRodaARoda(baralho) }));
}
