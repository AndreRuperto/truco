import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { MesaRoom } from './MesaRoom';

export function criarServidor() {
  return defineServer({
    transport: new WebSocketTransport(),
    rooms: { mesa: defineRoom(MesaRoom) },
  });
}
