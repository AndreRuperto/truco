# Deploy no Railway

O serviço único (`server`) roda o Colyseus, a API HTTP e entrega o build do web na mesma origem.
O banco é o Postgres gerenciado do Railway. As migrações rodam sozinhas no boot.

Arquivos envolvidos: `Dockerfile` (build multi-stage), `.dockerignore` e `railway.json`
(build pelo Dockerfile, health check em `/saude`, 1 réplica, reinício em caso de falha).

## 0. Antes de começar

- Conta no [GitHub](https://github.com) e no [Railway](https://railway.com) (entre no Railway com o GitHub).
- Opcional: conta no [Resend](https://resend.com) (e-mail do link mágico) e um projeto no
  [Google Cloud](https://console.cloud.google.com) (login com Google).
- Teste local do build de produção (Git Bash):

  ```bash
  pnpm build
  NODE_ENV=production TRUCO_PGLITE=memoria PORT=2580 TRUCO_URL_PUBLICA=http://localhost:2580 pnpm start
  # em outro terminal:
  TRUCO_URL_FUMACA=http://127.0.0.1:2580 pnpm --filter @truco/server fumaca   # → "fumaça: tudo certo"
  ```

- Teste da imagem Docker (opcional, com o Docker Desktop aberto):

  ```bash
  docker build -t truco:local .
  docker run --rm -d --name truco-local -p 2581:8080 -e PORT=8080 -e TRUCO_PGLITE=memoria \
    -e TRUCO_URL_PUBLICA=http://localhost:2581 truco:local
  TRUCO_URL_FUMACA=http://127.0.0.1:2581 pnpm --filter @truco/server fumaca
  docker stop truco-local
  ```

## 1. Subir o código para o GitHub

O repositório ainda não tem remoto. Uma vez só:

1. GitHub → **New repository** → nome (ex. `truco`), **Private**, sem README/.gitignore/licença.
2. Na pasta do projeto:

   ```bash
   git remote add origin https://github.com/SEU-USUARIO/truco.git
   git push -u origin master   # ou main, conforme o nome do seu branch (git branch --show-current)
   ```

Depois disso, cada `git push` no branch configurado dispara um novo deploy no Railway.

## 2. Criar o projeto no Railway

1. Railway → **New Project** → **Deploy from GitHub repo** → autorize o acesso ao repositório → escolha-o.
2. O Railway lê o `railway.json`: build pelo `Dockerfile`, health check em `/saude`, 1 réplica.
   Não precisa configurar comando de build/start nem porta.
3. O primeiro deploy **vai falhar** até existir uma URL pública (passo 5): em produção o servidor
   se recusa a subir sem `TRUCO_URL_PUBLICA` ou `RAILWAY_PUBLIC_DOMAIN`. É esperado.

## 3. Adicionar o Postgres

1. No projeto: **+ New** → **Database** → **Add PostgreSQL**.
2. No serviço do app → **Variables** → **New Variable** → `DATABASE_URL` com o valor
   `${{Postgres.DATABASE_URL}}` (referência; o Railway resolve). É a URL da rede interna, sem SSL.

Sem `DATABASE_URL` o servidor usa PGlite em disco dentro do container — os dados somem a cada deploy
(o log avisa). Não use assim em produção.

## 4. Variáveis do serviço

| Variável | Obrigatória? | Valor |
|---|---|---|
| `DATABASE_URL` | sim | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | já vem | `production` (o Dockerfile define; pode repetir aqui sem problema) |
| `TRUCO_URL_PUBLICA` | com domínio próprio | `https://truco.seu-dominio.com` (sem barra no fim). Sem ela, usa `https://$RAILWAY_PUBLIC_DOMAIN`. Uma das duas precisa existir, senão o boot falha. |
| `RESEND_API_KEY` | para e-mail real | chave do Resend (passo 7). Sem ela, o link mágico só aparece nos logs. |
| `TRUCO_EMAIL_REMETENTE` | com Resend | ex. `Truco <entrar@seu-dominio.com>` (padrão: `Truco <onboarding@resend.dev>`) |
| `GOOGLE_CLIENT_ID` | para login Google | client ID (passo 6). Sem ela, o botão do Google não aparece. |
| `TRUCO_ORIGENS` | raro | outras origens aceitas no CORS, separadas por vírgula |
| `TRUCO_K_ELO` | não | K do Elo (inteiro de 1 a 100; padrão 32) |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | recomendada | `15` — tempo de desligamento gracioso (ver abaixo) |

**Desligamento gracioso.** A cada redeploy o Railway manda `SIGTERM` ao deployment antigo e, passado o
tempo de *draining*, o mata com `SIGKILL`. Segundo a documentação do Railway
([Deployment Teardown](https://docs.railway.com/deployments/deployment-teardown) e
[Troubleshooting slow deployments](https://docs.railway.com/guides/troubleshooting-slow-deployments),
consultadas em 2026-11-05), esse tempo vem como **0 segundos** por padrão e é ajustável pela variável
de serviço `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (ou em **Settings** do serviço). Com 0 s o processo
pode morrer antes de fechar as partidas em andamento; com `15` o servidor tem tempo de fechá-las como
abandonadas (sem Elo nem bloqueio), terminar as gravações e fechar o banco. Se mesmo assim o processo
morrer no meio (crash, `SIGKILL`), o próximo boot fecha as partidas que ficaram sem fim do mesmo jeito.

**Não** defina `PORT` (o Railway injeta). **Não** defina `TRUCO_PGLITE`, `TRUCO_TEMPOS` nem
`TRUCO_EMAIL_TESTE` em produção (são de teste; a última é ignorada em produção).

## 5. Domínio

- Serviço → **Settings** → **Networking** → **Generate Domain**: gera `algo.up.railway.app`.
  A variável `RAILWAY_PUBLIC_DOMAIN` passa a existir e os links mágicos usam esse domínio.
  Se o Railway perguntar a porta, informe a que aparece no log (`servidor ouvindo na porta ...`).
- Domínio próprio: **Custom Domain** → crie no seu DNS o `CNAME` que o Railway mostrar → espere o
  certificado → defina `TRUCO_URL_PUBLICA=https://seu.dominio`.
- Depois de mudar variáveis, o Railway pede **Deploy** (ou redeploy) para aplicá-las.

## 6. Login com Google (opcional)

O web usa o Google Identity Services: o botão devolve um ID token para a própria página, que o manda
para `POST /api/auth/google`. Não há redirect.

1. Google Cloud Console → **APIs & Services** → **OAuth consent screen**: tipo *External*, nome do app,
   e-mail de suporte; escopos `openid`, `email`, `profile`. Publique (ou adicione testadores).
2. **Credentials** → **Create credentials** → **OAuth client ID** → *Web application*.
3. **Authorized JavaScript origins**: `https://seu.dominio` e/ou `https://algo.up.railway.app`
   (exatamente a URL pública, sem barra no fim); para desenvolver localmente, também
   `http://localhost` e `http://localhost:5173`.
4. **Authorized redirect URIs**: deixe vazio (não é usado).
5. Copie o **Client ID** para `GOOGLE_CLIENT_ID` no Railway (e, se quiser em dev, exporte a mesma
   variável antes de `pnpm dev:server`).

## 7. E-mail com Resend (opcional, recomendado)

1. Resend → **Domains** → **Add Domain** → crie os registros DNS (SPF/DKIM) e espere verificar.
   Sem domínio verificado, o remetente `onboarding@resend.dev` só entrega para o e-mail da sua conta
   Resend (serve para testar).
2. **API Keys** → **Create API Key** (permissão *Sending access*) → `RESEND_API_KEY`.
3. `TRUCO_EMAIL_REMETENTE` com um endereço do domínio verificado.

### Sem Resend: pegar o link mágico no log

Sem `RESEND_API_KEY` o servidor não manda e-mail; escreve a mensagem no log. Peça o link na tela
**Entrar** e depois: serviço → **Deployments** → deployment ativo → **View Logs** (ou **Observability**
→ **Logs**) e procure por `[e-mail para seu@email]` — o link vem na linha seguinte. Com a
[CLI do Railway](https://docs.railway.com/guides/cli): `railway logs`.

## 8. Conferir o deploy

- **Deployments** → logs: `truco: servidor ouvindo na porta ... (banco: postgres; web: build servido)`.
  Avisos `truco: aviso: ...` dizem o que falta configurar.
- `https://seu.dominio/saude` → `{"ok":true}`.
- Do seu computador: `TRUCO_URL_FUMACA=https://seu.dominio pnpm --filter @truco/server fumaca`
  → `fumaça: tudo certo`.
- Entre com o link mágico, jogue uma partida e veja o histórico.

## 9. Dia a dia

- **Deploy:** `git push` no branch ligado ao Railway.
- **Migrações:** mudou `apps/server/src/banco/schema.ts` → `pnpm --filter @truco/server db:gerar --name <o-que-mudou>`
  → commit da pasta `apps/server/drizzle` → push. O boot aplica as pendentes. Não edite migrações já publicadas.
- **Backups:** ative no Postgres do Railway (aba **Backups**).
- **Escala:** mantenha 1 réplica (salas, fila e matchmaking ficam na memória do processo). Para mais,
  seria preciso Redis (presence/driver do Colyseus) — não implementado.
- **Problemas comuns:** deploy cai logo no boot → falta URL pública (passo 5); health check falhando →
  veja se o `DATABASE_URL` resolve (logs de migração); link mágico com domínio errado →
  `TRUCO_URL_PUBLICA`; botão do Google some → `GOOGLE_CLIENT_ID` ausente ou origem não autorizada no
  Google Cloud (o console do navegador mostra o erro do GIS).

## Rodar localmente

Requisitos: Node 24+ e pnpm 9.12.0 (`npm install -g pnpm@9.12.0`). Nada de segredo é necessário.

```bash
pnpm install
pnpm dev:server   # servidor em http://localhost:2567 (PGlite em ~/.truco/pglite; link mágico no console)
pnpm dev:web      # web em http://localhost:5173 (proxy de /api e /saude para o servidor)
```

- Banco em memória (zera a cada reinício): `TRUCO_PGLITE=memoria pnpm dev:server`.
- Postgres local: `DATABASE_URL=postgres://... pnpm dev:server`.
- Testes: `pnpm test` (engine, server e web), `pnpm typecheck`.
- E2E (Playwright; sobe server na 2570 e web na 5180 sozinho): `pnpm test:e2e`.
  Na primeira vez: `pnpm --filter @truco/web exec playwright install chromium`.
