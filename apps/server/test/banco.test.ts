import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { abrirBanco } from '../src/banco/banco';
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
