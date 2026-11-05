import { type Cadeira, duplaDe, idCarta, type JogadaVisivel, type ResultadoRodada, type VisaoMao, type VisaoResultadoMao } from '@truco/engine';
import { type Posicao, posicaoRelativa } from './posicoes';

/** Uma jogada como aparece no centro, com a chave que a identifica entre renders. */
export interface JogadaExibida {
  chave: string;
  jogada: JogadaVisivel;
}

/** O que o centro da mesa mostra: as jogadas de uma rodada (a em andamento ou a última encerrada). */
export interface Exibicao {
  jogadas: JogadaExibida[];
  /** true = rodada já encerrada (esmaecida): a mesa está vazia ou a mão acabou. */
  anterior: boolean;
  /** Resultado da rodada mostrada, se ela já fechou. */
  resultado: ResultadoRodada | null;
}

/**
 * Chave estável de uma jogada: a mesma carta tem a mesma chave na `mesa` (em andamento), em
 * `rodadasJogadas` (encerrada) e na `ultimaMao` (entre mãos). A vira separa mãos diferentes.
 */
export function chaveJogada(vira: string, rodada: number, j: JogadaVisivel): string {
  return `${vira}|${rodada}|${j.cadeira}|${j.carta ? idCarta(j.carta) : 'x'}`;
}

/** Jogadas no centro: as da rodada em andamento ou, com a mesa vazia, as da rodada anterior. */
export function exibicaoMesa(mao: VisaoMao | null, ultimaMao: VisaoResultadoMao | null): Exibicao {
  const fonte = mao ?? ultimaMao;
  if (!fonte) return { jogadas: [], anterior: false, resultado: null };
  const anterior = !mao || mao.mesa.length === 0;
  const rodada = anterior ? fonte.rodadasJogadas.length - 1 : fonte.rodadasJogadas.length;
  const lista = mao && !anterior ? mao.mesa : (fonte.rodadasJogadas.at(-1) ?? []);
  const vira = fonte.vira ? idCarta(fonte.vira) : '-';
  return {
    jogadas: lista.map((jogada) => ({
      chave: chaveJogada(vira, rodada, jogada),
      jogada,
    })),
    anterior,
    resultado: anterior ? (fonte.rodadas[rodada] ?? null) : null,
  };
}

/** Chaves que entraram na mesa desde o render anterior. Sem render anterior (F5, reconexão): nenhuma. */
export function jogadasNovas(antes: Exibicao | null, depois: Exibicao): string[] {
  if (!antes) return [];
  const vistas = new Set(antes.jogadas.map((j) => j.chave));
  return depois.jogadas.filter((j) => !vistas.has(j.chave)).map((j) => j.chave);
}

export interface Recolhida {
  chaves: string[];
  /** Para onde as cartas deslizam: o assento de quem ganhou a rodada; null = empate (somem no lugar). */
  destino: Posicao | null;
}

/**
 * A rodada mostrada antes saiu da mesa (veio a próxima rodada, ou a próxima mão)? Devolve as
 * cartas que saíram e o lado de quem levou: o assento da carta mais forte da dupla vencedora.
 */
export function rodadaRecolhida(antes: Exibicao | null, depois: Exibicao, minha: Cadeira): Recolhida | null {
  if (!antes || antes.jogadas.length === 0) return null;
  const ficam = new Set(depois.jogadas.map((j) => j.chave));
  const saem = antes.jogadas.filter((j) => !ficam.has(j.chave));
  if (saem.length === 0) return null;
  return {
    chaves: saem.map((j) => j.chave),
    destino: ladoVencedor(antes, minha),
  };
}

function ladoVencedor(e: Exibicao, minha: Cadeira): Posicao | null {
  if (e.resultado === null || e.resultado === 'empate') return null;
  const dupla = e.resultado;
  let melhor: JogadaVisivel | null = null;
  for (const { jogada } of e.jogadas) {
    if (duplaDe(jogada.cadeira) !== dupla) continue;
    if (!melhor || jogada.forca > melhor.forca) melhor = jogada;
  }
  if (melhor) return posicaoRelativa(minha, melhor.cadeira);
  // Sem carta da dupla vencedora à vista: vai para o meu lado ou para o lado deles.
  return dupla === duplaDe(minha) ? 'baixo' : posicaoRelativa(minha, ((minha + 1) % 4) as Cadeira);
}
