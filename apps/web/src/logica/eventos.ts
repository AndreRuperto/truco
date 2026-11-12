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
      return a.aberta === undefined ? 'Família!' : a.aberta ? 'Família aberta!' : 'Família fechada!';
    case 'embaralhar':
      return 'Embaralhando…';
    case 'passarCorte':
      return 'Corta aí!';
    case 'cortar':
      return 'Cortei.';
    case 'abrir3':
      return 'Abri 3!';
    case 'dar3':
      return 'Toma 3, parceiro!';
    case 'devolver':
      return 'Pode dar.';
    case 'distribuir':
      return a.modo === 'porBaixo' ? 'Por baixo!' : a.modo === 'subindo' ? 'Subindo!' : 'Por cima!';
    case 'conferir':
      return a.conferir ? 'Confere!' : 'Pode ir.';
    case 'mao10':
      return a.jogar === undefined ? null : a.jogar ? 'Vamos!' : 'Corro!';
    default:
      return null;
  }
}

/**
 * Balão atual de cada cadeira: o evento (ação/fala) mais recente dentro da duração. Com `maximo`,
 * só as `maximo` cadeiras que falaram por último (em telas estreitas, três balões ao mesmo tempo
 * se encobriam: o mais antigo some).
 */
export function baloesAtivos(
  eventos: Evento[],
  agora: number,
  duracaoMs = DURACAO_BALAO_MS,
  maximo = Infinity,
): Map<Cadeira, string> {
  const ultimo = new Map<Cadeira, { texto: string; em: number }>();
  for (const e of eventos) if (e.tipo !== 'sinal' && agora - e.em < duracaoMs) ultimo.set(e.de, { texto: e.texto, em: e.em });
  const recentes = [...ultimo].sort(([, a], [, b]) => a.em - b.em).slice(-maximo);
  return new Map(recentes.map(([c, { texto }]) => [c, texto]));
}
