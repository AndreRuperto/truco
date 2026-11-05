export const ELO_INICIAL = 1000;
export const K_PADRAO = 32;

export const PATENTES = [
  { nome: 'Bronze', minimo: 0 },
  { nome: 'Prata', minimo: 300 },
  { nome: 'Ouro', minimo: 600 },
  { nome: 'Diamante', minimo: 900 },
  { nome: 'Mestre', minimo: 1200 },
  { nome: 'Grão-Mestre', minimo: 1500 },
] as const;

export type Patente = (typeof PATENTES)[number]['nome'];

/** Probabilidade esperada de A vencer B. */
export function esperado(eloA: number, eloB: number): number {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}

/** Quanto o vencedor ganha (arredondado); o perdedor perde exatamente isso. */
export function ganhoDoVencedor(eloVencedor: number, eloPerdedor: number, k = K_PADRAO): number {
  return Math.round(k * (1 - esperado(eloVencedor, eloPerdedor)));
}

/**
 * Variação de A contra B; `resultado` 1 = A venceu. Arredonda uma vez só (no ganho do
 * vencedor) e dá o simétrico ao perdedor: a soma é sempre zero, mesmo em meio ponto.
 */
export function deltaElo(eloA: number, eloB: number, resultado: 0 | 1, k = K_PADRAO): number {
  return resultado === 1 ? ganhoDoVencedor(eloA, eloB, k) : -ganhoDoVencedor(eloB, eloA, k);
}

export function media(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error('média de lista vazia');
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Pontos de patente recebem o mesmo delta do Elo, mas nunca ficam abaixo de 0. */
export function novosPontos(pontos: number, delta: number): number {
  return Math.max(0, pontos + delta);
}

export function patenteDe(pontos: number): Patente {
  let atual: Patente = PATENTES[0].nome;
  for (const p of PATENTES) if (pontos >= p.minimo) atual = p.nome;
  return atual;
}

export function proximaPatente(pontos: number): { nome: Patente; faltam: number } | null {
  const p = PATENTES.find((x) => x.minimo > pontos);
  return p ? { nome: p.nome, faltam: p.minimo - pontos } : null;
}
