import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { participacoes, partidas, ratings } from '../src/banco/schema';
import { contadoresZerados } from '../src/ranking/estatisticas';
import {
  type AssentoRegistro,
  bloqueioAte,
  historico,
  iniciarPartida,
  perfil,
  ranking,
  ratingDe,
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

const T0 = new Date('2026-11-05T12:00:00Z');
const OPC = { k: 32, agora: T0, bloqueioMs: 5 * 60_000 };

async function doisJogadores() {
  const ana = await criarUsuario(b.db, { apelidoBase: 'ana' });
  const bia = await criarUsuario(b.db, { apelidoBase: 'bia' });
  return { ana, bia };
}

/** 1x1 ranqueado: ana na cadeira 0, bia na 1, bots nas 2 e 3. */
const assentos1x1 = (ana: number, bia: number): AssentoRegistro[] => [
  { cadeira: 0, usuarioId: ana, nome: 'ana', humano: true },
  { cadeira: 1, usuarioId: bia, nome: 'bia', humano: true },
  { cadeira: 2, usuarioId: null, nome: 'Bot Zé', humano: false },
  { cadeira: 3, usuarioId: null, nome: 'Bot Tião', humano: false },
];

const fim = (vencedora: 0 | 1, placar: [number, number]) => ({
  placar,
  vencedora,
  contadores: [
    { trucosPedidos: 2, respostasTruco: 3, trucosAceitos: 2, corridas: 1 },
    contadoresZerados(),
    contadoresZerados(),
    contadoresZerados(),
  ],
});

describe('partida ranqueada', () => {
  test('início grava 4 participações, com elo_antes só para humanos logados', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    const ps = await b.db.select().from(participacoes).where(eq(participacoes.partidaId, id));
    expect(ps.map((p) => [p.cadeira, p.dupla, p.eloAntes])).toEqual([
      [0, 0, 1000],
      [1, 1, 1000],
      [2, 0, null],
      [3, 1, null],
    ]);
  });

  test('fim: vencedor +16, perdedor -16, estatísticas, placar e ranking', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    const deltas = await terminarPartida(b.db, id, fim(0, [12, 7]), OPC);
    expect(deltas).toEqual(new Map([[ana.id, 16], [bia.id, -16]]));
    expect(await ratingDe(b.db, ana.id, 'paulista')).toEqual({ elo: 1016, pontos: 16, partidas: 1 });
    expect(await ratingDe(b.db, bia.id, 'paulista')).toEqual({ elo: 984, pontos: 0, partidas: 1 });
    expect(await ratingDe(b.db, ana.id, 'mineiro')).toEqual({ elo: 1000, pontos: 0, partidas: 0 });

    const [p] = await b.db.select().from(partidas).where(eq(partidas.id, id));
    expect(p).toMatchObject({ placar0: 12, placar1: 7, vencedora: 0, abandonada: false });
    expect(p.terminadaEm).toEqual(T0);

    const pa = await perfil(b.db, ana.id);
    expect(pa?.variantes.paulista).toEqual({
      elo: 1016,
      pontos: 16,
      patente: 'Bronze',
      proxima: { nome: 'Prata', faltam: 284 },
      partidasRanqueadas: 1,
      jogos: 1,
      vitorias: 1,
      pctTrucoAceito: 67,
      corridas: 1,
    });
    expect(pa?.variantes.mineiro.jogos).toBe(0);

    expect((await ranking(b.db, 'paulista')).map((l) => [l.posicao, l.apelido, l.pontos, l.patente])).toEqual([
      [1, 'ana', 16, 'Bronze'],
      [2, 'bia', 0, 'Bronze'],
    ]);
    expect(await ranking(b.db, 'mineiro')).toEqual([]);

    const h = await historico(b.db, bia.id);
    expect(h).toEqual([
      expect.objectContaining({ partidaId: id, variante: 'paulista', modo: 'ranqueada', ranqueada: true, nos: 7, eles: 12, venceu: false, abandonou: false, deltaElo: -16 }),
    ]);
  });

  test('abandono: derrota na hora, bloqueio de 5 min e quem ficou pontua no fim', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'mineiro', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    expect(await registrarAbandono(b.db, id, ana.id, OPC)).toBe(-16);
    expect(await registrarAbandono(b.db, id, ana.id, OPC)).toBeNull();
    expect(await ratingDe(b.db, ana.id, 'mineiro')).toEqual({ elo: 984, pontos: 0, partidas: 1 });
    expect(await bloqueioAte(b.db, ana.id, new Date(T0.getTime() + 60_000))).toEqual(new Date(T0.getTime() + 5 * 60_000));
    expect(await bloqueioAte(b.db, ana.id, new Date(T0.getTime() + 6 * 60_000))).toBeNull();

    // a dupla da Ana (agora com bot) até vence, mas ela não ganha nada
    const deltas = await terminarPartida(b.db, id, fim(0, [12, 10]), OPC);
    expect(deltas).toEqual(new Map([[bia.id, -16]]));
    expect(await ratingDe(b.db, ana.id, 'mineiro')).toEqual({ elo: 984, pontos: 0, partidas: 1 });
    const [pa] = await b.db.select().from(participacoes).where(eq(participacoes.usuarioId, ana.id));
    expect(pa).toMatchObject({ abandonou: true, venceu: false, eloAntes: 1000, eloDepois: 984 });
  });

  test('todos os humanos saíram: partida abandonada, ninguém mais pontua', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    await registrarAbandono(b.db, id, ana.id, OPC);
    await registrarAbandono(b.db, id, bia.id, OPC);
    expect(await terminarPartida(b.db, id, fim(1, [3, 12]), OPC)).toEqual(new Map());
    const [p] = await b.db.select().from(partidas).where(eq(partidas.id, id));
    expect(p.abandonada).toBe(true);
    expect((await ratingDe(b.db, bia.id, 'paulista')).elo).toBe(984);
  });
});

describe('partida casual', () => {
  test('grava histórico e estatísticas, sem Elo; abandono não bloqueia', async () => {
    const { ana } = await doisJogadores();
    const id = await iniciarPartida(
      b.db,
      {
        variante: 'paulista',
        modo: 'classica',
        formato: null,
        assentos: [
          { cadeira: 0, usuarioId: ana.id, nome: 'ana', humano: true },
          { cadeira: 1, usuarioId: null, nome: 'Bot Zé', humano: false },
          { cadeira: 2, usuarioId: null, nome: 'Convidado', humano: true },
          { cadeira: 3, usuarioId: null, nome: 'Bot Tião', humano: false },
        ],
      },
      T0,
    );
    expect(await registrarAbandono(b.db, id, ana.id, OPC)).toBeNull();
    expect(await bloqueioAte(b.db, ana.id, T0)).toBeNull();
    await terminarPartida(b.db, id, fim(0, [12, 0]), OPC);
    expect(await b.db.select().from(ratings)).toEqual([]);
    const [p] = await b.db.select().from(partidas).where(eq(partidas.id, id));
    expect(p.abandonada).toBe(false); // o convidado ficou até o fim
    expect((await perfil(b.db, ana.id))?.variantes.paulista).toMatchObject({ jogos: 1, vitorias: 0, partidasRanqueadas: 0 });
  });

  test('perfil de usuário inexistente', async () => {
    expect(await perfil(b.db, 999)).toBeNull();
  });
});
