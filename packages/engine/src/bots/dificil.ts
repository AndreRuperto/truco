import { type Carta, idCarta, novoBaralho } from '../cartas';
import { type Cadeira, type EstadoPartida, type Jogada, parceiroDe } from '../estado';
import { embaralhar } from '../rng';
import type { JogadaVisivel, Visao } from '../visao';

/**
 * Monta um estado completo coerente com tudo que `v.cadeira` enxerga:
 * cartas desconhecidas (mãos alheias, cartas cobertas alheias e, na mão de
 * ferro, a própria mão) são sorteadas do que sobrou do baralho.
 */
export function amostrarMundo(v: Visao, rand: () => number): EstadoPartida {
  const m = v.mao;
  if (!m) throw new Error('não há mão em andamento');

  const conhecidas = new Set<string>();
  const marcar = (c: Carta | null) => {
    if (c) conhecidas.add(idCarta(c));
  };
  m.minhaMao.forEach(marcar);
  m.maoParceiro?.forEach(marcar);
  marcar(m.vira);
  m.mesa.forEach((j) => marcar(j.carta));
  m.rodadasJogadas.flat().forEach((j) => marcar(j.carta));

  const monte = embaralhar(
    novoBaralho().filter((c) => !conhecidas.has(idCarta(c))),
    rand,
  );
  const tirar = (): Carta => {
    const c = monte.pop();
    if (!c) throw new Error('monte esgotado ao amostrar');
    return c;
  };

  const parceiro = parceiroDe(v.cadeira);
  const maos: Carta[][] = ([0, 1, 2, 3] as Cadeira[]).map((c) => {
    if (c === v.cadeira) return m.minhaMao.map((x) => x ?? tirar());
    if (c === parceiro && m.maoParceiro) return m.maoParceiro.map((x) => ({ ...x }));
    return Array.from({ length: m.qtdCartas[c] }, tirar);
  });
  const revelar = (j: JogadaVisivel): Jogada => ({ ...j, carta: j.carta ?? tirar() });

  const { minhaMao: _a, maoParceiro: _b, qtdCartas: _c, mesa, rodadasJogadas, ...resto } = m;
  return {
    regras: { ...v.regras },
    placar: [v.placar[0], v.placar[1]],
    pe: v.pe,
    fase: v.fase,
    ultimaMao: null,
    ultimaFamilia: null,
    vencedor: v.vencedor,
    mao: {
      ...structuredClone(resto),
      maos,
      mesa: mesa.map(revelar),
      rodadasJogadas: rodadasJogadas.map((r) => r.map(revelar)),
    },
  };
}
