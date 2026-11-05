import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { MesaRoom } from './MesaRoom';

export function criarServidor() {
  return defineServer({
    transport: new WebSocketTransport(),
    // Só junta quem pediu o mesmo modo, variante, quantidade de humanos, nível de bot e
    // regras (`chaveRegras`). `MesaRoom.onAuth` preenche esses campos nas opções de quem
    // procura e `MesaRoom.onCreate` na metadata da sala: ninguém fica sem filtro.
    rooms: { mesa: defineRoom(MesaRoom).filterBy(['modo', 'variante', 'humanos', 'nivelBot', 'chaveRegras']) },
  });
}
