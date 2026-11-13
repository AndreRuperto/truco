import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { participacoes, partidas, ratings } from '../src/banco/schema';
import { contadoresZerados } from '../src/ranking/estatisticas';
import {
  type AssentoRegistro,
  bloqueioAte,
  encerrarOrfas,
  historico,
  iniciarPartida,
  perfil,
  ranking,
  ratingDe,
  partidaComEloCongelado,
  registrarAbandono,
  terminarPartida,
} from '../src/repo/partidas';
import { LIMITE_MESMO_GRUPO_24H } from '../src/ranking/mesmoGrupo';
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
    const feitas = (pa?.conquistas ?? []).filter((c) => c.alcancada).map((c) => c.id);
    expect(feitas).toEqual(['primeira-vitoria', 'estreia']);
    expect(pa?.conquistas?.find((c) => c.id === 'frequentador')?.progresso).toEqual({ atual: 1, meta: 10 });

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

describe('conluio na ranqueada: Elo congelado no mesmo grupo (F4.1)', () => {
  const MIN = 60_000;
  const em = (min: number) => new Date(T0.getTime() + min * MIN);
  async function ranqueada(assentos: AssentoRegistro[], formato: '1x1' | '2x2', quando: Date, vencedora: 0 | 1 = 0) {
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato, assentos }, quando);
    const deltas = await terminarPartida(b.db, id, fim(vencedora, [12, 5]), { k: 32, agora: quando });
    return { id, deltas };
  }

  test(`a ${LIMITE_MESMO_GRUPO_24H}ª entre o mesmo par muda o Elo; a seguinte não, e fica marcada`, async () => {
    expect(LIMITE_MESMO_GRUPO_24H).toBe(5);
    const { ana, bia } = await doisJogadores();
    const a = assentos1x1(ana.id, bia.id);
    for (let i = 0; i < 4; i++) await ranqueada(a, '1x1', em(i * 10));
    const quinta = await ranqueada(a, '1x1', em(40));
    expect(quinta.deltas.get(ana.id)).not.toBe(0);
    expect(await partidaComEloCongelado(b.db, quinta.id)).toBe(false);
    const antes = await ratingDe(b.db, ana.id, 'paulista');
    const sexta = await ranqueada(a, '1x1', em(50));
    expect(sexta.deltas).toEqual(new Map([[ana.id, 0], [bia.id, 0]]));
    expect(await partidaComEloCongelado(b.db, sexta.id)).toBe(true);
    const depois = await ratingDe(b.db, ana.id, 'paulista');
    expect(depois).toEqual({ ...antes, partidas: antes.partidas + 1 });
    const [pa] = await b.db.select().from(participacoes).where(eq(participacoes.partidaId, sexta.id));
    expect(pa.eloDepois).toBe(pa.eloAntes);
    // A partida em si vale: placar e vitória gravados.
    const [p] = await b.db.select().from(partidas).where(eq(partidas.id, sexta.id));
    expect(p).toMatchObject({ placar0: 12, placar1: 5, vencedora: 0 });
  });

  test('depois de 24 h volta a valer', async () => {
    const { ana, bia } = await doisJogadores();
    const a = assentos1x1(ana.id, bia.id);
    for (let i = 0; i < 6; i++) await ranqueada(a, '1x1', em(i * 10));
    const depois = await ranqueada(a, '1x1', em(25 * 60));
    expect(depois.deltas.get(ana.id)).not.toBe(0);
    expect(await partidaComEloCongelado(b.db, depois.id)).toBe(false);
  });

  test('em 2x2 conta o mesmo conjunto de 4 contas; trocar uma conta quebra o grupo', async () => {
    const [u1, u2, u3, u4, u5] = await Promise.all(['a', 'b', 'c', 'd', 'e'].map((n) => criarUsuario(b.db, { apelidoBase: n })));
    const quatro = (x: number[]): AssentoRegistro[] => x.map((id, cadeira) => ({ cadeira: cadeira as 0 | 1 | 2 | 3, usuarioId: id, nome: `u${id}`, humano: true }));
    // As mesmas 4 contas em cadeiras diferentes continuam o mesmo grupo.
    for (let i = 0; i < 5; i++) await ranqueada(quatro(i % 2 ? [u1.id, u2.id, u3.id, u4.id] : [u2.id, u1.id, u4.id, u3.id]), '2x2', em(i * 10));
    const outroGrupo = await ranqueada(quatro([u1.id, u2.id, u3.id, u5.id]), '2x2', em(60));
    expect(await partidaComEloCongelado(b.db, outroGrupo.id)).toBe(false);
    const mesmo = await ranqueada(quatro([u1.id, u2.id, u3.id, u4.id]), '2x2', em(70));
    expect(await partidaComEloCongelado(b.db, mesmo.id)).toBe(true);
    expect([...mesmo.deltas.values()].every((d) => d === 0)).toBe(true);
  });

  test('abandono numa partida congelada: sem Elo, mas o bloqueio de fila continua', async () => {
    const { ana, bia } = await doisJogadores();
    const a = assentos1x1(ana.id, bia.id);
    for (let i = 0; i < 5; i++) await ranqueada(a, '1x1', em(i * 10));
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: a }, em(60));
    const antes = await ratingDe(b.db, ana.id, 'paulista');
    const delta = await registrarAbandono(b.db, id, ana.id, { k: 32, agora: em(61), bloqueioMs: 5 * MIN });
    expect(delta).toBe(0);
    expect((await ratingDe(b.db, ana.id, 'paulista')).elo).toBe(antes.elo);
    expect(await bloqueioAte(b.db, ana.id, em(61))).toEqual(em(66));
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

