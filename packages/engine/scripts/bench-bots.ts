import {
  baralhoDaMesa,
  botDificil,
  botFacil,
  type Cadeira,
  completarSorte,
  duplaDe,
  embaralhar,
  mulberry32,
  novaPartida,
  reduce,
  REGRAS_RANQUEADA,
  visaoDoJogador,
} from '../src';

const PARTIDAS = Number(process.argv[2] ?? 40);
const rand = mulberry32(2026);
let vitorias = 0;
const t0 = Date.now();

for (let p = 0; p < PARTIDAS; p++) {
  const regras = p % 2 === 0 ? REGRAS_RANQUEADA.paulista : REGRAS_RANQUEADA.mineiro;
  // O monte entra uma vez; daí em diante os próprios bots fazem o ritual de cada mão.
  let s = reduce(novaPartida(regras, (p % 4) as Cadeira), { tipo: 'monte', baralho: embaralhar(baralhoDaMesa(regras), rand) });
  while (s.fase !== 'fimPartida') {
    const atual = s;
    const acao = ([0, 1, 2, 3] as Cadeira[])
      .map((c) => (duplaDe(c) === 0 ? botDificil(visaoDoJogador(atual, c), rand, { amostras: 16 }) : botFacil(atual, c)))
      .find((a) => a !== null);
    if (!acao) throw new Error(`nenhum bot age na fase ${s.fase}`);
    // Embaralhar/cortar levam a sorte do "servidor".
    s = reduce(s, completarSorte(acao, s, rand));
  }
  if (s.vencedor === 0) vitorias++;
}

console.log(`difícil (dupla 0) x fácil (dupla 1): ${vitorias}/${PARTIDAS} = ${((100 * vitorias) / PARTIDAS).toFixed(0)}% em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
