import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { MesaRoom } from './MesaRoom';

export function criarServidor() {
  return defineServer({
    transport: new WebSocketTransport(),
    // Só junta quem pediu a mesma variante, quantidade de humanos, nível de bot e regras
    // (`chaveRegras`: pontuação, mão de 10/11, família e chance de interceptar, achatadas).
    // Quem entra é comparado pelas opções cruas que mandou: quem omite um campo aceita
    // qualquer valor — por isso o cliente oficial SEMPRE manda `chaveRegras`. Do lado da
    // sala, `MesaRoom.onCreate` recalcula esses campos a partir das opções validadas.
    rooms: { mesa: defineRoom(MesaRoom).filterBy(['variante', 'humanos', 'nivelBot', 'chaveRegras']) },
  });
}
