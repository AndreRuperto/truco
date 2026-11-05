import { botDificil, botFacil, type Cadeira, duplaDe, embaralhar, mulberry32, novaPartida, novoBaralho, reduce, REGRAS_RANQUEADA, visaoDoJogador } from '../src';

const PARTIDAS = Number(process.argv[2] ?? 40);
const rand = mulberry32(2026);
let vitorias = 0;
const t0 = Date.now();

for (let p = 0; p < PARTIDAS; p++) {
  const regras = p % 2 === 0 ? REGRAS_RANQUEADA.paulista : REGRAS_RANQUEADA.mineiro;
  let s = novaPartida(regras, (p % 4) as Cadeira);
  while (s.fase !== 'fimPartida') {
    if (s.fase === 'aguardandoDistribuicao') {
      s = reduce(s, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), rand) });
      continue;
    }
    const atual = s;
    const acao = ([0, 1, 2, 3] as Cadeira[])
      .map((c) => (duplaDe(c) === 0 ? botDificil(visaoDoJogador(atual, c), rand, { amostras: 16 }) : botFacil(atual, c)))
      .find((a) => a !== null)!;
    s = reduce(s, acao);
  }
  if (s.vencedor === 0) vitorias++;
}

console.log(`difícil (dupla 0) x fácil (dupla 1): ${vitorias}/${PARTIDAS} = ${((100 * vitorias) / PARTIDAS).toFixed(0)}% em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
