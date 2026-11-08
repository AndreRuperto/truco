import type { AcaoJogador } from '@truco/engine';
import { type Fala, type MsgAcao, type MsgBatida, type MsgChat, type MsgErro, type MsgEstado, type MsgFala, type MsgSinal, SAIDA_PARTIDA_CANCELADA, type Sinal } from '@truco/protocolo';
import { type Evento, FALA_TEXTO, type NovoEvento, textoDaAcao } from '../logica/eventos';

/**
 * O mínimo de um `Room` do @colyseus/sdk 0.18 que a loja usa. O `Room` real satisfaz
 * isto (e os testes usam uma sala falsa).
 */
export interface SalaLike {
  readonly roomId: string;
  readonly reconnectionToken: string;
  onMessage(tipo: string, cb: (payload: any) => void): unknown;
  onLeave(cb: (code: number, reason?: string) => void): unknown;
  onDrop(cb: (code: number, reason?: string) => void): unknown;
  onReconnect(cb: () => void): unknown;
  send(tipo: string, payload?: unknown): void;
  leave(consented?: boolean): Promise<number>;
}

/** Todas as mensagens servidor → cliente; os handlers são registrados antes de `sincronizar`. */
export const TIPOS_MENSAGEM = ['estado', 'acao', 'sinal', 'fala', 'erro', 'chat', 'batida'] as const;

/** Uma mensagem `acao` recebida, para as animações (o `id` só cresce). */
export interface Movimento {
  id: number;
  msg: MsgAcao;
}

export type Status = 'fora' | 'conectando' | 'na-mesa' | 'reconectando';

export interface EstadoLoja {
  status: Status;
  /** Último `estado` do servidor (null antes do primeiro). */
  msg: MsgEstado | null;
  /**
   * Feed efêmero (balões, sinais), do mais antigo ao mais novo. Não depende da ordem
   * em relação ao `estado`: o `sinal` dos bots pode chegar antes do `estado` da mão nova.
   */
  eventos: Evento[];
  erro: { id: number; mensagem: string } | null;
  /** Chat da mesa privada (últimas 50). */
  chat: MsgChat[];
  /** `roomId` da sala atual (código do convite da mesa privada). */
  salaId: string | null;
  /** Última batida na mesa (animação); `id` muda a cada uma, `em` = epoch ms local de chegada. */
  batida?: (MsgBatida & { id: number; em: number }) | null;
  /** Últimas mensagens `acao` (até 20), na ordem; ausente = nenhuma. As animações do ritual leem daqui. */
  movimentos?: Movimento[];
}

export interface OpcoesLoja {
  agora?: () => number;
  /** Guarda/apaga o `reconnectionToken` (sessionStorage na app real). */
  persistirToken?: (token: string | null) => void;
  maxEventos?: number;
  /**
   * Mesa ranqueada cancelada antes de começar (`SAIDA_PARTIDA_CANCELADA`: alguém não
   * apareceu). Com isto, a loja avisa que está voltando à fila e chama (a app real entra
   * na fila de novo com as mesmas opções); sem, só avisa do cancelamento.
   */
  aoCancelarRanqueada?: () => void;
}

/** `CloseCode.CONSENTED` do @colyseus/sdk 0.18: saída pedida (leave(true) ou o servidor). */
export const SAIDA_CONSENTIDA = 4000;

const INICIAL: EstadoLoja = { status: 'fora', msg: null, eventos: [], erro: null, chat: [], salaId: null, movimentos: [] };

