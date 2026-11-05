import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { MesaRoom } from './MesaRoom';

export function criarServidor() {
  return defineServer({
    transport: new WebSocketTransport(),
    // Só junta quem pediu a mesma variante, quantidade de humanos e nível de bot.
    // O filtro usa as opções cruas do cliente: quem omite um campo aceita qualquer valor.
    rooms: { mesa: defineRoom(MesaRoom).filterBy(['variante', 'humanos', 'nivelBot']) },
  });
}
