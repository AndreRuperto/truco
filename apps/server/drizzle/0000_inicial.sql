CREATE TABLE "bloqueios_fila" (
	"usuario_id" integer PRIMARY KEY NOT NULL,
	"ate" timestamp with time zone NOT NULL,
	"motivo" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links_magicos" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"partida_id" integer NOT NULL,
	"usuario_id" integer,
	"nome" text NOT NULL,
	"humano" boolean NOT NULL,
	"cadeira" smallint NOT NULL,
	"dupla" smallint NOT NULL,
	"elo_antes" integer,
	"elo_depois" integer,
	"venceu" boolean,
	"abandonou" boolean DEFAULT false NOT NULL,
	"trucos_pedidos" integer DEFAULT 0 NOT NULL,
	"respostas_truco" integer DEFAULT 0 NOT NULL,
	"trucos_aceitos" integer DEFAULT 0 NOT NULL,
	"corridas" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partidas" (
	"id" serial PRIMARY KEY NOT NULL,
	"variante" text NOT NULL,
	"modo" text NOT NULL,
	"formato" text,
	"ranqueada" boolean DEFAULT false NOT NULL,
	"placar_0" smallint DEFAULT 0 NOT NULL,
	"placar_1" smallint DEFAULT 0 NOT NULL,
	"vencedora" smallint,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"terminada_em" timestamp with time zone,
	"abandonada" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"usuario_id" integer NOT NULL,
	"variante" text NOT NULL,
	"elo" integer DEFAULT 1000 NOT NULL,
	"pontos" integer DEFAULT 0 NOT NULL,
	"partidas" integer DEFAULT 0 NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_usuario_id_variante_pk" PRIMARY KEY("usuario_id","variante")
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"apelido" text NOT NULL,
	"email" text,
	"google_sub" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_apelido_unique" UNIQUE("apelido"),
	CONSTRAINT "usuarios_email_unique" UNIQUE("email"),
	CONSTRAINT "usuarios_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
ALTER TABLE "bloqueios_fila" ADD CONSTRAINT "bloqueios_fila_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacoes" ADD CONSTRAINT "participacoes_partida_id_partidas_id_fk" FOREIGN KEY ("partida_id") REFERENCES "public"."partidas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacoes" ADD CONSTRAINT "participacoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participacoes_usuario_idx" ON "participacoes" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participacoes_partida_cadeira_idx" ON "participacoes" USING btree ("partida_id","cadeira");--> statement-breakpoint
CREATE INDEX "ratings_ranking_idx" ON "ratings" USING btree ("variante","pontos");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");