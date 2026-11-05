import { type Cadeira, type Dupla, duplaDe, type Jogada, type ResultadoRodada } from './estado';

export function resolverRodada(mesa: Jogada[]): { resultado: ResultadoRodada; proximo: Cadeira } {
  const max = Math.max(...mesa.map((j) => j.forca));
  const topo = mesa.filter((j) => j.forca === max);
  const duplas = new Set(topo.map((j) => duplaDe(j.cadeira)));
  if (max === 0 || duplas.size > 1) return { resultado: 'empate', proximo: topo[0].cadeira };
  return { resultado: duplaDe(topo[0].cadeira), proximo: topo[0].cadeira };
}

/** Dupla vencedora, null (todas empataram) ou 'continua'. */
export function vencedorMao(r: ResultadoRodada[]): Dupla | null | 'continua' {
  const vit = [0, 0];
  for (const x of r) if (x !== 'empate') vit[x]++;
  if (vit[0] >= 2) return 0;
  if (vit[1] >= 2) return 1;
  if (r.length === 0) return 'continua';

  if (r[0] === 'empate') {
    if (r.length >= 2 && r[1] !== 'empate') return r[1];
    if (r.length === 3) return r[2] === 'empate' ? null : r[2];
    return 'continua';
  }
  // 1ª rodada tem vencedor: quem fez a primeira leva em caso de cangar depois.
  if (r.length >= 2 && r[1] === 'empate') return r[0];
  if (r.length === 3) return r[2] === 'empate' ? r[0] : r[2];
  return 'continua';
}
