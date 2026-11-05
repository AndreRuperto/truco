import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { participacoes, partidas, ratings, usuarios } from '../src/banco/schema';
import { type BancoDeTeste, bancoDeTeste, ehViolacaoUnica } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

describe('banco (PGlite + migração inicial)', () => {
  test('cria usuário com padrões e recusa apelido repetido', async () => {
    const [u] = await b.db.insert(usuarios).values({ apelido: 'Ana' }).returning();
    expect(u).toMatchObject({ id: 1, apelido: 'Ana', email: null, googleSub: null });
    expect(u.criadoEm).toBeInstanceOf(Date);
    const erro = await b.db.insert(usuarios).values({ apelido: 'Ana' }).catch((e: unknown) => e);
    expect(ehViolacaoUnica(erro)).toBe(true);
  });

  test('rating padrão 1000 elo / 0 pontos; partida e participações com cascata', async () => {
    const [u] = await b.db.insert(usuarios).values({ apelido: 'Bia' }).returning();
    await b.db.insert(ratings).values({ usuarioId: u.id, variante: 'mineiro' });
    expect(await b.db.select().from(ratings)).toEqual([
      expect.objectContaining({ usuarioId: u.id, variante: 'mineiro', elo: 1000, pontos: 0, partidas: 0 }),
    ]);
    const [p] = await b.db.insert(partidas).values({ variante: 'paulista', modo: 'classica' }).returning();
    expect(p).toMatchObject({ ranqueada: false, abandonada: false, placar0: 0, placar1: 0, vencedora: null, terminadaEm: null });
    await b.db.insert(participacoes).values({ partidaId: p.id, usuarioId: u.id, nome: 'Bia', humano: true, cadeira: 0, dupla: 0 });
    await b.db.delete(partidas).where(eq(partidas.id, p.id));
    expect(await b.db.select().from(participacoes)).toEqual([]);
  });
});
