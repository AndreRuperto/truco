CREATE TABLE "carteiras" (
	"usuario_id" integer PRIMARY KEY NOT NULL,
	"fichas" integer DEFAULT 0 NOT NULL,
	"pila" integer DEFAULT 0 NOT NULL,
	"bonus_cadastro" boolean DEFAULT false NOT NULL,
	"ultimo_diario" text,
	CONSTRAINT "carteiras_fichas_positivas" CHECK ("carteiras"."fichas" >= 0),
	CONSTRAINT "carteiras_pila_positivo" CHECK ("carteiras"."pila" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventario" (
	"usuario_id" integer NOT NULL,
	"item_id" text NOT NULL,
	"adquirido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventario_usuario_id_item_id_pk" PRIMARY KEY("usuario_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"moeda" text NOT NULL,
	"delta" integer NOT NULL,
	"saldo_depois" integer NOT NULL,
	"motivo" text NOT NULL,
	"ref" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"pacote_id" text NOT NULL,
	"valor_centavos" integer NOT NULL,
	"pila" integer NOT NULL,
	"status" text DEFAULT 'criado' NOT NULL,
	"checkout_url" text,
	"slug" text,
	"transaction_nsu" text,
	"capture_method" text,
	"pago_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_transaction_nsu_unique" UNIQUE("transaction_nsu")
);
--> statement-breakpoint
ALTER TABLE "partidas" ADD COLUMN "cacife" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partidas" ADD COLUMN "pote" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "equipados" jsonb;--> statement-breakpoint
ALTER TABLE "carteiras" ADD CONSTRAINT "carteiras_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamentos_usuario_idx" ON "lancamentos" USING btree ("usuario_id","criado_em");--> statement-breakpoint
CREATE INDEX "pedidos_usuario_idx" ON "pedidos" USING btree ("usuario_id","criado_em");