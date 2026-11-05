import { matchMaker } from '@colyseus/core';
import { Client } from '@colyseus/sdk';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { REGRAS_RANQUEADA } from '@truco/engine';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { bloqueiosFila, participacoes, partidas } from '../src/banco/schema';
import { FilaRoom } from '../src/FilaRoom';
import { MesaRoom } from '../src/MesaRoom';
import { chaveRegras } from '../src/mesa/protocolo';
import { ratingDe } from '../src/repo/partidas';
import { criarSessao, entrarComEmail } from '../src/repo/usuarios';
import { criarServidor } from '../src/servidor';
import { type Servicos, servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let colyseus: ColyseusTestServer;
let banco: BancoDeTeste;
let servicos: Servicos;

beforeAll(async () => {
  MesaRoom.tempos = { botMs: 20, pausaMaoMs: 50, jogadaMs: 2_000 };
  FilaRoom.intervaloMs = 100;
  banco = await bancoDeTeste();
  servicos = servicosDeTeste(banco.db);
  colyseus = await boot(criarServidor(servicos));
}, 30_000);
afterEach(async () => {
  await colyseus.cleanup();
  await banco.limpar();
});
afterAll(async () => {
  await colyseus.shutdown();
  await banco.fechar();
});

const URL_TESTE = 'http://localhost:2568';

/** Usuário logado: sessão criada direto no banco e mandada como Bearer pelo SDK. */
async function logado(email: string) {
  const u = await entrarComEmail(banco.db, email);
  const token = await criarSessao(banco.db, u.id, new Date());
  const cliente = new Client(URL_TESTE);
  cliente.auth.token = token;
  return { u, token, cliente };
}

async function esperarAsync(cond: () => Promise<boolean>, ms = 5_000) {
  const t0 = Date.now();
  while (!(await cond())) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado esperando condição');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const salasAbertas = async () => ((await (await fetch(`${URL_TESTE}/api/salas`)).json()) as { salas: any[] }).salas;

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
    coletor(await colyseus.connectTo(sala, { nome: 'Ana' }));
    await expect(colyseus.connectTo(sala, { nome: 'Bia' })).rejects.toThrow();
  });

  test('sincronizar reenvia o estado', async () => {
    const sala = await colyseus.createRoom('mesa', { humanos: 2 });
    const a = await colyseus.connectTo(sala, { nome: 'Ana' });
    const ma = coletor(a);
    await esperar(() => !!ma.estado?.length);
    const n = ma.estado.length;
    a.send('sincronizar');
    await esperar(() => ma.estado.length > n);
    expect(ma.estado.at(-1).minhaCadeira).toBe(0);
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

  test('matchmaking separa por variante, humanos e nível do bot', async () => {
    const a = await colyseus.sdk.joinOrCreate('mesa', { variante: 'mineiro', humanos: 2, nivelBot: 'facil', nome: 'Ana' });
    coletor(a);
    const b = await colyseus.sdk.joinOrCreate('mesa', { variante: 'paulista', humanos: 2, nome: 'Bia' });
    coletor(b);
    expect(b.roomId).not.toBe(a.roomId);
    const c = await colyseus.sdk.joinOrCreate('mesa', { variante: 'mineiro', humanos: 2, nivelBot: 'dificil', nome: 'Cid' });
    coletor(c);
    expect(c.roomId).not.toBe(a.roomId);
    const d = await colyseus.sdk.joinOrCreate('mesa', { variante: 'mineiro', humanos: 2, nivelBot: 'facil', nome: 'Duda' });
    coletor(d);
    expect(d.roomId).toBe(a.roomId);
  });

  test('matchmaking separa por regras (chaveRegras) e a sala guarda a chave recalculada', async () => {
    const regras = { pontuacao: '1-3-6-9-12', maoDe10: false, maoDe11: 'qualquerDupla', familia: 'off' } as const;
    const chave = chaveRegras({ variante: 'paulista', ...regras }, 0);
    const a = await colyseus.sdk.joinOrCreate('mesa', { variante: 'paulista', humanos: 2, nivelBot: 'facil', regras, chaveRegras: chave, nome: 'Ana' });
    coletor(a);
    const outras = { ...regras, familia: 'aberta' } as const;
    const b = await colyseus.sdk.joinOrCreate('mesa', {
      variante: 'paulista',
      humanos: 2,
      nivelBot: 'facil',
      regras: outras,
      chaveRegras: chaveRegras({ variante: 'paulista', ...outras }, 0),
      nome: 'Bia',
    });
    coletor(b);
    expect(b.roomId).not.toBe(a.roomId);
    const c = await colyseus.sdk.joinOrCreate('mesa', { variante: 'paulista', humanos: 2, nivelBot: 'facil', regras, chaveRegras: chave, nome: 'Cid' });
    const mc = coletor(c);
    expect(c.roomId).toBe(a.roomId);
    await esperar(() => !!mc.estado?.length);
    expect(mc.estado.at(-1).regras).toEqual({ variante: 'paulista', ...regras });
  });

  test('chave mentirosa na criação é corrigida: quem pede as regras reais entra na sala', async () => {
    const regras = { pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'off', familia: 'fechada' } as const;
    const a = await colyseus.sdk.joinOrCreate('mesa', { variante: 'mineiro', humanos: 2, nivelBot: 'facil', regras, chaveRegras: 'mentira', nome: 'Ana' });
    coletor(a);
    const b = await colyseus.sdk.joinOrCreate('mesa', {
      variante: 'mineiro',
      humanos: 2,
      nivelBot: 'facil',
      regras,
      chaveRegras: chaveRegras({ variante: 'mineiro', ...regras }, 0),
      nome: 'Bia',
    });
    coletor(b);
    expect(b.roomId).toBe(a.roomId);
  });

  test('cliente que inunda mensagens é desconectado', async () => {
    const sala = await colyseus.createRoom('mesa', { humanos: 1 });
    expect(sala.maxMessagesPerSecond).toBe(20);
    const a = await colyseus.connectTo(sala, { nome: 'Ana' });
    coletor(a);
    let saiu = false;
    a.onLeave(() => {
      saiu = true;
    });
    for (let i = 0; i < 50; i++) a.send('fala', 'boa');
    await esperar(() => saiu);
  });

  test('quem omite os campos do filtro procura a sala padrão, não qualquer sala', async () => {
    const a = await colyseus.sdk.joinOrCreate('mesa', { variante: 'mineiro', humanos: 2, nivelBot: 'dificil', nome: 'Ana' });
    coletor(a);
    const b = await colyseus.sdk.joinOrCreate('mesa', { nome: 'Bia' });
    const mb = coletor(b);
    expect(b.roomId).not.toBe(a.roomId);
    await esperar(() => !!mb.estado?.length);
    expect(mb.estado.at(-1).regras.variante).toBe('paulista');
    const [sala] = await matchMaker.query({ roomId: a.roomId });
    expect(sala.metadata).toMatchObject({ modo: 'desafio', variante: 'mineiro', humanos: 2, nivelBot: 'dificil' });
  });

  test('cliente não cria mesa ranqueada', async () => {
    await expect(colyseus.sdk.create('mesa', { modo: 'ranqueada', nome: 'Ana' })).rejects.toThrow(/fila/);
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

describe('contas, privadas e HTTP no mesmo servidor', () => {
  test('/saude e /api/config respondem na porta do Colyseus', async () => {
    expect((await fetch(`${URL_TESTE}/saude`)).status).toBe(200);
    expect(await (await fetch(`${URL_TESTE}/api/config`)).json()).toEqual({ google: null, emailTeste: true });
  });

  test('logado senta com o apelido da conta e a partida é gravada ao começar', async () => {
    const ana = await logado('ana@x.com');
    const sala = await ana.cliente.joinOrCreate('mesa', { humanos: 1, nome: 'Outro Nome' });
    const m = coletor(sala);
    await esperar(() => !!m.estado?.some((x) => x.visao));
    expect(m.estado.at(-1).cadeiras[0].nome).toBe('ana');
    expect(m.estado.at(-1).modo).toBe('classica');
    await esperarAsync(async () => (await banco.db.select().from(participacoes)).length === 4);
    const [p] = await banco.db.select().from(participacoes).where(eq(participacoes.usuarioId, ana.u.id));
    expect(p).toMatchObject({ cadeira: 0, humano: true, nome: 'ana' });
  });

  test('token de sessão inválido entra como convidado', async () => {
    const c = new Client(URL_TESTE);
    c.auth.token = 'inventado';
    const sala = await c.joinOrCreate('mesa', { humanos: 1, nome: 'Convidado' });
    const m = coletor(sala);
    await esperar(() => !!m.estado?.length);
    expect(m.estado.at(-1).cadeiras[0].nome).toBe('Convidado');
  });

  test('mesa privada: fora da lista e do joinOrCreate, entra por código e tem chat', async () => {
    const a = await colyseus.sdk.create('mesa', { modo: 'privada', humanos: 2, nome: 'Ana' });
    const ma = coletor(a);
    await esperar(() => !!ma.estado?.length);
    expect(ma.estado.at(-1).modo).toBe('privada');
    expect((await salasAbertas()).map((s) => s.id)).not.toContain(a.roomId);
    // Mesa privada só nasce por `create` e se entra por `joinById`; `joinOrCreate`/`join` recusam.
    await expect(colyseus.sdk.joinOrCreate('mesa', { modo: 'privada', humanos: 2, nome: 'Cid' })).rejects.toThrow(/privada/);
    await expect(colyseus.sdk.join('mesa', { modo: 'privada', humanos: 2, nome: 'Cid' })).rejects.toThrow(/privada/);

    const b = await colyseus.sdk.joinById(a.roomId, { nome: 'Bia' });
    const mb = coletor(b);
    await esperar(() => !!mb.estado?.length);
    a.send('chat', '  oi\u0007 pessoal ');
    await esperar(() => !!mb.chat?.length);
    expect(mb.chat[0]).toEqual({ de: 0, nome: 'Ana', texto: 'oi pessoal' });
  });

  test('mesa casual esperando gente aparece em /api/salas', async () => {
    const a = await colyseus.sdk.joinOrCreate('mesa', { humanos: 2, nivelBot: 'dificil', nome: 'Ana' });
    coletor(a);
    await esperarAsync(async () => (await salasAbertas()).some((s) => s.id === a.roomId));
    expect((await salasAbertas()).find((s) => s.id === a.roomId)).toMatchObject({
      modo: 'desafio',
      variante: 'paulista',
      humanos: 2,
      nivelBot: 'dificil',
      ocupados: 1,
      dono: 'Ana',
    });
  });
});

describe('MesaRoom: abandono total, outra aba e gravações no desligamento', () => {
  test('último humano sai com a partida em andamento: a sala descartada fecha a partida como abandonada', async () => {
    const ana = await logado('ana@x.com');
    const sala = await ana.cliente.joinOrCreate('mesa', { humanos: 1 });
    const m = coletor(sala);
    await esperar(() => !!m.estado?.some((x) => x.visao));
    await esperarAsync(async () => (await banco.db.select().from(partidas)).length === 1);
    const roomId = sala.roomId;
    await sala.leave(true);
    await esperar(() => !matchMaker.getLocalRoomById(roomId));
    // O desligamento espera isto antes de fechar o banco.
    await MesaRoom.esperarGravacoes();
    const [p] = await banco.db.select().from(partidas);
    expect(p.terminadaEm).not.toBeNull();
    expect(p.abandonada).toBe(true);
  });

  test('a mesma conta não senta duas vezes na mesma mesa (outra aba)', async () => {
    const ana = await logado('ana@x.com');
    const a = await ana.cliente.create('mesa', { modo: 'privada', humanos: 2 });
    coletor(a);
    const outraAba = new Client(URL_TESTE);
    outraAba.auth.token = ana.token;
    await expect(outraAba.joinById(a.roomId, {})).rejects.toThrow(/já está nesta mesa/);
    const bia = await logado('bia@x.com');
    const b = await bia.cliente.joinById(a.roomId, {});
    coletor(b);
    expect(b.roomId).toBe(a.roomId);
  });
});

describe('fila ranqueada', () => {
  const FILA_1X1 = { variante: 'paulista', formato: '1x1' };

  test('convidado não entra na fila', async () => {
    await expect(colyseus.sdk.joinOrCreate('fila', FILA_1X1)).rejects.toThrow(/entre na sua conta/);
  });

  test('1x1: pareados numa mesa ranqueada privada com bots parceiros; abandono custa Elo e bloqueia', async () => {
    const ana = await logado('ana@x.com');
    const bia = await logado('bia@x.com');
    const fa = coletor(await ana.cliente.joinOrCreate('fila', FILA_1X1));
    const fb = coletor(await bia.cliente.joinOrCreate('fila', FILA_1X1));
    await esperar(() => !!fa.pareado?.length && !!fb.pareado?.length);

    const mesaA = await ana.cliente.consumeSeatReservation(fa.pareado[0].reserva);
    const ma = coletor(mesaA);
    const mesaB = await bia.cliente.consumeSeatReservation(fb.pareado[0].reserva);
    const mb = coletor(mesaB);
    expect(mesaA.roomId).toBe(mesaB.roomId);
    await esperar(() => !!ma.estado?.some((m) => m.visao) && !!mb.estado?.some((m) => m.visao));
    const e = ma.estado.at(-1);
    expect(e.modo).toBe('ranqueada');
    expect(e.regras).toEqual(REGRAS_RANQUEADA.paulista);
    expect(e.cadeiras.map((c: any) => c.tipo)).toEqual(['humano', 'humano', 'bot', 'bot']);
    expect([e.cadeiras[0].nome, e.cadeiras[1].nome].sort()).toEqual(['ana', 'bia']);
    expect((await salasAbertas()).map((s) => s.id)).not.toContain(mesaA.roomId);

    await mesaA.leave(true);
    await esperarAsync(async () => (await ratingDe(banco.db, ana.u.id, 'paulista')).elo === 984);
    await expect(ana.cliente.joinOrCreate('fila', FILA_1X1)).rejects.toThrow(/bloqueada/);

    await mesaB.leave(true);
    await esperarAsync(async () => (await banco.db.select().from(bloqueiosFila)).length === 2);
  });

  test('desligamento do servidor (redeploy) no meio da ranqueada: ninguém perde Elo nem é bloqueado', async () => {
    const ana = await logado('ana@x.com');
    const bia = await logado('bia@x.com');
    const fa = coletor(await ana.cliente.joinOrCreate('fila', FILA_1X1));
    const fb = coletor(await bia.cliente.joinOrCreate('fila', FILA_1X1));
    await esperar(() => !!fa.pareado?.length && !!fb.pareado?.length);
    const mesaA = await ana.cliente.consumeSeatReservation(fa.pareado[0].reserva);
    const ma = coletor(mesaA);
    const mesaB = await bia.cliente.consumeSeatReservation(fb.pareado[0].reserva);
    coletor(mesaB);
    await esperar(() => !!ma.estado?.some((m) => m.visao));
    await esperarAsync(async () => (await banco.db.select().from(partidas)).length === 1);

    // O que o `gracefullyShutdown` do Colyseus faz com cada sala (SIGTERM).
    const roomId = mesaA.roomId;
    matchMaker.getLocalRoomById(roomId)!.onBeforeShutdown();
    await esperar(() => !matchMaker.getLocalRoomById(roomId));
    await MesaRoom.esperarGravacoes();

    const [p] = await banco.db.select().from(partidas);
    expect(p.terminadaEm).not.toBeNull();
    expect(p.abandonada).toBe(true);
    expect(await ratingDe(banco.db, ana.u.id, 'paulista')).toEqual({ elo: 1000, pontos: 0, partidas: 0 });
    expect(await ratingDe(banco.db, bia.u.id, 'paulista')).toEqual({ elo: 1000, pontos: 0, partidas: 0 });
    expect(await banco.db.select().from(bloqueiosFila)).toEqual([]);
    expect((await banco.db.select().from(participacoes)).some((x) => x.abandonou)).toBe(false);
  });

  test('pareado/em mesa ranqueada viva não entra na fila de novo (outra aba) até a mesa acabar', async () => {
    const espera = MesaRoom.esperaRanqueadaMs;
    MesaRoom.esperaRanqueadaMs = 500;
    try {
      const ana = await logado('ana@x.com');
      const bia = await logado('bia@x.com');
      const fa = coletor(await ana.cliente.joinOrCreate('fila', FILA_1X1));
      const fb = coletor(await bia.cliente.joinOrCreate('fila', FILA_1X1));
      await esperar(() => !!fa.pareado?.length && !!fb.pareado?.length);
      const outraAba = new Client(URL_TESTE);
      outraAba.auth.token = ana.token;
      await expect(outraAba.joinOrCreate('fila', FILA_1X1)).rejects.toThrow(/partida ranqueada em andamento/);
      // Ninguém consome a reserva: a mesa é cancelada (sem penalidade) e a conta é liberada.
      const roomId = fa.pareado[0].reserva.roomId as string;
      await esperar(() => !matchMaker.getLocalRoomById(roomId), 5_000);
      const fila = await outraAba.joinOrCreate('fila', FILA_1X1);
      coletor(fila);
      expect(await banco.db.select().from(bloqueiosFila)).toEqual([]);
    } finally {
      MesaRoom.esperaRanqueadaMs = espera;
    }
  });

  test('reserva de assento falha: ninguém recebe pareado, a mesa criada é descartada e os dois voltam à fila', async () => {
    const original = FilaRoom.reservar;
    const salas: string[] = [];
    let chamadas = 0;
    FilaRoom.reservar = async (sala, opcoes, auth) => {
      salas.push(sala.roomId);
      if (++chamadas === 2) throw new Error('falha simulada na reserva');
      return original(sala, opcoes, auth);
    };
    try {
      const ana = await logado('ana@x.com');
      const bia = await logado('bia@x.com');
      const fa = coletor(await ana.cliente.joinOrCreate('fila', FILA_1X1));
      const fb = coletor(await bia.cliente.joinOrCreate('fila', FILA_1X1));
      // 1ª tentativa falha na 2ª reserva; a rodada seguinte pareia de novo, noutra mesa.
      await esperar(() => !!fa.pareado?.length && !!fb.pareado?.length);
      expect(fa.pareado).toHaveLength(1);
      expect(fb.pareado).toHaveLength(1);
      const primeira = salas[0];
      expect(fa.pareado[0].reserva.roomId).not.toBe(primeira);
      expect(fa.pareado[0].reserva.roomId).toBe(fb.pareado[0].reserva.roomId);
      await esperar(() => !matchMaker.getLocalRoomById(primeira));
    } finally {
      FilaRoom.reservar = original;
    }
  });

  test('2x2: terceiro com o mesmo código de dupla é recusado com erro claro', async () => {
    const opcoes = { variante: 'mineiro', formato: '2x2', codigoDupla: 'trio' };
    for (const email of ['t1@x.com', 't2@x.com']) coletor(await (await logado(email)).cliente.joinOrCreate('fila', opcoes));
    const t3 = await logado('t3@x.com');
    await expect(t3.cliente.joinOrCreate('fila', opcoes)).rejects.toThrow(/código de dupla já tem dois jogadores/);
  });

  test('2x2: quem usa o mesmo código fica parceiro', async () => {
    const jogadores = [];
    for (const email of ['ana1@x.com', 'ana2@x.com', 'bia1@x.com', 'bia2@x.com']) jogadores.push(await logado(email));
    const filas: Record<string, any[]>[] = [];
    for (const [i, j] of jogadores.entries()) {
      const opcoes = { variante: 'mineiro', formato: '2x2', ...(i < 2 ? { codigoDupla: 'amigos' } : {}) };
      filas.push(coletor(await j.cliente.joinOrCreate('fila', opcoes)));
    }
    await esperar(() => filas.every((f) => !!f.pareado?.length));
    const mesas: Awaited<ReturnType<Client['consumeSeatReservation']>>[] = [];
    for (const [i, j] of jogadores.entries()) mesas.push(await j.cliente.consumeSeatReservation(filas[i].pareado[0].reserva));
    const m0 = coletor(mesas[0]);
    for (const m of mesas.slice(1)) coletor(m);
    await esperar(() => !!m0.estado?.some((x) => x.visao));
    const nomes: string[] = m0.estado.at(-1).cadeiras.map((c: any) => c.nome);
    expect(nomes.indexOf('ana1') % 2).toBe(nomes.indexOf('ana2') % 2);
    expect(nomes.indexOf('bia1') % 2).toBe(nomes.indexOf('bia2') % 2);
    expect(m0.estado.at(-1).regras).toEqual(REGRAS_RANQUEADA.mineiro);

    for (const m of mesas) await m.leave(true);
    await esperarAsync(async () => (await banco.db.select().from(bloqueiosFila)).length === 4);
  });
});
