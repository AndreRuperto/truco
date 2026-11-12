import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { partidas } from '../src/banco/schema';
import { contadoresZerados } from '../src/ranking/estatisticas';
import { movimentar, saldosDe } from '../src/repo/carteira';
import {
  type AssentoRegistro,
  encerrarAbandonada,
  encerrarOrfas,
  iniciarPartidaComCacife,
  registrarAbandono,
  terminarPartida,
} from '../src/repo/partidas';
import { criarUsuario } from '../src/repo/usuarios';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

const T0 = new Date('2026-11-11T15:00:00Z');
const OPC = { k: 32, agora: T0 };

async function comFichas(nome: string, fichas: number): Promise<number> {
  const u = await criarUsuario(b.db, { apelidoBase: nome });
  if (fichas > 0) await b.db.transaction((tx) => movimentar(tx, u.id, 'fichas', fichas, 'ajuste_admin'));
  return u.id;
}
const fichas = async (id: number) => (await saldosDe(b.db, id)).fichas;
const humano = (cadeira: 0 | 1 | 2 | 3, usuarioId: number | null): AssentoRegistro => ({ cadeira, usuarioId, nome: `h${cadeira}`, humano: true });
const bot = (cadeira: 0 | 1 | 2 | 3): AssentoRegistro => ({ cadeira, usuarioId: null, nome: 'Bot', humano: false });
const fim = (vencedora: 0 | 1 | null) => ({ placar: [12, 4] as const, vencedora, contadores: [0, 1, 2, 3].map(contadoresZerados) });
const iniciar = (assentos: AssentoRegistro[], cacife: number, modo: 'privada' | 'ranqueada' = 'privada', agora = T0) =>
  iniciarPartidaComCacife(b.db, { variante: 'paulista', modo, formato: modo === 'ranqueada' ? '1x1' : null, assentos, cacife }, agora);

describe('cacife na partida', () => {
  test('1x1: debita no início, o vencedor leva o pote e terminar de novo não paga duas vezes', async () => {
    const ana = await comFichas('ana', 1000);
    const bia = await comFichas('bia', 1000);
    const p = await iniciar([humano(0, ana), humano(1, bia), bot(2), bot(3)], 100);
    expect(p).toMatchObject({ cacife: 100, pote: 200 });
    expect([await fichas(ana), await fichas(bia)]).toEqual([900, 900]);
    await terminarPartida(b.db, p.id, fim(0), OPC);
    await terminarPartida(b.db, p.id, fim(0), OPC);
    expect([await fichas(ana), await fichas(bia)]).toEqual([1100, 900]);
  });

  test('2x2: cada vencedor recebe metade do pote', async () => {
    const ids = await Promise.all(['a', 'b', 'c', 'd'].map((n) => comFichas(n, 500)));
    const p = await iniciar(ids.map((id, i) => humano(i as 0 | 1 | 2 | 3, id)), 250);
    expect(p.pote).toBe(1000);
    await terminarPartida(b.db, p.id, fim(1), OPC);
    // Dupla 1 = cadeiras 1 e 3.
    expect(await Promise.all(ids.map(fichas))).toEqual([250, 750, 250, 750]);
  });

  test('o menor saldo limita o cacife de todos', async () => {
    const ana = await comFichas('ana', 1000);
    const bia = await comFichas('bia', 60);
    const p = await iniciar([humano(0, ana), humano(1, bia), bot(2), bot(3)], 500);
    expect(p).toMatchObject({ cacife: 60, pote: 120 });
    expect([await fichas(ana), await fichas(bia)]).toEqual([940, 0]);
  });

  test('sem pagante numa das duplas, ou com saldo zero, não há cacife', async () => {
    const ana = await comFichas('ana', 1000);
    const contraBots = await iniciar([humano(0, ana), bot(1), bot(2), bot(3)], 100);
    expect(contraBots).toMatchObject({ cacife: 0, pote: 0 });
    const zero = await comFichas('zero', 0);
    const semSaldo = await iniciar([humano(0, ana), humano(1, zero), bot(2), bot(3)], 100);
    expect(semSaldo.cacife).toBe(0);
    // Convidado (sem conta) não paga nem conta como pagante.
    const convidado = await iniciar([humano(0, ana), humano(1, null), bot(2), bot(3)], 100);
    expect(convidado.cacife).toBe(0);
    expect(await fichas(ana)).toBe(1000);
  });

  test('quem abandona perde o cacife; o parceiro que ficou leva o pote da dupla', async () => {
    const ids = await Promise.all(['a', 'b', 'c', 'd'].map((n) => comFichas(n, 100)));
    const p = await iniciar(ids.map((id, i) => humano(i as 0 | 1 | 2 | 3, id)), 100);
    await registrarAbandono(b.db, p.id, ids[0], { ...OPC, bloqueioMs: 0 });
    await terminarPartida(b.db, p.id, fim(0), OPC);
    expect(await Promise.all(ids.map(fichas))).toEqual([0, 0, 400, 0]);
  });

  test('todos saíram: o pote some; desligamento e órfã devolvem', async () => {
    const ana = await comFichas('ana', 300);
    const bia = await comFichas('bia', 300);
    const assentos = [humano(0, ana), humano(1, bia), bot(2), bot(3)];
    const a = await iniciar(assentos, 100);
    await encerrarAbandonada(b.db, a.id, T0);
    expect([await fichas(ana), await fichas(bia)]).toEqual([200, 200]);

    const d = await iniciar(assentos, 100);
    await encerrarAbandonada(b.db, d.id, T0, { reembolsar: true });
    await encerrarAbandonada(b.db, d.id, T0, { reembolsar: true });
    expect([await fichas(ana), await fichas(bia)]).toEqual([200, 200]);

    await iniciar(assentos, 100);
    expect(await encerrarOrfas(b.db, T0)).toBe(1);
    expect([await fichas(ana), await fichas(bia)]).toEqual([200, 200]);
    const [x] = await b.db.select().from(partidas).where(eq(partidas.id, a.id));
    expect(x).toMatchObject({ cacife: 100, pote: 200, abandonada: true });
  });

  test('ranqueada: depois de 5 partidas entre os mesmos em 24 h, o pote volta para cada um', async () => {
    const ana = await comFichas('ana', 2000);
    const bia = await comFichas('bia', 2000);
    const assentos = [humano(0, ana), humano(1, bia), bot(2), bot(3)];
    for (let i = 0; i < 5; i++) {
      const quando = new Date(T0.getTime() + i * 60_000);
      const p = await iniciar(assentos, 100, 'ranqueada', quando);
      await terminarPartida(b.db, p.id, fim(0), { k: 32, agora: quando });
    }
    expect([await fichas(ana), await fichas(bia)]).toEqual([2500, 1500]);
    const sexta = new Date(T0.getTime() + 10 * 60_000);
    const p = await iniciar(assentos, 100, 'ranqueada', sexta);
    await terminarPartida(b.db, p.id, fim(0), { k: 32, agora: sexta });
    expect([await fichas(ana), await fichas(bia)]).toEqual([2500, 1500]);
    // No dia seguinte volta a valer.
    const depois = new Date(T0.getTime() + 25 * 60 * 60_000);
    const q = await iniciar(assentos, 100, 'ranqueada', depois);
    await terminarPartida(b.db, q.id, fim(0), { k: 32, agora: depois });
    expect([await fichas(ana), await fichas(bia)]).toEqual([2600, 1400]);
  });
});
