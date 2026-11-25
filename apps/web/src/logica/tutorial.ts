import { type Cadeira, duplaDe, limiteMaoEspecial } from '@truco/engine';
import type { MsgEstado } from '@truco/protocolo';

/**
 * Tutorial: uma partida de verdade, sozinho contra bots fáceis e sem limite de tempo, com um
 * treinador que explica o passo do momento. O passo sai só do estado da mesa (nada roteirizado) e
 * acompanha a partida inteira: cada situação nova (família, mão de 11, cangada, carta coberta…) é
 * explicada na primeira vez que aparece; decisões (responder truco, mão de 11, conferir) são
 * explicadas sempre. "Pular tutorial" fica sempre à mão.
 */
export type IdPasso =
  | 'monte'
  | 'embaralhar'
  | 'embaralhar-outro'
  | 'cortar'
  | 'cortar-outro'
  | 'dar'
  | 'dar-outro'
  | 'familia'
  | 'conferir'
  | 'mao-de-11'
  | 'mao-de-11-outro'
  | 'mao-de-ferro'
  | 'cangada'
  | 'cangada-mostrar'
  | 'primeira-carta'
  | 'jogar'
  | 'coberta'
  | 'esperar'
  | 'truco'
  | 'responder'
  | 'fim-da-mao'
  | 'fim';

/** O que a pessoa precisa ter visto para conhecer a partida (o progresso do treinador). */
export type Topico = 'ritual' | 'carta' | 'truco' | 'familia' | 'coberta' | 'cangada' | 'mao11';
export const TOPICOS: readonly { id: Topico; nome: string }[] = [
  { id: 'ritual', nome: 'Embaralhar, cortar e dar' },
  { id: 'carta', nome: 'Jogar carta e a manilha' },
  { id: 'truco', nome: 'Truco' },
  { id: 'familia', nome: 'Família' },
  { id: 'coberta', nome: 'Carta coberta' },
  { id: 'cangada', nome: 'Cangada (empate)' },
  { id: 'mao11', nome: 'Mão de 11 e mão de ferro' },
];

export interface PassoTutorial {
  id: IdPasso;
  titulo: string;
  texto: string;
  /** Tópico que este passo ensina (conta no progresso). */
  topico?: Topico;
  /** Explicado sempre que acontece (decisão da pessoa); os outros, só na primeira vez. */
  repete?: boolean;
}