describe('partidas órfãs (o processo morreu no meio)', () => {
  test('encerrarOrfas fecha só as sem fim, como abandonadas, sem Elo nem bloqueio', async () => {
    const { ana, bia } = await doisJogadores();
    const orfa = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    const acabada = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    await terminarPartida(b.db, acabada, fim(0, [12, 3]), OPC);
    const fimAntes = (await b.db.select().from(partidas).where(eq(partidas.id, acabada)))[0].terminadaEm;
    const depois = new Date(T0.getTime() + 60_000);

    expect(await encerrarOrfas(b.db, depois)).toBe(1);

    const [p] = await b.db.select().from(partidas).where(eq(partidas.id, orfa));
    expect(p).toMatchObject({ abandonada: true, terminadaEm: depois, vencedora: null });
    const [q] = await b.db.select().from(partidas).where(eq(partidas.id, acabada));
    expect(q).toMatchObject({ abandonada: false, terminadaEm: fimAntes });
    const ps = await b.db.select().from(participacoes).where(eq(participacoes.partidaId, orfa));
    expect(ps.every((x) => x.eloDepois === null && !x.abandonou)).toBe(true);
    // Só a partida que terminou mexeu no Elo; ninguém ficou bloqueado.
    expect(await ratingDe(b.db, ana.id, 'paulista')).toEqual({ elo: 1016, pontos: 16, partidas: 1 });
    expect(await bloqueioAte(b.db, ana.id, depois)).toBeNull();
    expect(await encerrarOrfas(b.db, depois)).toBe(0);
  });
});

describe('corridas (fim e abandono chamados duas vezes)', () => {
  test('terminar duas vezes ao mesmo tempo soma o Elo uma vez só', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    const [d1, d2] = await Promise.all([terminarPartida(b.db, id, fim(0, [12, 7]), OPC), terminarPartida(b.db, id, fim(0, [12, 7]), OPC)]);
    expect([d1.size, d2.size].sort()).toEqual([0, 2]);
    expect(await ratingDe(b.db, ana.id, 'paulista')).toEqual({ elo: 1016, pontos: 16, partidas: 1 });
  });

  test('abandonar duas vezes ao mesmo tempo penaliza uma vez só', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    const r = await Promise.all([registrarAbandono(b.db, id, ana.id, OPC), registrarAbandono(b.db, id, ana.id, OPC)]);
    expect(r.filter((x) => x !== null)).toEqual([-16]);
    expect(await ratingDe(b.db, ana.id, 'paulista')).toEqual({ elo: 984, pontos: 0, partidas: 1 });
  });

  test('abandono depois do fim não penaliza; fim depois do abandono não repõe o Elo', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    await Promise.all([terminarPartida(b.db, id, fim(1, [3, 12]), OPC), registrarAbandono(b.db, id, ana.id, OPC)]);
    expect((await ratingDe(b.db, ana.id, 'paulista')).partidas).toBe(1);
    expect((await ratingDe(b.db, bia.id, 'paulista')).partidas).toBeLessThanOrEqual(1);
  });
});
