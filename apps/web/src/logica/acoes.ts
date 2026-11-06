import { type AcaoJogador, tipoDaProximaFamilia, type Visao } from '@truco/engine';
import { nomePedido } from './textos';

export type ChaveBotao =
  | 'aceitar'
  | 'aumentar'
  | 'truco'
  | 'mostrar'
  | 'familia'
  | 'conferir-sim'
  | 'conferir-nao'
  | 'mao10-sim'
  | 'correr'
  | 'mao10-nao'
  | 'cortar'
  | 'embaralhar'
  | 'passarCorte'
  | 'abrir3'
  | 'dar3'
  | 'devolver'
  | 'dist-porCima'
  | 'dist-porBaixo'
  | 'dist-subindo';

export interface BotaoAcao {
  chave: ChaveBotao;
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
  /** Cangada: índices que posso pôr por cima (clicar na carta empilha). */
  empilhaveis: number[];
  botoes: BotaoAcao[];
}

const ORDEM: ChaveBotao[] = [
  'aceitar',
  'aumentar',
  'truco',
  'mostrar',
  'familia',
  'conferir-sim',
  'conferir-nao',
  'mao10-sim',
  'correr',
  'mao10-nao',
  'cortar',
  'embaralhar',
  'passarCorte',
  'abrir3',
  'dar3',
  'devolver',
  'dist-porCima',
  'dist-porBaixo',
  'dist-subindo',
];

const ROTULO_MODO = { porCima: 'Por cima', porBaixo: 'Por baixo', subindo: 'Subindo alternado' } as const;

/** Separa `minhasAcoes` em cartas jogáveis e botões, com rótulos ("Truco!", "Passar pra cortar"...). */
export function agruparAcoes(acoes: AcaoJogador[], v: Pick<Visao, 'mao' | 'regras'> | null): AcoesUI {
  const m = v?.mao ?? null;
  const jogaveis: number[] = [];
  const cobriveis: number[] = [];
  const empilhaveis: number[] = [];
  const botoes: BotaoAcao[] = [];
  const botao = (chave: ChaveBotao, rotulo: string, acao: AcaoJogador, tom: BotaoAcao['tom'] = 'neutro') =>
    botoes.push({ chave, rotulo, acao, tom });
  for (const a of acoes) {
    switch (a.tipo) {
      case 'jogar':
        (a.coberta ? cobriveis : jogaveis).push(a.indice);
        break;
      case 'empilhar':
        empilhaveis.push(a.indice);
        break;
      case 'mostrar':
        botao('mostrar', m?.cangada?.etapa === 'baixo' ? 'Abrir as de baixo' : 'Mostrar as de cima', a, 'principal');
        break;
      case 'truco':
        botao('truco', `${nomePedido((m?.nivel ?? 0) + 1)}!`, a, 'principal');
        break;
      case 'aumentar':
        botao('aumentar', `${nomePedido((m?.trucoPendente?.proposto ?? 1) + 1)}!`, a, 'principal');
        break;
      case 'aceitar':
        botao('aceitar', 'Aceitar', a);
        break;
      case 'correr':
        botao('correr', 'Correr', a, 'perigo');
        break;
      case 'familia':
        botao('familia', v && tipoDaProximaFamilia(v) === 'aberta' ? 'Pedir família aberta' : 'Pedir família fechada', a, 'principal');
        break;
      case 'conferir':
        if (a.conferir) botao('conferir-sim', 'Conferir', a, 'principal');
        else botao('conferir-nao', 'Deixar passar', a);
        break;
      case 'mao10':
        if (a.jogar) botao('mao10-sim', 'Jogar a mão', a, 'principal');
        else botao('mao10-nao', 'Correr da mão', a, 'perigo');
        break;
      case 'embaralhar':
        botao('embaralhar', 'Embaralhar', a);
        break;
      case 'passarCorte':
        botao('passarCorte', 'Passar pra cortar', a, 'principal');
        break;
      case 'cortar':
        botao('cortar', 'Cortar', a, 'principal');
        break;
      case 'abrir3':
        botao('abrir3', 'Abrir 3', a);
        break;
      case 'dar3':
        botao('dar3', 'Dar 3', a);
        break;
      case 'devolver':
        botao('devolver', 'Devolver', a);
        break;
      case 'distribuir':
        botao(`dist-${a.modo}` as const, ROTULO_MODO[a.modo], a, a.modo === 'porCima' ? 'principal' : 'neutro');
        break;
    }
  }
  botoes.sort((x, y) => ORDEM.indexOf(x.chave) - ORDEM.indexOf(y.chave));
  return { jogaveis, cobriveis, empilhaveis, botoes };
}
