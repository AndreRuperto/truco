# Backup e restauração do banco (Postgres no Railway)

F5.5 do plano MVP ([`docs/plans/2026-11-12-plano-mvp.md`](../plans/2026-11-12-plano-mvp.md)). Escrito em 2026-11-13 a partir da documentação do Railway (links abaixo). **O teste real de restauração ainda não foi feito**: ele mexe em produção e é ponto de PARAR do plano (fazer junto com o André ou com o "pode" dele).

O que está no banco: contas, sessões e links mágicos, partidas e participações, ratings, carteiras e extrato de Fichas/Pila, inventário, pedidos de Pila e a trilha de auditoria. Perder isso apaga o ranking e o dinheiro de mentira de todo mundo.

## 1. O que o Railway oferece

Confirmar no painel quais estão disponíveis no plano do projeto (a documentação não diz por plano).

| Mecanismo | Como funciona | Retenção | Restauração |
|---|---|---|---|
| **Backups do volume** ([docs](https://docs.railway.com/volumes/backups)) | Cópia do volume do Postgres, manual ou agendada (diária, semanal, mensal) | diária 6 dias; semanal 27 dias; mensal 89 dias | Cria um **volume novo** e deixa o anterior no projeto, desmontado. Apagar ("wipe") o volume apaga todos os backups dele |
| **Point-in-Time Recovery** ([docs](https://docs.railway.com/volumes/point-in-time-recovery)) | Arquiva cada segmento WAL num bucket do Railway (pgBackRest), com backup completo semanal e diferencial diário | cerca de 4 semanas (os últimos 4 completos) | Restaura para um **instante escolhido**, como um **serviço novo** |
| **`pg_dump` manual** | Arquivo `.sql`/`.dump` no seu computador | o que você guardar | `pg_restore`/`psql` num banco novo |

## 2. Recomendação (fazer uma vez, no painel)

1. Postgres → aba **Backups** → ligar o agendamento **diário e semanal**.
2. Se o plano tiver, ligar o **Point-in-Time Recovery** (o que mais protege: volta a qualquer minuto das últimas ~4 semanas).
3. Antes de cada deploy com migração (como a 0007, que preenche dados), um **backup manual** do volume.

## 3. Backup manual com `pg_dump`

Precisa do Postgres client 16+ no computador e da URL **pública** do banco (Postgres → **Variables** → `DATABASE_PUBLIC_URL`). Não cole a URL em chat, issue ou commit.

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_PUBLIC_URL" --file truco-$(date +%F).dump
```

Guarde o arquivo fora do repositório (ele tem e-mails). Para conferir que o arquivo abre:

```bash
pg_restore --list truco-AAAA-MM-DD.dump | head
```

## 4. Restaurar (procedimento)

Sempre num **banco novo**, nunca por cima do de produção:

1. Criar o destino:
   - pelo backup do volume ou pelo PITR: usar **Restore** no painel (o Railway cria o volume/serviço novo);
   - por `pg_dump`: criar um Postgres novo no projeto e rodar
     `pg_restore --no-owner --no-acl --dbname "$URL_DO_BANCO_NOVO" truco-AAAA-MM-DD.dump`.
2. **Conferir** no banco novo (com `psql "$URL_DO_BANCO_NOVO"`), comparando com o de produção:
   ```sql
   select count(*) from usuarios;
   select count(*) from partidas;
   select count(*) from lancamentos;
   select max(terminada_em) from partidas;
   ```
3. Trocar: no serviço `truco`, **Variables** → `DATABASE_URL` → referência ao banco novo
   (`${{NomeDoPostgresNovo.DATABASE_URL}}`) → o Railway faz o redeploy. O boot aplica as migrações
   pendentes, se houver.
4. Conferir `/saude` (`"banco":{"ok":true}`), entrar com uma conta e abrir o histórico.
5. Só depois de alguns dias sem problema, remover o banco antigo.

## 5. Teste de restauração (PARAR: precisa do André)

Roteiro para fazer junto, sem tocar no banco de produção:

- [ ] Fazer um backup manual (seção 2 ou 3).
- [ ] Restaurar num banco **temporário** (seção 4, passo 1).
- [ ] Conferir as contagens contra produção (seção 4, passo 2) e anotar aqui com a data.
- [ ] **Não** trocar o `DATABASE_URL`.
- [ ] Apagar o banco temporário.

| Data | Mecanismo | usuários (prod / restaurado) | partidas (prod / restaurado) | Resultado |
|---|---|---|---|---|
| — | — | — | — | NAO_EXECUTADO |

## 6. Retenção dentro do próprio app

Sessões e links mágicos vencidos são apagados de hora em hora (`apps/server/src/limpeza.ts`). Partidas, extrato e auditoria ficam.
