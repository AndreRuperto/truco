ALTER TABLE "usuarios" ADD COLUMN "email_canonico" text;--> statement-breakpoint
CREATE INDEX "usuarios_email_canonico_idx" ON "usuarios" USING btree ("email_canonico");--> statement-breakpoint
-- Preenche as contas que já existem: minúsculas e sem o "+tag" da parte local (igual a emailCanonico()).
UPDATE "usuarios" SET "email_canonico" = lower(regexp_replace(split_part("email", '@', 1), '\+.*$', '')) || '@' || lower(split_part("email", '@', 2)) WHERE "email" IS NOT NULL;
