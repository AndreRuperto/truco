import type { AcaoJogador, VisaoMao } from '@truco/engine';
import { nomePedido } from './textos';

export interface BotaoAcao {
  chave: 'aceitar' | 'aumentar' | 'truco' | 'familia' | 'mao10-sim' | 'correr' | 'mao10-nao';
  rotulo: string;
  /** Ação exatamente como veio em `minhasAcoes` — é o que se envia. */
  acao: AcaoJogador;
  tom: 'principal' | 'neutro' | 'perigo';
}

export interface AcoesUI {
  /** Índices de `minhaMao` jogáveis abertos. */
  jogaveis: number[];
  /** Índices jogáveis cobertos (2ª rodada em diante). */
  cobriveis: number[];
  botoes: BotaoAcao[];
}

const ORDEM: BotaoAcao['chave'][] = ['aceitar', 'aumentar', 'truco', 'familia', 'mao10-sim', 'correr', 'mao10-nao'];

/** Separa `minhasAcoes` em cartas jogáveis e botões, com rótulos ("Truco!", "Seis!"...). */
export function agruparAcoes(acoes: AcaoJogador[], m: VisaoMao | null): AcoesUI {
  const jogaveis: number[] = [];
  const cobriveis: number[] = [];
  const botoes: BotaoAcao[] = [];
  for (const a of acoes) {
    switch (a.tipo) {
      case 'jogar':
        (a.coberta ? cobriveis : jogaveis).push(a.indice);
        break;
      case 'truco':
        botoes.push({ chave: 'truco', rotulo: `${nomePedido((m?.nivel ?? 0) + 1)}!`, acao: a, tom: 'principal' });
        break;
      case 'aumentar':
        botoes.push({ chave: 'aumentar', rotulo: `${nomePedido((m?.trucoPendente?.proposto ?? 1) + 1)}!`, acao: a, tom: 'principal' });
        break;
      case 'aceitar':
        botoes.push({ chave: 'aceitar', rotulo: 'Aceitar', acao: a, tom: 'neutro' });
        break;
      case 'correr':
        botoes.push({ chave: 'correr', rotulo: 'Correr', acao: a, tom: 'perigo' });
        break;
      case 'familia':
        botoes.push({ chave: 'familia', rotulo: 'Família!', acao: a, tom: 'principal' });
        break;
      case 'mao10':
        botoes.push(
          a.jogar
            ? { chave: 'mao10-sim', rotulo: 'Jogar a mão', acao: a, tom: 'principal' }
            : { chave: 'mao10-nao', rotulo: 'Correr da mão', acao: a, tom: 'perigo' },
        );
        break;
    }
  }
  botoes.sort((x, y) => ORDEM.indexOf(x.chave) - ORDEM.indexOf(y.chave));
  return { jogaveis, cobriveis, botoes };
}
