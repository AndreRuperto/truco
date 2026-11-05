import type { Cadeira } from '@truco/engine';

export type Posicao = 'baixo' | 'direita' | 'cima' | 'esquerda';

const ORDEM: Posicao[] = ['baixo', 'direita', 'cima', 'esquerda'];

/**
 * Onde `outra` aparece na tela de quem senta em `minha`.
 * Convenção: eu embaixo; (minha + 1) % 4 — quem joga depois de mim — à direita
 * (sentido anti-horário); o parceiro em cima; (minha + 3) % 4 à esquerda.
 */
export function posicaoRelativa(minha: Cadeira, outra: Cadeira): Posicao {
  return ORDEM[(outra - minha + 4) % 4];
}

export function cadeiraNaPosicao(minha: Cadeira, pos: Posicao): Cadeira {
  return ((minha + ORDEM.indexOf(pos)) % 4) as Cadeira;
}
