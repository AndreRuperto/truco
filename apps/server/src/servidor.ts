import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { configurarApp } from './http/app';
import { instalarCors } from './http/cors';
import { MesaRoom } from './MesaRoom';
import { listarSalasAbertas } from './salas';
import type { Servicos } from './servicos';

export interface ExtrasServidor {
  /** Pasta do build do web, servida na mesma origem (produção). */
  pastaWeb?: string | null;
}

export function criarServidor(servicos: Servicos, extras: ExtrasServidor = {}) {
  MesaRoom.servicos = servicos;
  instalarCors(servicos);
  return defineServer({
    transport: new WebSocketTransport(),
    // Só junta quem pediu o mesmo modo, variante, quantidade de humanos, nível de bot e
    // regras (`chaveRegras`). `MesaRoom.onAuth` preenche esses campos nas opções de quem
    // procura e `MesaRoom.onCreate` na metadata da sala: ninguém fica sem filtro.
    rooms: { mesa: defineRoom(MesaRoom).filterBy(['modo', 'variante', 'humanos', 'nivelBot', 'chaveRegras']) },
    // Rotas HTTP no mesmo servidor: o roteador do Colyseus atende /matchmake e /__healthcheck,
    // o resto cai neste Express.
    express: (app) => configurarApp(app, servicos, { listarSalas: listarSalasAbertas, pastaWeb: extras.pastaWeb ?? null }),
  });
}
