import type { VisualRoupa } from '@truco/api';
import type { Carta } from '@truco/engine';
import type { AparenciaMesa } from '../../logica/aparenciaMesa';
import type { Posicao } from '../../logica/posicoes';

/**
 * Contrato entre a tela da mesa (React) e a cena 3D (three.js). A cena só DESENHA: não sabe
 * regras, não tem botões. Tudo o que muda chega por `atualizar(estado)`, sempre o estado
 * inteiro; a cena compara com o anterior e anima as diferenças.
 *
 * Posições são relativas a quem olha: 'baixo' = eu (câmera, sem personagem: só os antebraços),
 * 'cima' = parceiro (de frente), 'esquerda' / 'direita' = adversários.
 */
export interface Jogador3D {
  pos: Posicao;
  nome: string;
  /** Cartas na mão (o leque do personagem mostra esse tanto de versos). */
  qtdCartas: number;
  daVez: boolean;
  /** Segundos que faltam para quem é da vez (humano com prazo); null = sem relógio (bot). */
  segundos: number | null;
  /** Grito atual ('TRUCO!', 'SEIS!', 'Aceito!', 'Corta aí!'...) para o balão; null = calado. */
  fala: string | null;
  /** true se a fala é pedido de aposta: braço erguido e batida na mesa. */
  gritando: boolean;
  /** Caiu (sem conexão): o personagem fica apagado. */
  caiu: boolean;
  /** Roupa equipada na loja (null = a roupa padrão do personagem). */
  roupa?: VisualRoupa | null;
}

export interface Jogada3D {
  /** Chave estável da jogada (a mesma de `logica/jogadas.ts`): nova chave = carta nova voando. */
  chave: string;
  /** De quem é a carta (de onde ela sai voando). */
  pos: Posicao;
  /** null = jogada coberta (mostra o verso). */
  carta: Carta | null;
}

export interface Estado3D {
  /** Sempre as 4 posições. */
  jogadores: Jogador3D[];
  /** Cartas no centro: a rodada em andamento ou a que acabou de fechar. */
  jogadas: Jogada3D[];
  /** Rodadas já recolhidas para a pilha do canto (0..3). Quando sobe, as `jogadas` que sumiram deslizam para ela. */
  pilha: number;
  vira: Carta | null;
  /** Monte: quantas cartas e perto de quem está (quem deu); null = sem monte na mesa. */
  monte: { qtd: number; pos: Posicao } | null;
  /** Mesa de plástico amarelo (depois de quebrar a de madeira). */
  plastico: boolean;
  /** Preferência local; em mesas antigas o padrão é madeira. */
  aparenciaMesa?: AparenciaMesa;
  /** Verso das cartas de quem deu (item da loja equipado pelo pé); null = o verso padrão. */
  verso?: { cor: string; linha: string } | null;
  /** Mineiro com mão limpa usa coringa ('C'); a face do coringa precisa existir. */
  variante: 'paulista' | 'mineiro';
}

export interface Cena3D {
  atualizar(estado: Estado3D): void;
  /** Alguém bateu na mesa (pedido de seis/nove/doze segurado): tremer, de 0 a 1. */
  bater(pos: Posicao, forca: number): void;
  /** Para animação, solta WebGL, tira listeners. */
  destruir(): void;
}

export interface OpcoesCena3D {
  /** prefers-reduced-motion: sem idle, voos instantâneos. */
  reduzido: boolean;
  /** Contexto WebGL perdido (GPU reiniciada, falta de memória): a tela volta para a mesa 2D. */
  aoPerderContexto?: () => void;
}

/** Assinatura do módulo `cena.ts` (carregado sob demanda: three.js não entra no bundle principal). */
export type CriarCena3D = (container: HTMLElement, opcoes: OpcoesCena3D) => Cena3D;
