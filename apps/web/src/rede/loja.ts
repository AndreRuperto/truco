import type { AcaoJogador } from '@truco/engine';
import type { Fala, MsgAcao, MsgErro, MsgEstado, MsgFala, MsgSinal, Sinal } from '@truco/protocolo';
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
export const TIPOS_MENSAGEM = ['estado', 'acao', 'sinal', 'fala', 'erro'] as const;

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
}

export interface OpcoesLoja {
  agora?: () => number;
  /** Guarda/apaga o `reconnectionToken` (sessionStorage na app real). */
  persistirToken?: (token: string | null) => void;
  maxEventos?: number;
}

/** `CloseCode.CONSENTED` do @colyseus/sdk 0.18: saída pedida (leave(true) ou o servidor). */
export const SAIDA_CONSENTIDA = 4000;

const INICIAL: EstadoLoja = { status: 'fora', msg: null, eventos: [], erro: null };

export function criarLoja(o: OpcoesLoja = {}) {
  const agora = o.agora ?? Date.now;
  const persistir = o.persistirToken ?? (() => {});
  const maxEventos = o.maxEventos ?? 30;

  let estado: EstadoLoja = INICIAL;
  let sala: SalaLike | null = null;
  let seq = 0;
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
    if (esquecerToken) persistir(null);
    mudar({ status: 'fora', msg: null, eventos: [] });
  };

  function conectar(s: SalaLike): void {
    const antiga = sala;
    sala = s;
    // Uma sala antiga ainda aberta seria uma cadeira fantasma: sai dela (o onLeave dela é ignorado).
    if (antiga && antiga !== s) antiga.leave(true).catch(() => {});
    // Todos os handlers ANTES de qualquer envio: mensagem sem handler o SDK descarta.
    s.onMessage('estado', (m: MsgEstado) => {
      if (sala === s) mudar({ msg: m });
    });
    s.onMessage('acao', (a: MsgAcao) => {
      const texto = textoDaAcao(a, estado.msg?.visao ?? null);
      if (sala === s && texto) evento({ tipo: 'acao', de: a.cadeira, texto });
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
    s.onDrop(() => {
      if (sala === s) mudar({ status: 'reconectando' });
    });
    s.onReconnect(() => {
      if (sala !== s) return;
      mudar({ status: 'na-mesa' });
      // O servidor guarda a resposta até o ACK do join (que o SDK manda logo depois).
      s.send('sincronizar');
      // O SDK 0.18 só troca `reconnectionToken` no `finally`, depois de chamar onReconnect.
      queueMicrotask(() => {
        if (sala === s) persistir(s.reconnectionToken);
      });
    });
    s.onLeave((code) => {
      if (sala !== s) return;
      const consentida = code === SAIDA_CONSENTIDA;
      const terminou = estado.msg?.visao?.fase === 'fimPartida';
      largar(consentida || terminou);
      if (!consentida) erro('Conexão com a mesa perdida');
    });
    persistir(s.reconnectionToken);
    mudar({ status: 'na-mesa', msg: null, eventos: [] });
    s.send('sincronizar');
  }

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
    enviarAcao: (a: AcaoJogador) => sala?.send('acao', a),
    enviarSinal: (x: Sinal) => sala?.send('sinal', x),
    enviarFala: (f: Fala) => sala?.send('fala', f),
    iniciar: () => sala?.send('iniciar'),
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
