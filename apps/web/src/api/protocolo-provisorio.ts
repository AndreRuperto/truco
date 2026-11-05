// TEMPORÁRIO: cópia do contrato que a frente servidor acrescenta a `apps/server/src/mesa/protocolo.ts`
// na Tarefa 11 do Plano 4 (`MAX_CHAT`, `MsgChat`, `MsgEstado.modo`). Quando ela existir lá, importe
// `MAX_CHAT`/`MsgChat` de `@truco/protocolo`, troque `modoDaMesa(msg)` por `msg.modo` e apague este arquivo.
import type { Cadeira } from '@truco/engine';
import type { ModoMesa, MsgEstado } from '@truco/protocolo';

export const MAX_CHAT = 200;

export interface MsgChat {
  de: Cadeira;
  nome: string;
  texto: string;
}

/** `MsgEstado` com o `modo` da Tarefa 11 (opcional enquanto o server não manda). */
export type MsgEstadoComModo = MsgEstado & { modo?: ModoMesa };

/** Tipo da mesa; sem o campo (server antigo) vale 'classica'. */
export const modoDaMesa = (m: MsgEstado): ModoMesa => (m as MsgEstadoComModo).modo ?? 'classica';
