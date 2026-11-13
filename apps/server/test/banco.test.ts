import { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { abrirBanco, PASTA_MIGRACOES } from '../src/banco/banco';
import { auditoria, carteiras, participacoes, partidas, ratings, usuarios } from '../src/banco/schema';
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

  test('carteira nunca fica negativa (check no banco)', async () => {
    const [u] = await b.db.insert(usuarios).values({ apelido: 'Cid' }).returning();
    const erro = await b.db
      .insert(carteiras)
      .values({ usuarioId: u.id, fichas: -1 })
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    const erroPila = await b.db
      .insert(carteiras)
      .values({ usuarioId: u.id, pila: -5 })
      .catch((e: unknown) => e);
    expect(erroPila).toBeInstanceOf(Error);
    expect(await b.db.select().from(carteiras)).toEqual([]);
  });
});

describe('abrirBanco com migração que falha', () => {
  test('fecha o PGlite e relança o erro', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'truco-migr-'));
    try {
      mkdirSync(join(pasta, 'meta'));
      writeFileSync(
        join(pasta, 'meta', '_journal.json'),
        JSON.stringify({ version: '7', dialect: 'postgresql', entries: [{ idx: 0, version: '7', when: 1, tag: '0000_ruim', breakpoints: true }] }),
      );
      writeFileSync(join(pasta, '0000_ruim.sql'), 'SELECT * FROM tabela_que_nao_existe;');
      // Guarda a instância que o abrirBanco criou (via a primeira consulta dela).
      const consultas = vi.spyOn(PGlite.prototype, 'query');
      await expect(abrirBanco({ pastaMigracoes: pasta })).rejects.toThrow();
      const instancias = new Set(consultas.mock.contexts as PGlite[]);
      consultas.mockRestore();
      expect(instancias.size).toBe(1);
      for (const c of instancias) expect(c.closed).toBe(true);
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('migrações da fase 4 num banco com dados (0006 a 0008)', () => {
  test('aplicam sobre dados de antes: preenchem o e-mail canônico, mantêm partidas e criam a auditoria', async () => {
    const raiz = mkdtempSync(join(tmpdir(), 'truco-f4-'));
    const ate0005 = join(raiz, 'migr');
    const dados = join(raiz, 'pglite');
    try {
      // Cópia das migrações só até a 0005 (o banco de produção antes desta fase).
      mkdirSync(join(ate0005, 'meta'), { recursive: true });
      const diario = JSON.parse(readFileSync(join(PASTA_MIGRACOES, 'meta', '_journal.json'), 'utf8'));
      diario.entries = diario.entries.filter((e: { idx: number }) => e.idx <= 5);
      writeFileSync(join(ate0005, 'meta', '_journal.json'), JSON.stringify(diario));
      for (const e of diario.entries as { tag: string }[]) copyFileSync(join(PASTA_MIGRACOES, `${e.tag}.sql`), join(ate0005, `${e.tag}.sql`));

      const antes = await abrirBanco({ pastaPglite: dados, pastaMigracoes: ate0005 });
      await antes.db.execute(sql`INSERT INTO usuarios (apelido, email) VALUES ('ana', 'ana+velha@x.com'), ('bia', 'bia@x.com')`);
      await antes.db.execute(sql`INSERT INTO partidas (variante, modo, ranqueada, placar_0, placar_1, vencedora, terminada_em) VALUES ('mineiro', 'ranqueada', true, 12, 4, 0, now())`);
      await antes.fechar();

      const depois = await abrirBanco({ pastaPglite: dados });
      try {
        const us = await depois.db.select().from(usuarios).orderBy(usuarios.id);
        expect(us.map((u) => [u.email, u.emailCanonico])).toEqual([
          ['ana+velha@x.com', 'ana@x.com'],
          ['bia@x.com', 'bia@x.com'],
        ]);
        const [p] = await depois.db.select().from(partidas);
        expect(p).toMatchObject({ placar0: 12, placar1: 4, vencedora: 0, eloCongelado: false });
        expect(await depois.db.select().from(auditoria)).toEqual([]);
      } finally {
        await depois.fechar();
      }
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  }, 60_000);
});

