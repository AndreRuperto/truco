import type { Cadeira, Visao } from '@truco/engine';
import type { Fala, MsgAcao, Sinal } from '@truco/protocolo';
import { nomePedido } from './textos';

export const FALA_TEXTO: Record<Fala, string> = {
  truco: 'TRUCO!',
  seis: 'SEIS!',
  nove: 'NOVE!',
  doze: 'DOZE!',
  desce: 'Desce!',
  corro: 'Corro!',
  boa: 'Boa!',
  vixe: 'Vixe!',
  bora: 'Bora!',
};

export type NovoEvento =
  | { tipo: 'acao' | 'fala'; de: Cadeira; texto: string }
  | { tipo: 'sinal'; de: Cadeira; sinal: Sinal; interceptado: boolean };

/** Evento efêmero do feed (balões, sinais). `em` = epoch ms local de chegada. */
export type Evento = NovoEvento & { id: number; em: number };

export const DURACAO_BALAO_MS = 2_500;

/**
 * Texto do balão para uma mensagem `acao`. O servidor manda `acao` ANTES do `estado`
 * resultante, então `anterior` é a visão de antes do pedido: truco propõe nivel + 1;
 * aumentar propõe o pendente + 1.
 */
export function textoDaAcao(a: MsgAcao, anterior: Visao | null): string | null {
  const m = anterior?.mao ?? null;
  switch (a.tipo) {
    case 'truco':
      return `${nomePedido((m?.nivel ?? 0) + 1).toUpperCase()}!`;
    case 'aumentar':
      return `${nomePedido((m?.trucoPendente?.proposto ?? 1) + 1).toUpperCase()}!`;
    case 'aceitar':
      return 'Aceito!';
    case 'correr':
      return 'Corro!';
    case 'familia':
      return 'Família!';
    default:
      return null;
  }
}

/** Balão atual de cada cadeira: o evento (ação/fala) mais recente dentro da duração. */
export function baloesAtivos(eventos: Evento[], agora: number, duracaoMs = DURACAO_BALAO_MS): Map<Cadeira, string> {
  const r = new Map<Cadeira, string>();
  for (const e of eventos) if (e.tipo !== 'sinal' && agora - e.em < duracaoMs) r.set(e.de, e.texto);
  return r;
}
