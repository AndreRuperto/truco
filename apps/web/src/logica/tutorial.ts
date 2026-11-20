import type { Cadeira } from '@truco/engine';
import type { MsgEstado } from '@truco/protocolo';

/**
 * Tutorial: uma partida de verdade, sozinho contra bots fáceis e sem limite de tempo, com um
 * treinador que explica o passo do momento. O passo sai só do estado da mesa (nada roteirizado):
 * o ritual, a primeira carta, o truco e o fim da primeira mão. "Pular tutorial" fica sempre à mão.
 */
export type IdPasso =
  | 'monte'
  | 'embaralhar'
  | 'embaralhar-outro'
  | 'cortar'
  | 'cortar-outro'
  | 'dar'
  | 'dar-outro'
  | 'primeira-carta'
  | 'jogar'
  | 'esperar'
  | 'truco'
  | 'responder'
  | 'fim';

export interface PassoTutorial {
  id: IdPasso;
  titulo: string;
  texto: string;
}

export function passoDoTutorial(msg: MsgEstado, nome: (c: Cadeira) => string): PassoTutorial | null {
  const v = msg.visao;
  if (!v) return null;
  const eu = (c: Cadeira) => c === v.cadeira;
  const tem = (tipo: string) => msg.minhasAcoes.some((a) => a.tipo === tipo);
  const r = v.ritual;

  // A primeira mão acabou: o básico está visto.
  if (v.fase === 'fimPartida' || v.ultimaMao) {
    return {
      id: 'fim',
      titulo: 'Pronto, é isso!',
      texto:
        'Quem ganha 2 das 3 rodadas leva a mão, e a partida vai até 12 pontos. Família, mão de 11 e cangada estão no Manual (o livrinho lá em cima). Agora é com você.',
    };
  }
  if (v.fase === 'aguardandoMonte') {
    return { id: 'monte', titulo: 'Começa a mão', texto: 'A cada mão, uma pessoa embaralha e dá as cartas, e a vez gira pela mesa.' };
  }
  if (r && v.fase === 'embaralhando') {
    return eu(r.embaralhador)
      ? { id: 'embaralhar', titulo: 'Você dá as cartas', texto: 'Toque em "Embaralhar" quantas vezes quiser. Quando terminar, toque em "Passar pra cortar".' }
      : { id: 'embaralhar-outro', titulo: 'Embaralhando', texto: `${nome(r.embaralhador)} está embaralhando. Nesta mão é a vez dele de dar as cartas.` };
  }
  if (r && v.fase === 'cortando') {
    return eu(r.cortador)
      ? { id: 'cortar', titulo: 'Sua vez de cortar', texto: 'Corte o monte (até 3 vezes) ou só passe. É o jeito de garantir que ninguém arrumou as cartas.' }
      : { id: 'cortar-outro', titulo: 'Corte', texto: `${nome(r.cortador)} corta o monte. Quem corta pode até abrir ou dar as 3 de cima.` };
  }
  if (r && v.fase === 'escolhendoDistribuicao') {
    return eu(r.embaralhador)
      ? { id: 'dar', titulo: 'Como dar as cartas', texto: 'Escolha um jeito: por cima, por baixo ou uma de cada vez. Muda só o jeito de dar, a sorte é a mesma.' }
      : { id: 'dar-outro', titulo: 'Dando as cartas', texto: `${nome(r.embaralhador)} vai dar as cartas: 3 para cada um.` };
  }
  const m = v.mao;
  if (!m) return null;
  if (v.fase === 'respondendoTruco' && tem('aceitar')) {
    return {
      id: 'responder',
      titulo: 'Pediram truco!',
      texto: 'Aceitar: a mão passa a valer 3. Correr: eles levam o que a mão valia. Aumentar: você pede seis.',
    };
  }
  if (v.fase !== 'jogando') return null;
  if (!eu(m.vez)) {
    return { id: 'esperar', titulo: 'Vez de outro', texto: `${nome(m.vez)} está jogando. Seu parceiro é quem está na sua frente: vocês jogam juntos.` };
  }
  if (m.nivel === 0 && m.rodadas.length >= 1 && tem('truco')) {
    return {
      id: 'truco',
      titulo: 'Agora vale pedir truco',
      texto: 'Toque em "Truco!" e a mão passa a valer 3. Se eles correrem, vocês levam 1. Dá para pedir no blefe, com carta fraca.',
    };
  }
  if (m.rodadas.length === 0) {
    return {
      id: 'primeira-carta',
      titulo: 'Sua vez de jogar',
      texto: 'A vira, a carta virada no meio, mostra a manilha: o valor logo acima dela ganha de todos. Toque numa carta para jogar.',
    };
  }
  return { id: 'jogar', titulo: 'Sua vez', texto: 'Jogue uma carta. Quem ganha 2 das 3 rodadas leva a mão.' };
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