export function criarLoja(o: OpcoesLoja = {}) {
  const agora = o.agora ?? Date.now;
  const persistir = o.persistirToken ?? (() => {});
  const maxEventos = o.maxEventos ?? 30;

  let estado: EstadoLoja = INICIAL;
  let sala: SalaLike | null = null;
  let seq = 0;
  let aguardandoEstadoAposReconexao = false;
  const ouvintes = new Set<() => void>();

  const mudar = (p: Partial<EstadoLoja>) => {
    estado = { ...estado, ...p };
    for (const f of ouvintes) f();
  };
  const evento = (e: NovoEvento) =>
    mudar({ eventos: [...estado.eventos, { ...e, id: ++seq, em: agora() }].slice(-maxEventos) });
  const erro = (mensagem: string) => mudar({ erro: { id: ++seq, mensagem } });
  /** `esquecerToken` = false numa queda: um F5 ainda recupera a cadeira (o servidor guarda 60 s). */
  const largar = (esquecerToken = true) => {
    sala = null;
    aguardandoEstadoAposReconexao = false;
    if (esquecerToken) persistir(null);
    mudar({ status: 'fora', msg: null, eventos: [], chat: [], salaId: null, batida: null, movimentos: [] });
  };

  function conectar(s: SalaLike): void {
    const antiga = sala;
    sala = s;
    aguardandoEstadoAposReconexao = false;
    // Uma sala antiga ainda aberta seria uma cadeira fantasma: sai dela (o onLeave dela é ignorado).
    if (antiga && antiga !== s) antiga.leave(true).catch(() => {});
    // Todos os handlers ANTES de qualquer envio: mensagem sem handler o SDK descarta.
    s.onMessage('estado', (m: MsgEstado) => {
      if (sala === s) {
        aguardandoEstadoAposReconexao = false;
        mudar({ msg: m });
      }
    });
    s.onMessage('acao', (a: MsgAcao) => {
      if (sala !== s) return;
      mudar({ movimentos: [...(estado.movimentos ?? []), { id: ++seq, msg: a }].slice(-20) });
      const texto = textoDaAcao(a, estado.msg?.visao ?? null);
      if (texto) evento({ tipo: 'acao', de: a.cadeira, texto });
    });
    s.onMessage('fala', (f: MsgFala) => {
      if (sala === s) evento({ tipo: 'fala', de: f.de, texto: FALA_TEXTO[f.fala] ?? String(f.fala) });
    });
    s.onMessage('sinal', (x: MsgSinal) => {
      if (sala === s) evento({ tipo: 'sinal', de: x.de, sinal: x.sinal, interceptado: !!x.interceptado });
    });
    s.onMessage('erro', (e: MsgErro) => {
      if (sala === s) erro(e.mensagem);
    });
    s.onMessage('chat', (m: MsgChat) => {
      if (sala === s) mudar({ chat: [...estado.chat, m].slice(-50) });
    });
    s.onMessage('batida', (b: MsgBatida) => {
      if (sala === s) mudar({ batida: { ...b, id: ++seq, em: agora() } });
    });
    s.onDrop(() => {
      if (sala === s) {
        aguardandoEstadoAposReconexao = true;
        mudar({ status: 'reconectando' });
      }
    });
    s.onReconnect(() => {
      if (sala !== s) return;
      mudar({ status: 'na-mesa' });
      // Comandos só são liberados após receber o estado atualizado do servidor.
      aguardandoEstadoAposReconexao = true;
      // O servidor guarda a resposta até o ACK do join (que o SDK manda logo depois).
      s.send('sincronizar');
      // O SDK 0.18 só troca `reconnectionToken` no `finally`, depois de chamar onReconnect.
      queueMicrotask(() => {
        if (sala === s) persistir(s.reconnectionToken);
      });
    });
    s.onLeave((code) => {
      if (sala !== s) return;
      if (code === SAIDA_PARTIDA_CANCELADA) {
        largar(true);
        if (o.aoCancelarRanqueada) {
          erro('Alguém não apareceu; voltando à fila…');
          o.aoCancelarRanqueada();
        } else {
          erro('Partida ranqueada cancelada: nem todos entraram a tempo');
        }
        return;
      }
      const consentida = code === SAIDA_CONSENTIDA;
      const terminou = estado.msg?.visao?.fase === 'fimPartida';
      largar(consentida || terminou);
      if (!consentida) erro('Conexão com a mesa perdida');
    });
    persistir(s.reconnectionToken);
    mudar({ status: 'na-mesa', msg: null, eventos: [], chat: [], salaId: s.roomId, batida: null, movimentos: [] });
    s.send('sincronizar');
  }

  const enviarSeConectado = (tipo: string, payload?: unknown) => {
    if (estado.status === 'na-mesa' && !aguardandoEstadoAposReconexao) sala?.send(tipo, payload);
  };

  return {
    subscribe(f: () => void): () => void {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    getSnapshot: (): EstadoLoja => estado,
    conectar,
    marcarConectando: () => mudar({ status: 'conectando' }),
    /** Volta ao lobby; com mensagem, mostra o toast. */
    falhouConexao: (mensagem?: string) => {
      mudar({ status: 'fora' });
      if (mensagem) erro(mensagem);
    },
    // Nunca enfileirar comandos enquanto o socket caiu: o estado do turno pode
    // ter mudado. Após reconectar, sincronizar primeiro e aguardar nova ação.
    enviarAcao: (a: AcaoJogador) => enviarSeConectado('acao', a),
    enviarSinal: (x: Sinal) => enviarSeConectado('sinal', x),
    enviarFala: (f: Fala) => enviarSeConectado('fala', f),
    enviarSemFamilia: () => enviarSeConectado('semFamilia'),
    enviarRevanche: () => enviarSeConectado('revanche'),
    enviarChat: (texto: string) => enviarSeConectado('chat', texto),
    /** Logo depois do pedido de seis/nove/doze (o servidor só aceita nessa janela). */
    enviarBatida: (forca: number) => enviarSeConectado('batida', { forca }),
    iniciar: () => enviarSeConectado('iniciar'),
    /**
     * Saída definitiva (o servidor põe um bot no lugar). Larga o estado local antes do
     * `leave`: com o socket meio aberto ele pode demorar, e a UI não deve esperar.
     */
    sair: async (): Promise<void> => {
      const s = sala;
      if (!s) return;
      largar();
      try {
        await s.leave(true);
      } catch {
        // já estamos fora; o servidor trata a queda como saída depois de 60 s
      }
    },
    limparErro: (id: number) => {
      if (estado.erro?.id === id) mudar({ erro: null });
    },
  };
}

export type Loja = ReturnType<typeof criarLoja>;
