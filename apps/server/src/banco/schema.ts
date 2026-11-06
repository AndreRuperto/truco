import { sql } from 'drizzle-orm';
import type { PreferenciasMesa } from '../api/tipos';
import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const VARIANTES = ['paulista', 'mineiro'] as const;
export const MODOS = ['classica', 'desafio', 'privada', 'ranqueada'] as const;
export const FORMATOS = ['1x1', '2x2'] as const;

const quando = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

export const usuarios = pgTable(
  'usuarios',
  {
    id: serial('id').primaryKey(),
    apelido: text('apelido').notNull().unique(),
    /** Sempre minúsculo (`normalizarEmail`). */
    email: text('email').unique(),
    googleSub: text('google_sub').unique(),
    /** Regras da mesa que o usuário deixou na tela inicial (ver `PreferenciasMesa`); null = nunca salvou. */
    preferencias: jsonb('preferencias').$type<PreferenciasMesa>(),
    criadoEm: quando('criado_em').notNull().defaultNow(),
  },
  // "Ana" e "ana" são o mesmo apelido.
  (t) => [uniqueIndex('usuarios_apelido_lower_idx').on(sql`lower(${t.apelido})`)],
);

export const sessoes = pgTable(
  'sessoes',
  {
    tokenHash: text('token_hash').primaryKey(),
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    expiraEm: quando('expira_em').notNull(),
    criadaEm: quando('criada_em').notNull().defaultNow(),
  },
  (t) => [index('sessoes_usuario_idx').on(t.usuarioId)],
);

export const linksMagicos = pgTable('links_magicos', {
  tokenHash: text('token_hash').primaryKey(),
  email: text('email').notNull(),
  expiraEm: quando('expira_em').notNull(),
  usado: boolean('usado').notNull().default(false),
  criadoEm: quando('criado_em').notNull().defaultNow(),
});

/** `elo` (oculto, pareamento) e `pontos` (patente, nunca < 0) — ver "Decisões de design" do Plano 4. */
export const ratings = pgTable(
  'ratings',
  {
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    variante: text('variante', { enum: VARIANTES }).notNull(),
    elo: integer('elo').notNull().default(1000),
    pontos: integer('pontos').notNull().default(0),
    partidas: integer('partidas').notNull().default(0),
    atualizadoEm: quando('atualizado_em').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.variante] }), index('ratings_ranking_idx').on(t.variante, t.pontos)],
);

export const partidas = pgTable('partidas', {
  id: serial('id').primaryKey(),
  variante: text('variante', { enum: VARIANTES }).notNull(),
  modo: text('modo', { enum: MODOS }).notNull(),
  /** Só nas ranqueadas. */
  formato: text('formato', { enum: FORMATOS }),
  ranqueada: boolean('ranqueada').notNull().default(false),
  placar0: smallint('placar_0').notNull().default(0),
  placar1: smallint('placar_1').notNull().default(0),
  /** Dupla vencedora (0 | 1); nula até terminar. */
  vencedora: smallint('vencedora'),
  iniciadaEm: quando('iniciada_em').notNull().defaultNow(),
  terminadaEm: quando('terminada_em'),
  /** Terminou só com bots (todos os humanos saíram): não conta. */
  abandonada: boolean('abandonada').notNull().default(false),
});

export const participacoes = pgTable(
  'participacoes',
  {
    id: serial('id').primaryKey(),
    partidaId: integer('partida_id')
      .notNull()
      .references(() => partidas.id, { onDelete: 'cascade' }),
    /** Nulo para convidado e bot. */
    usuarioId: integer('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    nome: text('nome').notNull(),
    humano: boolean('humano').notNull(),
    cadeira: smallint('cadeira').notNull(),
    dupla: smallint('dupla').notNull(),
    eloAntes: integer('elo_antes'),
    eloDepois: integer('elo_depois'),
    venceu: boolean('venceu'),
    abandonou: boolean('abandonou').notNull().default(false),
    trucosPedidos: integer('trucos_pedidos').notNull().default(0),
    respostasTruco: integer('respostas_truco').notNull().default(0),
    trucosAceitos: integer('trucos_aceitos').notNull().default(0),
    corridas: integer('corridas').notNull().default(0),
  },
  (t) => [
    index('participacoes_usuario_idx').on(t.usuarioId),
    uniqueIndex('participacoes_partida_cadeira_idx').on(t.partidaId, t.cadeira),
  ],
);

export const bloqueiosFila = pgTable('bloqueios_fila', {
  usuarioId: integer('usuario_id')
    .primaryKey()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  ate: quando('ate').notNull(),
  motivo: text('motivo').notNull(),
});
