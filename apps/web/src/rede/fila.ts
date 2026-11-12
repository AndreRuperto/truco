import type { Formato, MsgPareado, MsgStatusFila } from '@truco/api';
import type { Variante } from '@truco/engine';
import { SAIDA_CONTA_SUSPENSA, SAIDA_FILA_SUBSTITUIDA } from '@truco/protocolo';
import { textoErroFila } from '../logica/conta';

export interface OpcoesFila {
  variante: Variante;
  formato: Formato;
  codigoDupla?: string;
}

/** O mínimo do `Room` do SDK que a loja da fila usa. */
export interface SalaFilaLike {
  onMessage(tipo: string, cb: (payload: any) => void): unknown;
  onLeave(cb: (code: number) => void): unknown;
  leave(consented?: boolean): Promise<number>;
}

export type StatusFila = 'fora' | 'entrando' | 'na-fila' | 'pareado';

export interface EstadoFila {
  status: StatusFila;
  opcoes: OpcoesFila | null;
  info: MsgStatusFila | null;
  erro: string | null;
}

const INICIAL: EstadoFila = { status: 'fora', opcoes: null, info: null, erro: null };

export function criarLojaFila(o: { abrir: (op: OpcoesFila) => Promise<SalaFilaLike>; aoParear: (reserva: unknown) => Promise<void> }) {
  let estado: EstadoFila = INICIAL;
  let sala: SalaFilaLike | null = null;
  /** Sobe a cada entrar/cancelar: um `abrir` que resolve depois disso é de uma tentativa velha. */
  let geracao = 0;
  const ouvintes = new Set<() => void>();
  const mudar = (p: Partial<EstadoFila>) => {
    estado = { ...estado, ...p };
    for (const f of ouvintes) f();
  };
  // Função (e não `estado.status` direto): o TS estreitaria o tipo e ignoraria as mudanças dos `await`.
  const statusAtual = (): StatusFila => estado.status;

  async function entrar(op: OpcoesFila): Promise<void> {
    if (estado.status !== 'fora') return;
    const g = ++geracao;
    mudar({ status: 'entrando', opcoes: op, info: null, erro: null });
    let s: SalaFilaLike;
    try {
      s = await o.abrir(op);
    } catch (e) {
      if (g === geracao) mudar({ status: 'fora', erro: textoErroFila(e instanceof Error ? e.message : String(e)) });
      return;
    }
    // Cancelou (e talvez entrou de novo) enquanto entrava: não fica numa fila que ninguém está olhando.
    if (g !== geracao || statusAtual() !== 'entrando') {
      s.leave(true).catch(() => {});
      return;
    }
    sala = s;
    s.onMessage('status', (m: MsgStatusFila) => {
      if (sala === s) mudar({ status: 'na-fila', info: m });
    });
    s.onMessage('pareado', (m: MsgPareado) => {
      if (sala !== s) return;
      sala = null;
      mudar({ status: 'pareado' });
      s.leave(true).catch(() => {});
      o.aoParear(m.reserva).finally(() => mudar({ ...INICIAL, opcoes: estado.opcoes }));
    });
    s.onLeave((code) => {
      if (sala !== s) return;
      sala = null;
      mudar({ ...INICIAL, opcoes: estado.opcoes, erro: code === SAIDA_FILA_SUBSTITUIDA ? 'Você entrou na fila em outra aba.' : code === SAIDA_CONTA_SUSPENSA ? 'Sua conta foi suspensa.' : 'Você saiu da fila.' });
    });
    if (statusAtual() === 'entrando') mudar({ status: 'na-fila' });
  }

  return {
    subscribe(f: () => void): () => void {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    getSnapshot: (): EstadoFila => estado,
    entrar,

    /**
     * Mesa ranqueada cancelada antes de começar (alguém não apareceu): volta à fila com as
     * mesmas opções da última vez. Sem opções (nunca entrou) ou já na fila, não faz nada.
     */
    reentrar: async (): Promise<void> => {
      if (estado.opcoes) await entrar(estado.opcoes);
    },

    async cancelar(): Promise<void> {
      geracao++;
      const s = sala;
      sala = null;
      mudar({ ...INICIAL, opcoes: estado.opcoes });
      if (s) await s.leave(true).catch(() => 0);
    },
  };
}

export type LojaFila = ReturnType<typeof criarLojaFila>;
