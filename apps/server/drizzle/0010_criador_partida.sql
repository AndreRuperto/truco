ALTER TABLE "partidas" ADD COLUMN "criador_id" integer;--> statement-breakpoint
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_criador_id_usuarios_id_fk" FOREIGN KEY ("criador_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partidas_criador_idx" ON "partidas" USING btree ("criador_id");