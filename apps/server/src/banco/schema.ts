import { sql } from 'drizzle-orm';
import type { PreferenciasMesa } from '../api/tipos';
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, serial, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { Slot } from '../loja/catalogo';
import { MOEDAS, MOTIVOS } from '../loja/regras';

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
    /** Ver `UsuarioApi.avatar`. */
    avatar: text('avatar'),
    preferencias: jsonb('preferencias').$type<PreferenciasMesa>(),
    /** Itens da loja em uso, por slot (ver `loja/catalogo.ts`); o avatar fica em `avatar`. */
    equipados: jsonb('equipados').$type<Partial<Record<Exclude<Slot, 'avatar'>, string>>>(),
    /** Conta suspensa por um admin: sessões não valem e o login é recusado. null = normal. */
    banidoEm: quando('banido_em'),
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
  /** Fichas que cada humano com conta pagou (cacife efetivo); 0 = sem cacife. */
  cacife: integer('cacife').notNull().default(0),
  /** Soma dos cacifes pagos. */
  pote: integer('pote').notNull().default(0),
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

/** Saldos (cache da soma de `lancamentos`; só `repo/carteira.ts#movimentar` escreve). */
export const carteiras = pgTable(
  'carteiras',
  {
    usuarioId: integer('usuario_id')
      .primaryKey()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    fichas: integer('fichas').notNull().default(0),
    pila: integer('pila').notNull().default(0),
    bonusCadastro: boolean('bonus_cadastro').notNull().default(false),
    /** Dia (AAAA-MM-DD, São Paulo) do último bônus diário. */
    ultimoDiario: text('ultimo_diario'),
  },
  (t) => [check('carteiras_fichas_positivas', sql`${t.fichas} >= 0`), check('carteiras_pila_positivo', sql`${t.pila} >= 0`)],
);

/** Extrato: toda mudança de saldo, com o saldo depois dela. */
export const lancamentos = pgTable(
  'lancamentos',
  {
    id: serial('id').primaryKey(),
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    moeda: text('moeda', { enum: MOEDAS }).notNull(),
    delta: integer('delta').notNull(),
    saldoDepois: integer('saldo_depois').notNull(),
    motivo: text('motivo', { enum: MOTIVOS }).notNull(),
    /** Partida, item ou pedido que originou o lançamento. */
    ref: text('ref'),
    criadoEm: quando('criado_em').notNull().defaultNow(),
  },
  (t) => [index('lancamentos_usuario_idx').on(t.usuarioId, t.criadoEm)],
);

export const inventario = pgTable(
  'inventario',
  {
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    adquiridoEm: quando('adquirido_em').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.itemId] })],
);

export const STATUS_PEDIDO = ['criado', 'pago', 'estornado'] as const;

/** Compra de Pila. `id` é o `order_nsu` mandado à InfinitePay. */
export const pedidos = pgTable(
  'pedidos',
  {
    id: text('id').primaryKey(),
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    pacoteId: text('pacote_id').notNull(),
    valorCentavos: integer('valor_centavos').notNull(),
    pila: integer('pila').notNull(),
    status: text('status', { enum: STATUS_PEDIDO }).notNull().default('criado'),
    checkoutUrl: text('checkout_url'),
    slug: text('slug'),
    transactionNsu: text('transaction_nsu').unique(),
    captureMethod: text('capture_method'),
    pagoEm: quando('pago_em'),
    criadoEm: quando('criado_em').notNull().defaultNow(),
  },
  (t) => [index('pedidos_usuario_idx').on(t.usuarioId, t.criadoEm)],
);
