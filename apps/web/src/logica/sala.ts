import type { Cadeira } from '@truco/engine';
import type { InfoCadeira, MsgEstado } from '@truco/protocolo';

/** Espelha `Mesa.dono()`: o primeiro humano conectado, na ordem das cadeiras. */
export function donoDaMesa(cadeiras: InfoCadeira[]): Cadeira | null {
  const i = cadeiras.findIndex((c) => c.tipo === 'humano' && c.conectado);
  return i < 0 ? null : (i as Cadeira);
}

export const souDono = (msg: MsgEstado): boolean => donoDaMesa(msg.cadeiras) === msg.minhaCadeira;
