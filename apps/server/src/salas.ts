import { matchMaker } from '@colyseus/core';
import type { MesaAdmin, SalaAberta } from './api/tipos';

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

/** Para o painel de admin: todas as mesas vivas (privadas, ranqueadas e já começadas também). */
export async function listarMesasAdmin(): Promise<MesaAdmin[]> {
  const salas = await matchMaker.query({ name: 'mesa' });
  return salas.map((s) => ({
    id: s.roomId,
    modo: s.metadata?.modo ?? null,
    variante: s.metadata?.variante ?? null,
    ocupados: s.clients,
    lugares: s.maxClients,
    privada: !!s.private,
    trancada: !!s.locked,
    dono: s.metadata?.dono ?? null,
    criadaEm: s.createdAt ? new Date(s.createdAt).toISOString() : null,
  }));
}