export function passoDoTutorial(msg: MsgEstado, nome: (c: Cadeira) => string): PassoTutorial | null {
  const v = msg.visao;
  if (!v) return null;
  const eu = (c: Cadeira) => c === v.cadeira;
  const tem = (tipo: string) => msg.minhasAcoes.some((a) => a.tipo === tipo);
  const r = v.ritual;
  const limite = limiteMaoEspecial(v.regras.pontuacao);

  if (v.fase === 'fimPartida') {
    const ganhamos = v.vencedor === duplaDe(v.cadeira);
    return {
      id: 'fim',
      titulo: ganhamos ? 'Vocês ganharam a partida!' : 'Fim de partida',
      texto: 'Agora você já conhece a mesa. Para jogar de novo, é só tocar em "Jogar de novo"; as regras de cada mesa ficam no Manual (o livrinho lá em cima).',
      repete: true,
    };
  }
  if (v.fase === 'aguardandoMonte') {
    return { id: 'monte', titulo: 'Começa a mão', texto: 'A cada mão, uma pessoa embaralha e dá as cartas, e a vez gira pela mesa.', topico: 'ritual' };
  }
  if (r && v.fase === 'embaralhando') {
    // Mão nova depois de uma encerrada: o placar antes do ritual (uma vez). Se a vez de embaralhar
    // for minha, o passo de embaralhar vem antes (ninguém aprende a dar as cartas só olhando).
    if (v.ultimaMao && !eu(r.embaralhador)) {
      const nos = duplaDe(v.cadeira);
      const levou = v.ultimaMao.vencedor === null ? 'Ninguém levou' : v.ultimaMao.vencedor === nos ? 'Vocês levaram' : 'Eles levaram';
      return {
        id: 'fim-da-mao',
        titulo: 'Acabou a mão',
        texto: `${levou} a última mão. Quem ganha 2 das 3 rodadas leva a mão, e a partida vai até 12 pontos. Placar: vocês ${v.placar[nos]}, eles ${v.placar[1 - nos]}.`,
      };
    }
    return eu(r.embaralhador)
      ? { id: 'embaralhar', titulo: 'Você dá as cartas', texto: 'Toque em "Embaralhar" quantas vezes quiser. Quando terminar, toque em "Passar pra cortar".', topico: 'ritual' }
      : { id: 'embaralhar-outro', titulo: 'Embaralhando', texto: `${nome(r.embaralhador)} está embaralhando. Nesta mão é a vez dele de dar as cartas.`, topico: 'ritual' };
  }
  if (r && v.fase === 'cortando') {
    return eu(r.cortador)
      ? { id: 'cortar', titulo: 'Sua vez de cortar', texto: 'Corte o monte (até 3 vezes) ou só passe. É o jeito de garantir que ninguém arrumou as cartas.', topico: 'ritual' }
      : { id: 'cortar-outro', titulo: 'Corte', texto: `${nome(r.cortador)} corta o monte. Quem corta pode até abrir ou dar as 3 de cima.`, topico: 'ritual' };
  }
  if (r && v.fase === 'escolhendoDistribuicao') {
    return eu(r.embaralhador)
      ? { id: 'dar', titulo: 'Como dar as cartas', texto: 'Escolha um jeito: por cima, por baixo ou uma de cada vez. Muda só o jeito de dar, a sorte é a mesma.', topico: 'ritual' }
      : { id: 'dar-outro', titulo: 'Dando as cartas', texto: `${nome(r.embaralhador)} vai dar as cartas: 3 para cada um.`, topico: 'ritual' };
  }
  const m = v.mao;
  if (!m) return null;

  if (msg.janelaFamilia && !msg.janelaFamilia.decidiram.includes(v.cadeira)) {
    return {
      id: 'familia',
      titulo: 'Tem família?',
      texto: 'Família é ter só Q, J, K e Ás na mão. Se tiver, peça: vale ponto e você troca as cartas. Fechada, dá até para pedir no blefe. Se não tiver, toque em "Sem família".',
      topico: 'familia',
    };
  }
  if (v.fase === 'conferindoFamilia' && tem('conferir')) {
    return {
      id: 'conferir',
      titulo: 'Conferir a família?',
      texto: 'Pediram família fechada, que pode ser blefe. Conferir: se era família, eles pontuam; se era blefe, vocês pontuam. Deixar passar: ninguém pontua.',
      topico: 'familia',
      repete: true,
    };
  }
  if (v.fase === 'decisaoMao10') {
    return tem('mao10')
      ? {
          id: 'mao-de-11',
          titulo: `Mão de ${limite}`,
          texto: `Vocês chegaram a ${limite}: veja as cartas do parceiro e decida. Jogar: a mão vale 3. Correr: eles levam 1. Ela já é trucada: pedir truco nela entrega a mão.`,
          topico: 'mao11',
          repete: true,
        }
      : { id: 'mao-de-11-outro', titulo: `Mão de ${limite}`, texto: `Eles chegaram a ${limite} e estão decidindo se jogam (vale 3) ou correm (vocês levam 1).`, topico: 'mao11' };
  }
  if (v.fase === 'empilhando') {
    return {
      id: 'cangada',
      titulo: 'Cangou!',
      // Só o mineiro empilha (no paulista, cangou a 1ª, a 2ª é jogada normal).
      texto: 'A 1ª rodada empatou. Junte as duas cartas e toque na que vai por cima: ela fica à mostra e não vale; quem decide é a de baixo.',
      topico: 'cangada',
    };
  }
  if (v.fase === 'respondendoTruco' && tem('aceitar')) {
    return {
      id: 'responder',
      titulo: 'Pediram truco!',
      texto: 'Aceitar: a mão passa a valer mais. Correr: eles levam o que a mão valia. Aumentar: você sobe a aposta.',
      topico: 'truco',
      repete: true,
    };
  }
  if (v.fase !== 'jogando') return null;
  if (m.tipo === 'mao11') {
    return {
      id: 'mao-de-ferro',
      titulo: 'Mão de ferro',
      texto: `As duas duplas chegaram a ${limite}: todo mundo joga às cegas, sem ver as próprias cartas, e quem levar a mão ganha a partida.`,
      topico: 'mao11',
    };
  }
  if (!eu(m.vez)) {
    return { id: 'esperar', titulo: 'Vez de outro', texto: `${nome(m.vez)} está jogando. Seu parceiro é quem está na sua frente: vocês jogam juntos.` };
  }
  if (m.cangada) {
    return {
      id: 'cangada-mostrar',
      titulo: m.cangada.etapa === 'baixo' ? 'Abrir a de baixo' : 'Mostrar a sua',
      texto: 'Na cangada, cada um mostra a sua na vez. Antes de mostrar, você pode pedir truco, até no blefe.',
      topico: 'cangada',
    };
  }
  if (m.nivel === 0 && m.rodadas.length >= 1 && tem('truco')) {
    return {
      id: 'truco',
      titulo: 'Agora vale pedir truco',
      texto: 'Toque em "Truco!" e a mão passa a valer 3. Se eles correrem, vocês levam 1. Dá para pedir no blefe, com carta fraca.',
      topico: 'truco',
    };
  }
  if (m.rodadas.length >= 1 && msg.minhasAcoes.some((a) => a.tipo === 'jogar' && a.coberta)) {
    return {
      id: 'coberta',
      titulo: 'Carta coberta',
      texto: 'Da 2ª rodada em diante, dá para jogar uma carta virada para baixo ("Jogar coberta"): ela não vale nada, mas esconde o que você tem.',
      topico: 'coberta',
    };
  }
  if (m.rodadas.length === 0) {
    return {
      id: 'primeira-carta',
      titulo: 'Sua vez de jogar',
      texto:
        v.regras.variante === 'mineiro'
          ? 'As manilhas são fixas e ganham de todas: zap (4 de paus), 7 de copas, espadilha (Ás de espadas) e 7 de ouros. Toque numa carta para jogar.'
          : 'A vira, a carta virada no meio, mostra a manilha: o valor logo acima dela ganha de todos. Toque numa carta para jogar.',
      topico: 'carta',
    };
  }
  return { id: 'jogar', titulo: 'Sua vez', texto: 'Jogue uma carta. Quem ganha 2 das 3 rodadas leva a mão.', topico: 'carta' };
}

/** Tópicos já vistos, pelos passos que apareceram. */
export function topicosVistos(passos: Iterable<PassoTutorial>): Set<Topico> {
  const s = new Set<Topico>();
  for (const p of passos) if (p.topico) s.add(p.topico);
  return s;
}

export const CHAVE_TUTORIAL = 'truco:tutorial';

/** Ainda não fez nem pulou o tutorial (o lobby oferece na primeira visita). */
export function tutorialPendente(): boolean {
  try {
    return localStorage.getItem(CHAVE_TUTORIAL) === null;
  } catch {
    return false;
  }
}

export function marcarTutorial(como: 'feito' | 'pulado'): void {
  try {
    localStorage.setItem(CHAVE_TUTORIAL, como);
  } catch {
    // Sem armazenamento: o convite pode voltar na próxima visita; não atrapalha.
  }
}
