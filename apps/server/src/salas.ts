import { matchMaker } from '@colyseus/core';
import type { SalaAberta } from './api/tipos';

/** Mesas casuais públicas ainda esperando jogadores (as cheias já foram trancadas ao começar). */
export async function listarSalasAbertas(): Promise<SalaAberta[]> {
  const salas = await matchMaker.query({ name: 'mesa', locked: false, private: false });
  return salas
    .filter((s) => (s.metadata?.modo === 'classica' || s.metadata?.modo === 'desafio') && s.clients < s.maxClients)
    .map((s) => ({
      id: s.roomId,
      modo: s.metadata.modo,
      variante: s.metadata.variante,
      humanos: s.metadata.humanos,
      nivelBot: s.metadata.nivelBot,
      regras: s.metadata.regras ?? null,
      ocupados: s.clients,
      dono: s.metadata.dono ?? null,
    }));
}
