import { matchMaker } from '@colyseus/core';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { MesaRoom } from '../src/MesaRoom';
import { criarServidor } from '../src/servidor';

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  MesaRoom.tempos = { botMs: 20, pausaMaoMs: 50, jogadaMs: 2_000 };
  colyseus = await boot(criarServidor());
});
afterEach(async () => {
  await colyseus.cleanup();
});
afterAll(async () => {
  await colyseus.shutdown();
});

function coletor(room: { onMessage: (tipo: '*', cb: (tipo: string | number, payload: any) => void) => unknown }) {
  const msgs: Record<string, any[]> = {};
  room.onMessage('*', (tipo, payload) => {
    (msgs[String(tipo)] ??= []).push(payload);
  });
  return msgs;
}

async function esperar(cond: () => boolean, ms = 5_000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado esperando condição');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('MesaRoom', () => {
  test('humano entra, bots completam e só a própria visão chega', async () => {
    const sala = await colyseus.createRoom('mesa', { variante: 'mineiro', humanos: 1 });
    const cliente = await colyseus.connectTo(sala, { nome: 'Ana' });
    const msgs = coletor(cliente);
    await esperar(() => !!msgs.estado?.some((m) => m.visao?.mao));
    const ultimo = msgs.estado.at(-1);
    expect(ultimo.minhaCadeira).toBe(0);
    expect(ultimo.cadeiras.filter((c: any) => c.tipo === 'bot')).toHaveLength(3);
    expect(JSON.stringify(ultimo)).not.toContain('"maos"');
  });

  test('cliente não consegue distribuir', async () => {
    const sala = await colyseus.createRoom('mesa', { humanos: 1 });
    const cliente = await colyseus.connectTo(sala, { nome: 'Ana' });
    const msgs = coletor(cliente);
    cliente.send('acao', { tipo: 'distribuir', baralho: [] });
    await esperar(() => !!msgs.erro?.length);
    expect(msgs.erro[0]).toEqual({ mensagem: 'ação inválida' });
  });

  test('sala cheia recusa mais gente', async () => {
    const sala = await colyseus.createRoom('mesa', { humanos: 1 });
    await colyseus.connectTo(sala, { nome: 'Ana' });
    await expect(colyseus.connectTo(sala, { nome: 'Bia' })).rejects.toThrow();
  });

  test('quem reservou lugar mas a partida já começou é recusado sem rejeição solta', async () => {
    const rejeicoes: unknown[] = [];
    const ouvir = (e: unknown) => rejeicoes.push(e);
    process.on('unhandledRejection', ouvir);
    try {
      const sala = await colyseus.createRoom('mesa', { humanos: 2 });
      const a = await colyseus.connectTo(sala, { nome: 'Ana' });
      const ma = coletor(a);
      const reserva = await matchMaker.joinById(sala.roomId, { nome: 'Bia' });
      a.send('iniciar');
      await esperar(() => !!ma.estado?.some((m) => m.visao));
      await expect(colyseus.sdk.consumeSeatReservation(reserva)).rejects.toThrow();
      await new Promise((r) => setTimeout(r, 100));
      expect(rejeicoes).toEqual([]);
    } finally {
      process.off('unhandledRejection', ouvir);
    }
  });

  test('dois humanos ficam parceiros', async () => {
    const sala = await colyseus.createRoom('mesa', { humanos: 2 });
    const a = await colyseus.connectTo(sala, { nome: 'Ana' });
    const ma = coletor(a);
    const b = await colyseus.connectTo(sala, { nome: 'Bia' });
    const mb = coletor(b);
    await esperar(() => !!ma.estado?.length && !!mb.estado?.length);
    expect(ma.estado.at(-1).minhaCadeira).toBe(0);
    expect(mb.estado.at(-1).minhaCadeira).toBe(2);
  });

  test('iniciar antes de lotar tranca a sala', async () => {
    const a = await colyseus.sdk.joinOrCreate('mesa', { humanos: 2, nome: 'Ana' });
    const ma = coletor(a);
    await esperar(() => !!ma.estado?.length);
    a.send('iniciar');
    const sala = colyseus.getRoomById(a.roomId);
    await esperar(() => sala.locked);
    const b = await colyseus.sdk.joinOrCreate('mesa', { humanos: 2, nome: 'Bia' });
    coletor(b);
    expect(b.roomId).not.toBe(a.roomId);
  });
});
