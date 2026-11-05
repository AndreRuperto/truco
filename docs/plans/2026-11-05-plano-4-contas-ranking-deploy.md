# Plano 4 — Contas, ranking Elo, matchmaking ranqueado, mesas privadas e deploy no Railway

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar o jogo jogável (Planos 1–3) em produto: contas (convidado, link mágico por e-mail, Google), Postgres com Drizzle (PGlite em testes/dev), registro de partidas e estatísticas, Elo por variante com patentes, abandono com penalidade e bloqueio de fila, fila ranqueada 1x1/2x2 (com dupla por código), lista de mesas abertas, mesa privada por link com chat, telas web de login/perfil/histórico/ranking/fila/salas, e deploy no Railway (o server serve o build do web, migrações no boot, `/saude`), com E2E de login + fila ranqueada.

**Architecture:** Tudo continua num único processo Node (`apps/server`): Colyseus 0.18 (salas `mesa` e `fila`) + rotas HTTP Express no **mesmo** servidor (opção `express` do `defineServer`, conferida em `node_modules/@colyseus/core/src/Server.ts` e `router/index.ts`: o roteador do Colyseus atende `/matchmake/*` e `/__healthcheck`; o resto cai no Express). Camadas novas no server: (1) `src/banco/` — schema Drizzle + `abrirBanco()` (node-postgres com `DATABASE_URL`, senão PGlite em disco ou memória) com `migrate()` no boot; (2) `src/ranking/` e `src/fila/fila.ts` — funções puras (Elo, patentes, deltas de fim/abandono, contadores de truco, pareamento por faixa de Elo com relógio injetado), TDD; (3) `src/repo/` — consultas Drizzle testadas contra PGlite em memória; (4) `src/auth/` + `src/http/app.ts` — tokens opacos (só o hash vai ao banco), cookie httpOnly, limite de taxa, e-mail (Resend HTTP / console / caixa de teste), verificação do ID token do Google; (5) `src/registroMesa.ts` — ponte pura-ish entre `MesaRoom` e o repositório (serializa gravações); (6) `FilaRoom` + `MesaRoom` estendidos (autenticação no `static onAuth`, reserva de assentos com `matchMaker.reserveSeatFor`). No web: roteamento por hash sem bibliotecas, cliente HTTP `api.ts`, lojas `sessao` e `fila` (mesmo padrão `useSyncExternalStore` da loja do Plano 3), telas novas e componentes burros testados com Testing Library.

**Tech Stack (versões conferidas com `pnpm view` em 2026-11-05 e fixadas exatas, todas publicadas há ≥ 3 semanas):** `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11, `@electric-sql/pglite` 0.5.10, `pg` 8.23.1 + `@types/pg` 8.23.1, `express` 5.3.0 + `@types/express` 5.0.6 (o 5.3.0 já está hoisted em `node_modules` como peer do `@colyseus/ws-transport`), `google-auth-library` 11.3.1. Resend sem SDK (um `fetch` para `POST https://api.resend.com/emails`). Front: nada novo (Google Identity Services é carregado por `<script>` só quando configurado). Deploy: Dockerfile multi-stage (`node:26-slim`) + `railway.json`.

**Pré-requisitos:** Planos 1–3 concluídos e verdes; HEAD contém pelo menos `7243dec` (chaveRegras no matchmaking, `regras`/`chanceInterceptarSinal` no `MsgEstado`, `quemDeveAgir` no engine). Design: `docs/plans/2026-11-05-truco-design.md` (seções 2 e 4).

---

## Restrições (valem para todas as tarefas)

- Comandos rodam na raiz `D:\01 Projetos\Projetos\truco` (PowerShell ou Git Bash). **Windows, Node 26**, pnpm 9.12.
- Git: **não** altere config. Use sempre `git -c "safe.directory=D:/01 Projetos/Projetos/truco" ...`. Commits terminam com linha em branco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (nos exemplos, o segundo `-m` faz isso).
- O drive D: é **exFAT, sem symlinks**: o `.npmrc` com `node-linker=hoisted` **fica**. Pacotes locais **nunca** via `workspace:*`; sempre alias (Vite/Vitest `resolve.alias` + `tsconfig` `paths`), como já é feito com `@truco/engine` e `@truco/protocolo`. Este plano cria mais um alias no web: `@truco/api` → `apps/server/src/api/tipos.ts` (só tipos).
- **Não há Postgres local.** Docker existe, mas nada depende dele (só o teste opcional da Tarefa 23). Testes e dev sem `DATABASE_URL` usam **PGlite** (Postgres 17 em WASM, ~2 s para subir + migrar).
- Vitest do **server**: pool `'threads'` (o `'forks'` briga com o IPC do Colyseus). Testes de integração Colyseus ficam **todos** em `apps/server/test/integracao.test.ts` (porta fixa 2568). Testes HTTP sobem um Express em porta efêmera (`listen(0)`), então podem ficar em arquivos próprios.
- Vitest do **web**: pool `'forks'` com `--no-experimental-webstorage` (já configurado; não mexer).
- **Nada exige segredo para testes ou dev local.** Sem `RESEND_API_KEY` o link mágico é impresso no console; sem `GOOGLE_CLIENT_ID` o botão do Google some; sem `DATABASE_URL` usa PGlite.
- Arquivos com LF (`.gitattributes` força `eol=lf`).
- Filtrar testes: `pnpm --filter <pacote> test <trecho-do-nome-do-arquivo>`.
- Instalar dependências **sempre com versão exata**: `pnpm --filter <pacote> add --save-exact pkg@x.y.z`.
- O repositório pode ter recebido commits de revisão depois deste plano. Em cada `Modify`, **leia o arquivo atual primeiro** e aplique a mudança descrita sobre ele (os trechos mostram o resultado esperado; preserve o que mudou depois e não conflita). Nunca invente nomes do código existente: os usados aqui foram conferidos (`Mesa`, `OpcoesMesa`, `sentar`, `iniciar`, `sair`, `cadeiraDe`, `partida`, `iniciada`, `aplicar`, `enviarEstado`, `opcoesDaSala`, `chaveRegras`, `limparNome`, `MsgEstado`, `criarLoja`, `SalaLike`, `TIPOS_MENSAGEM`, `entrarNaMesa`, `tentarReconectar`, `ClienteLike`, `urlServidor`, `opcoesDeEntrada`, `formPadrao`, `lerApelido`, `souDono`, `resumoRegras`, `useLoja`, `useAgora`, `criarMesa`/`avancarAte`/`TEMPOS` em `test/mesa-helpers.ts`, `SalaFalsa`, `msgEstado` em `test/fixtures.ts`).

## APIs reais conferidas (não adivinhe outras)

- **Colyseus 0.18.26** (`node_modules/@colyseus/core/src`):
  - `defineServer({ transport, rooms, express?: (app) => void })` — com `express`, o `ws-transport` cria o app (`getExpressApp()`) e o Colyseus faz: rota do próprio roteador (`/matchmake/...`, `/__healthcheck`) primeiro, senão `expressApp.handle(req,res)`. Se o Express **não** tiver rota que case `/`, o Colyseus registra `GET /` respondendo `Colyseus 0.18.26` — por isso o fallback SPA usa `app.get('/{*caminho}')` (casa `/` também).
  - CORS: um listener prefixado em **todas** as requisições HTTP aplica `controller.DEFAULT_CORS_HEADERS` (`Allow-Origin: *`, `Allow-Credentials: true`) + `matchMaker.controller.getCorsHeaders(headers)` (padrão: reflete o `Origin`). Este plano troca `getCorsHeaders` (Tarefa 10).
  - `static async onAuth(token, options, context: AuthContext)` roda no **pedido HTTP** de matchmaking (`joinOrCreate`/`create`/`join`/`joinById`), **antes** de `findOneRoomAvailable(roomName, clientOptions)`, recebendo **o mesmo objeto** `options` que depois vai para o filtro e para `createRoom`. `context.headers` (Headers, inclui `cookie`), `context.token` (Bearer do `Authorization`, que o SDK manda quando `client.auth.token` está definido), `context.ip`. Retorno: `false/null/undefined` → `AUTH_FAILED`; `true` → sem payload; objeto → vira `client.auth`. Joins iniciados pelo servidor (`matchMaker.createRoom` + `reserveSeatFor`) **não** chamam `onAuth`; o `authData` passado a `reserveSeatFor(room, options, authData)` vira `client.auth`, e com `static onAuth` sobrescrito o `onAuth` de instância é pulado.
  - `matchMaker.createRoom(nome, opcoes) → IRoomCache`, `matchMaker.reserveSeatFor(room, opcoes, authData) → ISeatReservation` (`{ name, sessionId, roomId, processId, ... }`, serializável), `matchMaker.query({ name, locked, private })`, `matchMaker.controller`. `ServerError(code, mensagem)` e `ErrorCode.AUTH_FAILED` (525) exportados de `@colyseus/core`. Na sala: `setMetadata`, `setPrivate(true)`, `lock()`, `disconnect(closeCode)`, `clock.setTimeout/setInterval`, `clients.getById(sessionId)`, `client.leave(code)`.
  - `filterBy` compara campos de `metadata` da sala com as **opções cruas** de quem procura; campo omitido não filtra (pendência da Tarefa 1).
- **@colyseus/sdk 0.18.9**: `client.auth.token = x` (só neste `Client`; vai como `Authorization: Bearer` no matchmaking e `_authToken` no WS), `client.create`, `client.joinById`, `client.consumeSeatReservation(reserva)`. O HTTP do SDK usa `credentials: 'include'` (cookies vão junto no matchmaking, inclusive em dev cross-port).
- **Drizzle 0.45.4 + PGlite 0.5.10** (testado em pasta temporária): `drizzle({ client: new PGlite(), schema })` de `drizzle-orm/pglite`, `migrate(db, { migrationsFolder })` de `drizzle-orm/pglite/migrator`; produção `drizzle({ client: pool, schema })` de `drizzle-orm/node-postgres` + `drizzle-orm/node-postgres/migrator`. Os dois são `PgDatabase<PgQueryResultHKT, typeof schema>` (tipo comum `Banco`, conferido com `tsc`). Violação de unicidade: `DrizzleQueryError` com `e.cause.code === '23505'`. `insert().onConflictDoUpdate({ target: [..], set: { elo: sql\`${ratings.elo} + ${d}\` } })` funciona no PGlite. `drizzle-kit generate --name inicial` gera `drizzle/0000_inicial.sql` + `drizzle/meta/`.
- **google-auth-library 11.3.1**: `new OAuth2Client(clientId).verifyIdToken({ idToken, audience })` → `ticket.getPayload()` com `sub`, `email`, `email_verified`, `name`, `given_name`.
- **Resend**: `POST https://api.resend.com/emails`, `Authorization: Bearer <RESEND_API_KEY>`, JSON `{ from, to: [..], subject, text, html }`.
- **pg é CommonJS**: importe `import pg from 'pg'` e use `pg.Pool` (import nomeado `{ Pool }` falha no ESM do Node).
- **Node 26 não traz mais o corepack**: no Dockerfile instale o pnpm com `npm i -g pnpm@9.12.0`.

## Decisões de design (leia antes de começar)

1. **Elo oculto + pontos de patente visíveis.** As patentes do design (Bronze 0, Prata 300, Ouro 600, Diamante 900, Mestre 1200, Grão-Mestre 1500) começam em 0, mas Elo começar em 0 deixaria o jogador médio eternamente no Bronze e com números negativos. Solução: cada `(usuário, variante)` tem **`elo`** (começa em **1000**, Elo clássico, usado no pareamento e no cálculo do delta, K = 32 configurável por `TRUCO_K_ELO`) e **`pontos`** (começam em **0**, recebem **o mesmo delta**, mas nunca ficam abaixo de 0). A patente sai dos `pontos`. Efeito: o pareamento é justo (Elo puro); a patente sobe com a atividade de quem joga bem ou se recupera de sequências ruins, e ninguém vê número negativo. O perfil mostra os dois.
2. **Duplas:** delta = `round(K × (S − E))` com E calculado entre a **média de Elo dos humanos** de cada dupla; o mesmo delta para os dois da dupla. Bot não entra na média nem pontua; no 1x1 cada dupla tem 1 humano.
3. **Abandono** (sair de vez de uma ranqueada já começada — saída consentida ou fim dos 60 s de reconexão): na hora, derrota contra a média dos adversários (`elo_antes`), `pontos` idem, bloqueio de fila de **5 min**. No fim da partida só pontua quem ficou até o fim. Se todos os humanos saíram (só bots terminaram), a partida é marcada `abandonada` e ninguém mais pontua (as penalidades de quem abandonou ficam).
4. **Estatísticas** gravadas por participação (só ações deliberadas de humanos, não as automáticas por tempo): `trucos_pedidos` (truco + aumentar), `respostas_truco` (aceitar + aumentar + correr), `trucos_aceitos` (aceitar + aumentar), `corridas` (correr + recusar mão de 10). "% truco aceito" = aceitos ÷ respostas. Vitórias contam todas as partidas terminadas (qualquer modo) de usuário logado.
5. **Quem grava partida:** qualquer partida com ao menos um humano logado (convidados entram com `usuario_id` nulo; partidas só de convidados não são gravadas).
6. **Sessão:** token opaco aleatório de 32 bytes no cookie `truco_sessao` (`HttpOnly; SameSite=Lax; Path=/; Max-Age=30 dias; Secure` em produção); no banco só o SHA-256. Também aceito como `Authorization: Bearer` (usado pelos testes de integração com o SDK em Node). Não precisa de segredo de assinatura. Link mágico: token igual (hash no banco), 15 min, uso único (`UPDATE ... WHERE usado = false RETURNING`). O link vai no **fragmento** (`/#/entrar?token=...`), que não chega a logs de servidor/proxy; o front faz `POST /api/auth/link/confirmar`.
7. **Novo usuário** ganha apelido derivado do e-mail/nome do Google (sufixo numérico se ocupado) e pode trocar no perfil. Google com e-mail verificado se liga à conta existente do mesmo e-mail.
8. **Dupla na fila 2x2:** os dois amigos digitam o **mesmo código** (texto livre, 4–12 letras/números) — sem convites, sem estado extra no servidor. A dupla só entra no pareamento quando os dois estão na fila.
9. **Pareamento:** faixa = 100 + 50 a cada 15 s de espera (teto 1000); dois grupos casam se a diferença de Elo ≤ a maior das duas faixas; o mais antigo escolhe o mais próximo. No 2x2, solos viram dupla (mais próximos) e duplas casam entre si. A fila roda uma vez por segundo.
10. **Mesa ranqueada** só é criada pela fila (opção `fichaInterna`, um UUID aleatório por processo que só o server conhece), é `private`, regras `REGRAS_RANQUEADA[variante]`, bots difíceis, sem "Começar com bots", cadeiras fixas (1x1: 0 e 1, cada um com bot parceiro; 2x2: dupla A em 0/2, dupla B em 1/3). Se em 30 s nem todos entraram, a sala é encerrada com o código `SAIDA_PARTIDA_CANCELADA` (4010), sem penalidade.
11. **Mesa privada:** `create('mesa', { modo: 'privada', ... })` → sala `private` (não aparece em lista nem em `joinOrCreate`); o código do convite é o `roomId` (`#/privada/<roomId>`, entra com `joinById`). Todas as opções configuráveis; chat de texto (até 200 caracteres, limpo de caracteres de controle, 1 mensagem por segundo por jogador) só nela.
12. **Modo das mesas casuais:** `classica` = bot fácil, `desafio` = bot difícil (o select "Bots" do lobby decide). `modo` entra no `filterBy` e no `MsgEstado`.
13. **Roteamento web por hash** (`#/entrar`, `#/perfil`, `#/historico`, `#/ranking/paulista`, `#/salas`, `#/privada/<codigo>`, `#/fila`) com ~60 linhas próprias: sem react-router (a app tem 8 telas, sem rotas aninhadas nem loaders; o hash funciona servido como arquivo estático sem regra de rewrite e mantém o link mágico fora do servidor). Enquanto há mesa (status ≠ `fora`), a loja manda na tela, como hoje.
14. **Dev cross-port:** o Vite faz proxy de `/api` e `/saude` para o server (mesma origem para o cookie); o WebSocket/matchmaking continua indo direto a `:2567` (cookies não dependem da porta e `localhost:5173`→`localhost:2567` é *same-site*, então `SameSite=Lax` passa). Em produção tudo é mesma origem.
15. **CORS em produção:** só reflete `Origin` igual ao próprio host (ou listados em `TRUCO_ORIGENS`); senão fica o `*` padrão, que o navegador recusa para requisições com credenciais. Em dev reflete qualquer origem. Todo `POST/PATCH` em `/api` exige `Content-Type: application/json` (força preflight; junto com `SameSite=Lax` evita CSRF).
16. **Deploy:** Dockerfile multi-stage (mais previsível que Nixpacks/Railpack para monorepo pnpm com `node-linker=hoisted` e build do web). O server roda com `tsx` (como em dev; resolve os aliases pelo `tsconfig`), `NODE_ENV=production`, serve `apps/web/dist` e aplica migrações no boot.

## Variáveis de ambiente (resumo)

| Variável | Onde | Efeito |
|---|---|---|
| `PORT` | Railway/local | porta HTTP+WS (padrão 2567) |
| `NODE_ENV=production` | Dockerfile | cookie `Secure`, CORS restrito, caixa de teste proibida |
| `DATABASE_URL` | Railway (`${{Postgres.DATABASE_URL}}`) | Postgres via `pg`; sem ela, PGlite |
| `TRUCO_PGLITE` | dev/teste | `memoria` ou caminho da pasta (padrão `apps/server/.dados/pglite`) |
| `RESEND_API_KEY`, `TRUCO_EMAIL_REMETENTE` | Railway | envio real do link; sem chave, link no console |
| `GOOGLE_CLIENT_ID` | Railway/dev | liga o login Google |
| `TRUCO_URL_PUBLICA` | Railway (opcional) | base dos links (senão `https://$RAILWAY_PUBLIC_DOMAIN`; em dev, a origem do pedido) |
| `TRUCO_ORIGENS` | opcional | origens extras aceitas no CORS em produção (separadas por vírgula) |
| `TRUCO_EMAIL_TESTE=1` | E2E | expõe `GET /api/teste/emails` (ignorado em produção) |
| `TRUCO_K_ELO` | opcional | K do Elo (1–100, padrão 32) |
| `TRUCO_TEMPOS=rapido` | E2E | já existe (Plano 3) |

---

### Task 1: Pendência — filtro explícito no matchmaking e `modo` da mesa

O `filterBy` compara com as opções **cruas** de quem procura: quem omite `variante`/`humanos`/... casa com qualquer sala. Ranqueada e privada não podem depender disso. Correção: um `static onAuth` em `MesaRoom` que, no pedido HTTP, **reescreve no próprio objeto de opções** os campos do filtro com os valores validados (o Colyseus usa esse mesmo objeto em `findOneRoomAvailable` e `createRoom` — conferido em `MatchMaker.ts`, `joinOrCreate`). Aproveita para introduzir `modo` (`classica | desafio | privada | ranqueada`) e recusar `modo: 'ranqueada'` vindo de cliente.

**Files:**
- Modify: `apps/server/src/mesa/protocolo.ts`
- Modify: `apps/server/src/MesaRoom.ts`
- Modify: `apps/server/src/servidor.ts`
- Test: `apps/server/test/protocolo.test.ts`, `apps/server/test/integracao.test.ts`

**Step 1: Testes que falham**

Em `apps/server/test/protocolo.test.ts`, importe também `filtroDaSala` e acrescente:
```ts
describe('modo da mesa', () => {
  test('sem modo: clássica com bot fácil, desafio com bot difícil', () => {
    expect(opcoesDaSala({}).modo).toBe('classica');
    expect(opcoesDaSala({ nivelBot: 'dificil' })).toMatchObject({ modo: 'desafio', nivelBot: 'dificil' });
  });

  test('o modo manda no nível do bot nas casuais; na privada vale o pedido', () => {
    expect(opcoesDaSala({ modo: 'classica', nivelBot: 'dificil' }).nivelBot).toBe('facil');
    expect(opcoesDaSala({ modo: 'desafio', nivelBot: 'facil' }).nivelBot).toBe('dificil');
    expect(opcoesDaSala({ modo: 'privada', nivelBot: 'dificil' })).toMatchObject({ modo: 'privada', nivelBot: 'dificil' });
  });

  test('ranqueada: regras fixas da variante, 2 ou 4 humanos, bot difícil, sem interceptação', () => {
    const o = opcoesDaSala({ modo: 'ranqueada', variante: 'mineiro', humanos: 3, regras: { familia: 'off' }, chanceInterceptarSinal: 0.5 });
    expect(o).toEqual({ modo: 'ranqueada', regras: REGRAS_RANQUEADA.mineiro, humanos: 2, nivelBot: 'dificil', chanceInterceptarSinal: 0 });
    expect(opcoesDaSala({ modo: 'ranqueada', humanos: 4 }).humanos).toBe(4);
  });

  test('filtroDaSala: todos os campos do filterBy, sempre preenchidos', () => {
    expect(filtroDaSala(opcoesDaSala({}))).toEqual({
      modo: 'classica',
      variante: 'paulista',
      humanos: 1,
      nivelBot: 'facil',
      chaveRegras: chaveRegras(REGRAS_RANQUEADA.paulista, 0),
    });
  });
});
```
No teste existente `'padrão: paulista ranqueado, 1 humano, bot fácil'`, acrescente `modo: 'classica'` ao objeto esperado.

Em `apps/server/test/integracao.test.ts`, dentro do `describe('MesaRoom')`:
```ts
  test('quem omite os campos do filtro procura a sala padrão, não qualquer sala', async () => {
    const a = await colyseus.sdk.joinOrCreate('mesa', { variante: 'mineiro', humanos: 2, nivelBot: 'dificil', nome: 'Ana' });
    coletor(a);
    const b = await colyseus.sdk.joinOrCreate('mesa', { nome: 'Bia' });
    const mb = coletor(b);
    expect(b.roomId).not.toBe(a.roomId);
    await esperar(() => !!mb.estado?.length);
    expect(mb.estado.at(-1).regras.variante).toBe('paulista');
    const [sala] = await matchMaker.query({ roomId: a.roomId });
    expect(sala.metadata).toMatchObject({ modo: 'desafio', variante: 'mineiro', humanos: 2, nivelBot: 'dificil' });
  });

  test('cliente não cria mesa ranqueada', async () => {
    await expect(colyseus.sdk.create('mesa', { modo: 'ranqueada', nome: 'Ana' })).rejects.toThrow(/fila/);
  });
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test protocolo`
Expected: FAIL — `filtroDaSala` não exportado / `modo` indefinido.

Run: `pnpm --filter @truco/server test integracao`
Expected: FAIL em "quem omite..." (`b.roomId` igual ao de `a`) e em "cliente não cria mesa ranqueada" (resolve em vez de rejeitar).

**Step 3: Implementação**

`apps/server/src/mesa/protocolo.ts` — acrescente `type Variante` ao import do `@truco/engine` e:
```ts
export const MODOS_MESA = ['classica', 'desafio', 'privada', 'ranqueada'] as const;
export type ModoMesa = (typeof MODOS_MESA)[number];

/** Close code (4000–4999 são da aplicação): mesa ranqueada cancelada antes de começar. */
export const SAIDA_PARTIDA_CANCELADA = 4010;
```
Em `OpcoesSala`, acrescente o campo `modo: ModoMesa;` (primeiro campo). Troque o `return` final de `opcoesDaSala` por:
```ts
  const nivelPedido = um(o.nivelBot, ['facil', 'dificil'] as const, 'facil');
  const modo = um(o.modo, MODOS_MESA, nivelPedido === 'dificil' ? 'desafio' : 'classica');
  if (modo === 'ranqueada') {
    return { modo, regras: { ...REGRAS_RANQUEADA[variante] }, humanos: h === 4 ? 4 : 2, nivelBot: 'dificil', chanceInterceptarSinal: 0 };
  }
  const nivelBot: NivelBot = modo === 'classica' ? 'facil' : modo === 'desafio' ? 'dificil' : nivelPedido;
  return { modo, regras, humanos, nivelBot, chanceInterceptarSinal };
}

/** Campos do `filterBy` da sala `mesa`, sempre preenchidos com valores validados. */
export interface FiltroSala {
  modo: ModoMesa;
  variante: Variante;
  humanos: number;
  nivelBot: NivelBot;
  chaveRegras: string;
}

export function filtroDaSala(o: OpcoesSala): FiltroSala {
  return {
    modo: o.modo,
    variante: o.regras.variante,
    humanos: o.humanos,
    nivelBot: o.nivelBot,
    chaveRegras: chaveRegras(o.regras, o.chanceInterceptarSinal),
  };
}
```
(`h` é a variável já existente com `o.humanos`.)

`apps/server/src/MesaRoom.ts`:
- imports: `import { type AuthContext, type Client, ErrorCode, Room, type RoomException, type RoomMethodName, ServerError } from '@colyseus/core';` e `import { filtroDaSala, opcoesDaSala } from './mesa/protocolo';` (o `chaveRegras` deixa de ser usado aqui).
- dentro da classe, logo depois de `static tempos`:
```ts
  /**
   * Roda no pedido HTTP de matchmaking, ANTES de o Colyseus procurar sala, e recebe o
   * MESMO objeto de opções que vai para o filtro e para `createRoom`: reescreve nele os
   * campos do `filterBy` com os valores validados. Quem omite um campo procura a sala
   * padrão, não "qualquer sala". Mesas ranqueadas só nascem pela fila (sem onAuth).
   */
  static async onAuth(_token: string, options: unknown, _context: AuthContext): Promise<unknown> {
    if (options && typeof options === 'object') {
      const o = options as Record<string, unknown>;
      if (o.modo === 'ranqueada') throw new ServerError(ErrorCode.AUTH_FAILED, 'mesa ranqueada só pela fila');
      Object.assign(o, filtroDaSala(opcoesDaSala(o)));
    }
    return true;
  }
```
- em `onCreate`, troque a desestruturação e o `setMetadata` por:
```ts
    const opcoes = opcoesDaSala(options);
    const { regras, humanos, nivelBot, chanceInterceptarSinal } = opcoes;
    this.maxClients = humanos;
    // O Colyseus 0.18 copia os campos do `filterBy` das opções cruas de criação para
    // `metadata`, e o `joinOrCreate` compara com `metadata`: trocar pelos valores
    // validados (o `setMetadata` substitui, não mescla).
    void this.setMetadata({ ...filtroDaSala(opcoes) });
```

`apps/server/src/servidor.ts` — troque o comentário e o `filterBy`:
```ts
    // Só junta quem pediu o mesmo modo, variante, quantidade de humanos, nível de bot e
    // regras (`chaveRegras`). `MesaRoom.onAuth` preenche esses campos nas opções de quem
    // procura e `MesaRoom.onCreate` na metadata da sala: ninguém fica sem filtro.
    rooms: { mesa: defineRoom(MesaRoom).filterBy(['modo', 'variante', 'humanos', 'nivelBot', 'chaveRegras']) },
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test`
Expected: PASS — todos os arquivos (os testes antigos de matchmaking continuam passando: quem mandava os campos continua caindo nas mesmas salas).

Run: `pnpm --filter @truco/server typecheck` → sem erros.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "fix(server): filtro de matchmaking sempre explícito (onAuth normaliza) e modo da mesa" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Banco — dependências, schema Drizzle, migração inicial e `abrirBanco`

**Files:**
- Modify: `apps/server/package.json` (deps + script `db:gerar`), `apps/server/tsconfig.json`, `.gitignore`
- Create: `apps/server/drizzle.config.ts`, `apps/server/src/banco/schema.ts`, `apps/server/src/banco/banco.ts`, `apps/server/test/banco-helpers.ts`
- Create (gerado): `apps/server/drizzle/0000_inicial.sql`, `apps/server/drizzle/meta/_journal.json`, `apps/server/drizzle/meta/0000_snapshot.json`
- Test: `apps/server/test/banco.test.ts`

**Step 1: Dependências**

Run:
```
pnpm --filter @truco/server add --save-exact drizzle-orm@0.45.4 @electric-sql/pglite@0.5.10 pg@8.23.1 express@5.3.0 google-auth-library@11.3.1
pnpm --filter @truco/server add -D --save-exact drizzle-kit@0.31.11 @types/pg@8.23.1 @types/express@5.0.6
```
Expected: `dependencies`/`devDependencies` atualizados em `apps/server/package.json`, `pnpm-lock.yaml` alterado, nenhum symlink criado (hoisted). Se o pnpm avisar de peer `express` do ws-transport, agora está satisfeito.

No `apps/server/package.json`, em `scripts`, acrescente `"db:gerar": "drizzle-kit generate"`.
No `apps/server/tsconfig.json`, acrescente `"drizzle.config.ts"` ao `include`.
No `.gitignore` da raiz, acrescente a linha `.dados/`.

**Step 2: Teste que falha**

`apps/server/test/banco-helpers.ts`
```ts
import { sql } from 'drizzle-orm';
import { abrirBanco, type ConexaoBanco } from '../src/banco/banco';

export type BancoDeTeste = ConexaoBanco & { limpar(): Promise<void> };

/** PGlite em memória já migrado. Um por arquivo de teste (subir leva ~2 s). */
export async function bancoDeTeste(): Promise<BancoDeTeste> {
  const c = await abrirBanco();
  return {
    ...c,
    limpar: async () => {
      await c.db.execute(
        sql`TRUNCATE usuarios, sessoes, links_magicos, ratings, partidas, participacoes, bloqueios_fila RESTART IDENTITY CASCADE`,
      );
    },
  };
}

export function ehViolacaoUnica(e: unknown): boolean {
  const x = e as { code?: string; cause?: { code?: string } } | null;
  return x?.code === '23505' || x?.cause?.code === '23505';
}
```

`apps/server/test/banco.test.ts`
```ts
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
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
```

**Step 3: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test banco`
Expected: FAIL — `Failed to load url ../src/banco/banco`.

**Step 4: Implementação**

`apps/server/src/banco/schema.ts`
```ts
import { boolean, index, integer, pgTable, primaryKey, serial, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const VARIANTES = ['paulista', 'mineiro'] as const;
export const MODOS = ['classica', 'desafio', 'privada', 'ranqueada'] as const;
export const FORMATOS = ['1x1', '2x2'] as const;

const quando = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  apelido: text('apelido').notNull().unique(),
  email: text('email').unique(),
  googleSub: text('google_sub').unique(),
  criadoEm: quando('criado_em').notNull().defaultNow(),
});

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
```

`apps/server/drizzle.config.ts`
```ts
import { defineConfig } from 'drizzle-kit';

// Só gera SQL a partir do schema (não conecta em banco nenhum).
export default defineConfig({ dialect: 'postgresql', schema: './src/banco/schema.ts', out: './drizzle' });
```

`apps/server/src/banco/banco.ts`
```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migrarPg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migrarPglite } from 'drizzle-orm/pglite/migrator';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as schema from './schema';

/** Tipo comum ao node-postgres e ao PGlite. */
export type Banco = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface ConexaoBanco {
  db: Banco;
  tipo: 'postgres' | 'pglite';
  fechar(): Promise<void>;
}

export interface OpcoesBanco {
  /** `DATABASE_URL`. Sem ela, PGlite. */
  url?: string;
  /** Pasta do PGlite em disco; sem ela, PGlite em memória. */
  pastaPglite?: string;
}

export const PASTA_MIGRACOES = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Abre o banco e aplica as migrações pendentes (idempotente). */
export async function abrirBanco(o: OpcoesBanco = {}): Promise<ConexaoBanco> {
  if (o.url) {
    const pool = new pg.Pool({ connectionString: o.url, max: 10 });
    const db = drizzlePg({ client: pool, schema });
    await migrarPg(db, { migrationsFolder: PASTA_MIGRACOES });
    return { db, tipo: 'postgres', fechar: () => pool.end() };
  }
  if (o.pastaPglite) mkdirSync(o.pastaPglite, { recursive: true });
  const cliente = o.pastaPglite ? new PGlite(o.pastaPglite) : new PGlite();
  const db = drizzlePglite({ client: cliente, schema });
  await migrarPglite(db, { migrationsFolder: PASTA_MIGRACOES });
  return { db, tipo: 'pglite', fechar: () => cliente.close() };
}
```

**Step 5: Gerar a migração**

Run: `pnpm --filter @truco/server db:gerar --name inicial`
Expected (final da saída):
```
7 tables
...
[✓] Your SQL migration file ➜ drizzle\0000_inicial.sql 🚀
```
Confira que `apps/server/drizzle/0000_inicial.sql` tem `CREATE TABLE "usuarios"`, `"sessoes"`, `"links_magicos"`, `"ratings"` (com `PRIMARY KEY("usuario_id","variante")`), `"partidas"`, `"participacoes"`, `"bloqueios_fila"` e os índices. **Commite o SQL e a pasta `meta/`.** Regra para o futuro: mudou o schema → `db:gerar --name <descricao>` → commit; nunca edite migração já commitada.

**Step 6: Rodar e ver passar**

Run: `pnpm --filter @truco/server test banco`
Expected: PASS (2 testes). Primeira execução ~3–5 s por causa do PGlite.

Run: `pnpm --filter @truco/server typecheck` → sem erros.

**Step 7: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add .gitignore pnpm-lock.yaml apps/server
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): banco com Drizzle (Postgres ou PGlite), schema e migração inicial" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Elo e patentes (funções puras)

**Files:**
- Create: `apps/server/src/ranking/elo.ts`
- Test: `apps/server/test/elo.test.ts`

**Step 1: Teste que falha**

`apps/server/test/elo.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { deltaElo, ELO_INICIAL, esperado, K_PADRAO, media, novosPontos, patenteDe, PATENTES, proximaPatente } from '../src/ranking/elo';

describe('Elo', () => {
  test('constantes', () => {
    expect(ELO_INICIAL).toBe(1000);
    expect(K_PADRAO).toBe(32);
  });

  test('esperado: 0,5 entre iguais e simétrico', () => {
    expect(esperado(1000, 1000)).toBe(0.5);
    expect(esperado(1200, 1000)).toBeCloseTo(0.7597, 4);
    expect(esperado(1200, 1000) + esperado(1000, 1200)).toBeCloseTo(1, 10);
  });

  test('delta arredondado: ±16 entre iguais; favorito ganha pouco e perde muito', () => {
    expect(deltaElo(1000, 1000, 1)).toBe(16);
    expect(deltaElo(1000, 1000, 0)).toBe(-16);
    expect(deltaElo(1200, 1000, 1)).toBe(8);
    expect(deltaElo(1200, 1000, 0)).toBe(-24);
    expect(deltaElo(1000, 1200, 1)).toBe(24);
    expect(deltaElo(1000, 1000, 1, 16)).toBe(8);
  });

  test('media', () => {
    expect(media([1100, 900])).toBe(1000);
    expect(() => media([])).toThrow();
  });

  test('pontos nunca ficam negativos', () => {
    expect(novosPontos(10, -16)).toBe(0);
    expect(novosPontos(10, 16)).toBe(26);
  });
});

describe('patentes', () => {
  test('faixas do design', () => {
    expect(PATENTES.map((p) => [p.nome, p.minimo])).toEqual([
      ['Bronze', 0],
      ['Prata', 300],
      ['Ouro', 600],
      ['Diamante', 900],
      ['Mestre', 1200],
      ['Grão-Mestre', 1500],
    ]);
    expect(patenteDe(0)).toBe('Bronze');
    expect(patenteDe(299)).toBe('Bronze');
    expect(patenteDe(300)).toBe('Prata');
    expect(patenteDe(1499)).toBe('Mestre');
    expect(patenteDe(1500)).toBe('Grão-Mestre');
    expect(patenteDe(9999)).toBe('Grão-Mestre');
  });

  test('próxima patente e quanto falta', () => {
    expect(proximaPatente(250)).toEqual({ nome: 'Prata', faltam: 50 });
    expect(proximaPatente(600)).toEqual({ nome: 'Diamante', faltam: 300 });
    expect(proximaPatente(1600)).toBeNull();
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test elo`
Expected: FAIL — `Failed to load url ../src/ranking/elo`.

**Step 3: Implementação**

`apps/server/src/ranking/elo.ts`
```ts
export const ELO_INICIAL = 1000;
export const K_PADRAO = 32;

export const PATENTES = [
  { nome: 'Bronze', minimo: 0 },
  { nome: 'Prata', minimo: 300 },
  { nome: 'Ouro', minimo: 600 },
  { nome: 'Diamante', minimo: 900 },
  { nome: 'Mestre', minimo: 1200 },
  { nome: 'Grão-Mestre', minimo: 1500 },
] as const;

export type Patente = (typeof PATENTES)[number]['nome'];

/** Probabilidade esperada de A vencer B. */
export function esperado(eloA: number, eloB: number): number {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}

/** Variação de A (arredondada) contra B; `resultado` 1 = A venceu. */
export function deltaElo(eloA: number, eloB: number, resultado: 0 | 1, k = K_PADRAO): number {
  return Math.round(k * (resultado - esperado(eloA, eloB)));
}

export function media(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error('média de lista vazia');
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Pontos de patente recebem o mesmo delta do Elo, mas nunca ficam abaixo de 0. */
export function novosPontos(pontos: number, delta: number): number {
  return Math.max(0, pontos + delta);
}

export function patenteDe(pontos: number): Patente {
  let atual: Patente = PATENTES[0].nome;
  for (const p of PATENTES) if (pontos >= p.minimo) atual = p.nome;
  return atual;
}

export function proximaPatente(pontos: number): { nome: Patente; faltam: number } | null {
  const p = PATENTES.find((x) => x.minimo > pontos);
  return p ? { nome: p.nome, faltam: p.minimo - pontos } : null;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test elo`
Expected: PASS (7 testes).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src/ranking apps/server/test/elo.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): Elo, pontos de patente e patentes (puros)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Resultado da partida — deltas de dupla, abandono e contadores de truco (puros)

**Files:**
- Create: `apps/server/src/ranking/resultado.ts`, `apps/server/src/ranking/estatisticas.ts`
- Test: `apps/server/test/resultado.test.ts`

**Step 1: Teste que falha**

`apps/server/test/resultado.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { contadoresZerados, contarAcao, percentual } from '../src/ranking/estatisticas';
import { deltaAbandono, deltasDoFim, type JogadorRanqueado } from '../src/ranking/resultado';

const j = (usuarioId: number, dupla: 0 | 1, elo: number): JogadorRanqueado => ({ usuarioId, dupla, elo });

describe('deltasDoFim', () => {
  test('1x1 entre iguais: +16 / -16', () => {
    const todos = [j(1, 0, 1000), j(2, 1, 1000)];
    expect(deltasDoFim(todos, [1, 2], 0)).toEqual(new Map([[1, 16], [2, -16]]));
  });

  test('2x2: média da dupla contra média da dupla, mesmo delta para os dois', () => {
    const todos = [j(1, 0, 1100), j(3, 0, 900), j(2, 1, 1000), j(4, 1, 1000)];
    expect(deltasDoFim(todos, [1, 2, 3, 4], 0)).toEqual(new Map([[1, 16], [3, 16], [2, -16], [4, -16]]));
  });

  test('zebra vale mais', () => {
    const todos = [j(1, 0, 1200), j(3, 0, 1200), j(2, 1, 1000), j(4, 1, 1000)];
    const d = deltasDoFim(todos, [1, 2, 3, 4], 1);
    expect(d.get(2)).toBe(24);
    expect(d.get(1)).toBe(-24);
  });

  test('só os alvos recebem delta (quem abandonou fica de fora), mas a média usa todos', () => {
    const todos = [j(1, 0, 1000), j(3, 0, 1400), j(2, 1, 1200), j(4, 1, 1200)];
    expect(deltasDoFim(todos, [3, 2, 4], 0)).toEqual(new Map([[3, 16], [2, -16], [4, -16]]));
  });

  test('dupla sem humano é erro', () => {
    expect(() => deltasDoFim([j(1, 0, 1000)], [1], 0)).toThrow();
  });
});

describe('deltaAbandono', () => {
  test('derrota contra a média dos adversários', () => {
    expect(deltaAbandono([j(1, 0, 1000), j(2, 1, 1000)], 1)).toBe(-16);
    expect(deltaAbandono([j(1, 0, 1000), j(2, 1, 1200)], 1, 32)).toBe(-8);
  });

  test('usuário fora da partida é erro', () => {
    expect(() => deltaAbandono([j(1, 0, 1000), j(2, 1, 1000)], 9)).toThrow();
  });
});

describe('contadores de truco', () => {
  test('truco, aumentar, aceitar, correr e recusar mão de 10', () => {
    let c = contadoresZerados();
    c = contarAcao(c, { tipo: 'truco', cadeira: 0 });
    c = contarAcao(c, { tipo: 'aceitar', cadeira: 0 });
    c = contarAcao(c, { tipo: 'aumentar', cadeira: 0 });
    c = contarAcao(c, { tipo: 'correr', cadeira: 0 });
    c = contarAcao(c, { tipo: 'mao10', cadeira: 0, jogar: false });
    c = contarAcao(c, { tipo: 'mao10', cadeira: 0, jogar: true });
    c = contarAcao(c, { tipo: 'jogar', cadeira: 0, indice: 1 });
    expect(c).toEqual({ trucosPedidos: 2, respostasTruco: 3, trucosAceitos: 2, corridas: 2 });
  });

  test('não altera o objeto recebido', () => {
    const c = contadoresZerados();
    contarAcao(c, { tipo: 'truco', cadeira: 1 });
    expect(c.trucosPedidos).toBe(0);
  });

  test('percentual inteiro, null sem respostas', () => {
    expect(percentual(2, 3)).toBe(67);
    expect(percentual(0, 0)).toBeNull();
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test resultado`
Expected: FAIL — módulos inexistentes.

**Step 3: Implementação**

`apps/server/src/ranking/resultado.ts`
```ts
import type { Dupla } from '@truco/engine';
import { deltaElo, K_PADRAO, media } from './elo';

/** Humano logado numa ranqueada, com o Elo do começo da partida. */
export interface JogadorRanqueado {
  usuarioId: number;
  dupla: Dupla;
  elo: number;
}

function mediaDaDupla(todos: readonly JogadorRanqueado[], d: Dupla): number {
  const elos = todos.filter((x) => x.dupla === d).map((x) => x.elo);
  if (elos.length === 0) throw new Error(`dupla ${d} sem humano ranqueado`);
  return media(elos);
}

/** Delta de quem é da dupla `d`: média da dupla contra a média da outra. */
function deltaDaDupla(todos: readonly JogadorRanqueado[], d: Dupla, venceu: boolean, k: number): number {
  const outra = (1 - d) as Dupla;
  return deltaElo(mediaDaDupla(todos, d), mediaDaDupla(todos, outra), venceu ? 1 : 0, k);
}

/**
 * Deltas de fim de partida para os `alvos` (quem ficou até o fim). As médias usam
 * `todos` os humanos ranqueados, inclusive quem abandonou.
 */
export function deltasDoFim(
  todos: readonly JogadorRanqueado[],
  alvos: readonly number[],
  vencedora: Dupla,
  k = K_PADRAO,
): Map<number, number> {
  const porDupla = [deltaDaDupla(todos, 0, vencedora === 0, k), deltaDaDupla(todos, 1, vencedora === 1, k)];
  const out = new Map<number, number>();
  for (const id of alvos) {
    const x = todos.find((y) => y.usuarioId === id);
    if (!x) throw new Error(`usuário ${id} não está na partida`);
    out.set(id, porDupla[x.dupla]);
  }
  return out;
}

/** Abandono = derrota da dupla de quem saiu, calculada na hora. */
export function deltaAbandono(todos: readonly JogadorRanqueado[], usuarioId: number, k = K_PADRAO): number {
  const x = todos.find((y) => y.usuarioId === usuarioId);
  if (!x) throw new Error(`usuário ${usuarioId} não está na partida`);
  return deltaDaDupla(todos, x.dupla, false, k);
}
```

`apps/server/src/ranking/estatisticas.ts`
```ts
import type { AcaoJogador } from '@truco/engine';

export interface Contadores {
  trucosPedidos: number;
  respostasTruco: number;
  trucosAceitos: number;
  corridas: number;
}

export const contadoresZerados = (): Contadores => ({ trucosPedidos: 0, respostasTruco: 0, trucosAceitos: 0, corridas: 0 });

/** Conta uma ação deliberada de humano (as automáticas por tempo não passam por aqui). */
export function contarAcao(c: Contadores, a: AcaoJogador): Contadores {
  const n = { ...c };
  if (a.tipo === 'truco') n.trucosPedidos++;
  else if (a.tipo === 'aumentar') {
    n.trucosPedidos++;
    n.respostasTruco++;
    n.trucosAceitos++;
  } else if (a.tipo === 'aceitar') {
    n.respostasTruco++;
    n.trucosAceitos++;
  } else if (a.tipo === 'correr') {
    n.respostasTruco++;
    n.corridas++;
  } else if (a.tipo === 'mao10' && !a.jogar) n.corridas++;
  return n;
}

/** Porcentagem inteira; null quando não há base. */
export function percentual(parte: number, total: number): number | null {
  return total > 0 ? Math.round((100 * parte) / total) : null;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test resultado`
Expected: PASS (10 testes).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src/ranking apps/server/test/resultado.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): deltas de Elo por dupla, abandono e contadores de truco" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Repositório de usuários, sessões e links mágicos

**Files:**
- Create: `apps/server/src/auth/tokens.ts`, `apps/server/src/repo/usuarios.ts`
- Test: `apps/server/test/repo-usuarios.test.ts`

**Step 1: Teste que falha**

`apps/server/test/repo-usuarios.test.ts`
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { hashToken } from '../src/auth/tokens';
import {
  apelidoValido,
  baseDeApelido,
  consumirLinkMagico,
  criarLinkMagico,
  criarSessao,
  criarUsuario,
  DURACAO_LINK_MS,
  DURACAO_SESSAO_MS,
  encerrarSessao,
  entrarComEmail,
  entrarComGoogle,
  normalizarEmail,
  trocarApelido,
  usuarioDaSessao,
} from '../src/repo/usuarios';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

const T0 = new Date('2026-11-05T12:00:00Z');
const depois = (ms: number) => new Date(T0.getTime() + ms);

describe('validações', () => {
  test('normalizarEmail', () => {
    expect(normalizarEmail('  Ana@Exemplo.COM ')).toBe('ana@exemplo.com');
    expect(normalizarEmail('sem-arroba')).toBeNull();
    expect(normalizarEmail(42)).toBeNull();
    expect(normalizarEmail(`${'a'.repeat(250)}@x.com`)).toBeNull();
  });

  test('apelidoValido: 3 a 20 caracteres limpos', () => {
    expect(apelidoValido('  Zé do Truco ')).toBe('Zé do Truco');
    expect(apelidoValido('ab')).toBeNull();
    expect(apelidoValido('   ')).toBeNull();
    expect(apelidoValido('Bot Malandro')).toBe('Malandro');
    expect(apelidoValido(null)).toBeNull();
  });

  test('baseDeApelido', () => {
    expect(baseDeApelido('ana.e2e@teste.dev')).toBe('anae2e');
    expect(baseDeApelido('Bia Souza')).toBe('BiaSouza');
    expect(baseDeApelido('x@y.z')).toBe('jogador');
  });
});

describe('usuários', () => {
  test('apelido ocupado ganha sufixo', async () => {
    const a = await criarUsuario(b.db, { apelidoBase: 'ana' });
    const c = await criarUsuario(b.db, { apelidoBase: 'ana' });
    expect([a.apelido, c.apelido]).toEqual(['ana', 'ana2']);
  });

  test('entrarComEmail cria uma vez e depois reaproveita', async () => {
    const u1 = await entrarComEmail(b.db, 'ana@x.com');
    const u2 = await entrarComEmail(b.db, 'ana@x.com');
    expect(u2).toEqual(u1);
    expect(u1).toMatchObject({ apelido: 'ana', email: 'ana@x.com' });
  });

  test('Google: acha por sub; liga ao e-mail existente só se verificado', async () => {
    const porEmail = await entrarComEmail(b.db, 'bia@x.com');
    const ligado = await entrarComGoogle(b.db, { sub: 'g1', email: 'bia@x.com', emailVerificado: true, nome: 'Bia' });
    expect(ligado.id).toBe(porEmail.id);
    expect((await entrarComGoogle(b.db, { sub: 'g1', email: null, emailVerificado: false, nome: null })).id).toBe(porEmail.id);
    const outro = await entrarComGoogle(b.db, { sub: 'g2', email: 'bia@x.com', emailVerificado: false, nome: 'Bia Souza' });
    expect(outro.id).not.toBe(porEmail.id);
    expect(outro).toMatchObject({ apelido: 'BiaSouza', email: null });
  });

  test('trocarApelido', async () => {
    const a = await criarUsuario(b.db, { apelidoBase: 'ana' });
    await criarUsuario(b.db, { apelidoBase: 'bia' });
    expect(await trocarApelido(b.db, a.id, 'ab')).toBe('invalido');
    expect(await trocarApelido(b.db, a.id, 'bia')).toBe('em-uso');
    expect(await trocarApelido(b.db, a.id, 'Aninha')).toBe('ok');
  });
});

describe('sessões', () => {
  test('cria, valida, expira e encerra; no banco só o hash', async () => {
    const u = await criarUsuario(b.db, { apelidoBase: 'ana' });
    const token = await criarSessao(b.db, u.id, T0);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(token)).not.toBe(token);
    expect(await usuarioDaSessao(b.db, token, depois(1000))).toEqual(u);
    expect(await usuarioDaSessao(b.db, token, depois(DURACAO_SESSAO_MS + 1))).toBeNull();
    expect(await usuarioDaSessao(b.db, 'inventado', T0)).toBeNull();
    await encerrarSessao(b.db, token);
    expect(await usuarioDaSessao(b.db, token, depois(1000))).toBeNull();
  });
});

describe('links mágicos', () => {
  test('uso único e expiração', async () => {
    const t1 = await criarLinkMagico(b.db, 'ana@x.com', T0);
    expect(await consumirLinkMagico(b.db, t1, depois(1000))).toBe('ana@x.com');
    expect(await consumirLinkMagico(b.db, t1, depois(2000))).toBeNull();
    const t2 = await criarLinkMagico(b.db, 'ana@x.com', T0);
    expect(await consumirLinkMagico(b.db, t2, depois(DURACAO_LINK_MS + 1))).toBeNull();
    expect(await consumirLinkMagico(b.db, '', T0)).toBeNull();
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test repo-usuarios`
Expected: FAIL — módulos inexistentes.

**Step 3: Implementação**

`apps/server/src/auth/tokens.ts`
```ts
import { createHash, randomBytes } from 'node:crypto';

/** 32 bytes aleatórios em base64url (43 caracteres). */
export const gerarToken = (): string => randomBytes(32).toString('base64url');

/** O banco guarda só isto: quem ler o banco não consegue se passar pelo usuário. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
```

`apps/server/src/repo/usuarios.ts`
```ts
import { and, eq, gt } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import type { PerfilGoogle } from '../auth/google';
import { gerarToken, hashToken } from '../auth/tokens';
import type { Banco } from '../banco/banco';
import { linksMagicos, sessoes, usuarios } from '../banco/schema';
import { limparNome } from '../mesa/protocolo';

export interface Usuario {
  id: number;
  apelido: string;
  email: string | null;
}

export const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;
export const DURACAO_LINK_MS = 15 * 60 * 1000;

const COLUNAS = { id: usuarios.id, apelido: usuarios.apelido, email: usuarios.email };

const ehViolacaoUnica = (e: unknown) => {
  const x = e as { code?: string; cause?: { code?: string } } | null;
  return x?.code === '23505' || x?.cause?.code === '23505';
};

export function normalizarEmail(cru: unknown): string | null {
  if (typeof cru !== 'string') return null;
  const e = cru.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Apelido escolhido pelo usuário: as regras de `limparNome` e 3 a 20 caracteres. */
export function apelidoValido(cru: unknown): string | null {
  if (typeof cru !== 'string' || !cru.trim()) return null;
  const n = limparNome(cru);
  return n.length >= 3 ? n : null;
}

/** Base de apelido a partir de e-mail ou nome: só letras, números e _. */
export function baseDeApelido(texto: string): string {
  const fonte = texto.includes('@') ? texto.split('@')[0] : texto;
  const base = fonte.replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 16);
  return base.length >= 3 ? base : 'jogador';
}

async function apelidoExiste(db: Banco, apelido: string): Promise<boolean> {
  const [x] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.apelido, apelido)).limit(1);
  return !!x;
}

async function apelidoLivre(db: Banco, base: string): Promise<string> {
  for (let i = 1; i <= 50; i++) {
    const sufixo = i === 1 ? '' : String(i);
    const cand = base.slice(0, 20 - sufixo.length) + sufixo;
    if (!(await apelidoExiste(db, cand))) return cand;
  }
  return base.slice(0, 14) + randomInt(100_000, 1_000_000);
}

export async function criarUsuario(
  db: Banco,
  o: { apelidoBase: string; email?: string | null; googleSub?: string | null },
): Promise<Usuario> {
  for (let tentativa = 0; ; tentativa++) {
    const apelido = await apelidoLivre(db, o.apelidoBase);
    try {
      const [u] = await db
        .insert(usuarios)
        .values({ apelido, email: o.email ?? null, googleSub: o.googleSub ?? null })
        .returning(COLUNAS);
      return u;
    } catch (e) {
      // corrida com outro cadastro do mesmo apelido: tenta o próximo
      if (!ehViolacaoUnica(e) || tentativa >= 3) throw e;
    }
  }
}

export async function usuarioPorId(db: Banco, id: number): Promise<Usuario | null> {
  const [u] = await db.select(COLUNAS).from(usuarios).where(eq(usuarios.id, id));
  return u ?? null;
}

export async function usuarioPorEmail(db: Banco, email: string): Promise<Usuario | null> {
  const [u] = await db.select(COLUNAS).from(usuarios).where(eq(usuarios.email, email));
  return u ?? null;
}

/** Login por link mágico: acha pelo e-mail ou cria a conta. */
export async function entrarComEmail(db: Banco, email: string): Promise<Usuario> {
  const existente = await usuarioPorEmail(db, email);
  if (existente) return existente;
  try {
    return await criarUsuario(db, { apelidoBase: baseDeApelido(email), email });
  } catch (e) {
    // dois cliques simultâneos no link: o outro criou primeiro
    const u = ehViolacaoUnica(e) ? await usuarioPorEmail(db, email) : null;
    if (u) return u;
    throw e;
  }
}

/** Login Google: acha por `sub`; senão liga ao e-mail (se verificado); senão cria. */
export async function entrarComGoogle(db: Banco, g: PerfilGoogle): Promise<Usuario> {
  const [porSub] = await db.select(COLUNAS).from(usuarios).where(eq(usuarios.googleSub, g.sub));
  if (porSub) return porSub;
  const email = g.emailVerificado ? normalizarEmail(g.email) : null;
  if (email) {
    const u = await usuarioPorEmail(db, email);
    if (u) {
      await db.update(usuarios).set({ googleSub: g.sub }).where(eq(usuarios.id, u.id));
      return u;
    }
  }
  return criarUsuario(db, { apelidoBase: baseDeApelido(g.nome ?? email ?? 'jogador'), email, googleSub: g.sub });
}

export async function trocarApelido(db: Banco, id: number, cru: unknown): Promise<'ok' | 'invalido' | 'em-uso'> {
  const apelido = apelidoValido(cru);
  if (!apelido) return 'invalido';
  try {
    await db.update(usuarios).set({ apelido }).where(eq(usuarios.id, id));
    return 'ok';
  } catch (e) {
    if (ehViolacaoUnica(e)) return 'em-uso';
    throw e;
  }
}

// ---------- sessões ----------

export async function criarSessao(db: Banco, usuarioId: number, agora: Date): Promise<string> {
  const token = gerarToken();
  await db.insert(sessoes).values({
    tokenHash: hashToken(token),
    usuarioId,
    expiraEm: new Date(agora.getTime() + DURACAO_SESSAO_MS),
    criadaEm: agora,
  });
  return token;
}

export async function usuarioDaSessao(db: Banco, token: string | null | undefined, agora: Date): Promise<Usuario | null> {
  if (!token || token.length > 200) return null;
  const [u] = await db
    .select(COLUNAS)
    .from(sessoes)
    .innerJoin(usuarios, eq(sessoes.usuarioId, usuarios.id))
    .where(and(eq(sessoes.tokenHash, hashToken(token)), gt(sessoes.expiraEm, agora)));
  return u ?? null;
}

export async function encerrarSessao(db: Banco, token: string): Promise<void> {
  await db.delete(sessoes).where(eq(sessoes.tokenHash, hashToken(token)));
}

// ---------- links mágicos ----------

export async function criarLinkMagico(db: Banco, email: string, agora: Date): Promise<string> {
  const token = gerarToken();
  await db.insert(linksMagicos).values({
    tokenHash: hashToken(token),
    email,
    expiraEm: new Date(agora.getTime() + DURACAO_LINK_MS),
    criadoEm: agora,
  });
  return token;
}

/** Marca como usado e devolve o e-mail, numa única instrução (dois cliques não entram duas vezes). */
export async function consumirLinkMagico(db: Banco, token: string, agora: Date): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const [l] = await db
    .update(linksMagicos)
    .set({ usado: true })
    .where(and(eq(linksMagicos.tokenHash, hashToken(token)), eq(linksMagicos.usado, false), gt(linksMagicos.expiraEm, agora)))
    .returning({ email: linksMagicos.email });
  return l?.email ?? null;
}
```

Este arquivo importa o tipo `PerfilGoogle` de `../auth/google`, que nasce na Tarefa 7. Para não quebrar agora, crie já `apps/server/src/auth/google.ts` só com a interface (a Tarefa 7 completa o arquivo):
```ts
export interface PerfilGoogle {
  sub: string;
  email: string | null;
  emailVerificado: boolean;
  nome: string | null;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test repo-usuarios`
Expected: PASS (9 testes).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src apps/server/test/repo-usuarios.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): repositório de usuários, sessões opacas e links mágicos de uso único" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Repositório de partidas — início, abandono, fim com Elo, bloqueio, perfil, histórico e ranking

**Files:**
- Create: `apps/server/src/api/tipos.ts` (tipos compartilhados com o web), `apps/server/src/repo/partidas.ts`
- Test: `apps/server/test/repo-partidas.test.ts`

**Step 1: Tipos compartilhados**

`apps/server/src/api/tipos.ts` — **só tipos** (o web importa via alias `@truco/api`):
```ts
import type { RegrasMesa, Variante } from '@truco/engine';
import type { ModoMesa, NivelBot } from '../mesa/protocolo';

export type Formato = '1x1' | '2x2';

export interface UsuarioApi {
  id: number;
  apelido: string;
  email: string | null;
}

export interface ConfigApi {
  /** Client ID do Google (liga o botão) ou null. */
  google: string | null;
  /** Caixa de saída de teste ativa (E2E). */
  emailTeste: boolean;
}

export interface RatingVariante {
  elo: number;
  pontos: number;
  patente: string;
  proxima: { nome: string; faltam: number } | null;
  partidasRanqueadas: number;
  jogos: number;
  vitorias: number;
  /** Aceitos ÷ respostas a truco, em %; null sem respostas. */
  pctTrucoAceito: number | null;
  corridas: number;
}

export interface PerfilApi {
  usuario: { id: number; apelido: string };
  variantes: Record<Variante, RatingVariante>;
}

export interface ItemHistorico {
  partidaId: number;
  variante: Variante;
  modo: ModoMesa;
  ranqueada: boolean;
  nos: number;
  eles: number;
  venceu: boolean | null;
  abandonou: boolean;
  deltaElo: number | null;
  iniciadaEm: string;
  terminadaEm: string | null;
}

export interface LinhaRanking {
  posicao: number;
  usuarioId: number;
  apelido: string;
  pontos: number;
  elo: number;
  patente: string;
  partidas: number;
}

export interface SalaAberta {
  id: string;
  modo: ModoMesa;
  variante: Variante;
  humanos: number;
  nivelBot: NivelBot;
  regras: RegrasMesa | null;
  ocupados: number;
  dono: string | null;
}

export interface MsgStatusFila {
  esperaS: number;
  faixa: number;
  /** Quantos estão na mesma fila (variante + formato). */
  naFila: number;
  aguardandoParceiro: boolean;
}

export interface MsgPareado {
  /** `ISeatReservation` do Colyseus, para `client.consumeSeatReservation`. */
  reserva: unknown;
}
```
(A mensagem de chat, `MsgChat`, é protocolo de sala e fica em `protocolo.ts` — Tarefa 11.)

**Step 2: Teste que falha**

`apps/server/test/repo-partidas.test.ts`
```ts
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { participacoes, partidas, ratings } from '../src/banco/schema';
import { contadoresZerados } from '../src/ranking/estatisticas';
import {
  type AssentoRegistro,
  bloqueioAte,
  historico,
  iniciarPartida,
  perfil,
  ranking,
  ratingDe,
  registrarAbandono,
  terminarPartida,
} from '../src/repo/partidas';
import { criarUsuario } from '../src/repo/usuarios';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

const T0 = new Date('2026-11-05T12:00:00Z');
const OPC = { k: 32, agora: T0, bloqueioMs: 5 * 60_000 };

async function doisJogadores() {
  const ana = await criarUsuario(b.db, { apelidoBase: 'ana' });
  const bia = await criarUsuario(b.db, { apelidoBase: 'bia' });
  return { ana, bia };
}

/** 1x1 ranqueado: ana na cadeira 0, bia na 1, bots nas 2 e 3. */
const assentos1x1 = (ana: number, bia: number): AssentoRegistro[] => [
  { cadeira: 0, usuarioId: ana, nome: 'ana', humano: true },
  { cadeira: 1, usuarioId: bia, nome: 'bia', humano: true },
  { cadeira: 2, usuarioId: null, nome: 'Bot Zé', humano: false },
  { cadeira: 3, usuarioId: null, nome: 'Bot Tião', humano: false },
];

const fim = (vencedora: 0 | 1, placar: [number, number]) => ({
  placar,
  vencedora,
  contadores: [
    { trucosPedidos: 2, respostasTruco: 3, trucosAceitos: 2, corridas: 1 },
    contadoresZerados(),
    contadoresZerados(),
    contadoresZerados(),
  ],
});

describe('partida ranqueada', () => {
  test('início grava 4 participações, com elo_antes só para humanos logados', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    const ps = await b.db.select().from(participacoes).where(eq(participacoes.partidaId, id));
    expect(ps.map((p) => [p.cadeira, p.dupla, p.eloAntes])).toEqual([
      [0, 0, 1000],
      [1, 1, 1000],
      [2, 0, null],
      [3, 1, null],
    ]);
  });

  test('fim: vencedor +16, perdedor -16, estatísticas, placar e ranking', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    const deltas = await terminarPartida(b.db, id, fim(0, [12, 7]), OPC);
    expect(deltas).toEqual(new Map([[ana.id, 16], [bia.id, -16]]));
    expect(await ratingDe(b.db, ana.id, 'paulista')).toEqual({ elo: 1016, pontos: 16, partidas: 1 });
    expect(await ratingDe(b.db, bia.id, 'paulista')).toEqual({ elo: 984, pontos: 0, partidas: 1 });
    expect(await ratingDe(b.db, ana.id, 'mineiro')).toEqual({ elo: 1000, pontos: 0, partidas: 0 });

    const [p] = await b.db.select().from(partidas).where(eq(partidas.id, id));
    expect(p).toMatchObject({ placar0: 12, placar1: 7, vencedora: 0, abandonada: false });
    expect(p.terminadaEm).toEqual(T0);

    const pa = await perfil(b.db, ana.id);
    expect(pa?.variantes.paulista).toEqual({
      elo: 1016,
      pontos: 16,
      patente: 'Bronze',
      proxima: { nome: 'Prata', faltam: 284 },
      partidasRanqueadas: 1,
      jogos: 1,
      vitorias: 1,
      pctTrucoAceito: 67,
      corridas: 1,
    });
    expect(pa?.variantes.mineiro.jogos).toBe(0);

    expect((await ranking(b.db, 'paulista')).map((l) => [l.posicao, l.apelido, l.pontos, l.patente])).toEqual([
      [1, 'ana', 16, 'Bronze'],
      [2, 'bia', 0, 'Bronze'],
    ]);
    expect(await ranking(b.db, 'mineiro')).toEqual([]);

    const h = await historico(b.db, bia.id);
    expect(h).toEqual([
      expect.objectContaining({ partidaId: id, variante: 'paulista', modo: 'ranqueada', ranqueada: true, nos: 7, eles: 12, venceu: false, abandonou: false, deltaElo: -16 }),
    ]);
  });

  test('abandono: derrota na hora, bloqueio de 5 min e quem ficou pontua no fim', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'mineiro', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    expect(await registrarAbandono(b.db, id, ana.id, OPC)).toBe(-16);
    expect(await registrarAbandono(b.db, id, ana.id, OPC)).toBeNull();
    expect(await ratingDe(b.db, ana.id, 'mineiro')).toEqual({ elo: 984, pontos: 0, partidas: 1 });
    expect(await bloqueioAte(b.db, ana.id, new Date(T0.getTime() + 60_000))).toEqual(new Date(T0.getTime() + 5 * 60_000));
    expect(await bloqueioAte(b.db, ana.id, new Date(T0.getTime() + 6 * 60_000))).toBeNull();

    // a dupla da Ana (agora com bot) até vence, mas ela não ganha nada
    const deltas = await terminarPartida(b.db, id, fim(0, [12, 10]), OPC);
    expect(deltas).toEqual(new Map([[bia.id, -16]]));
    expect(await ratingDe(b.db, ana.id, 'mineiro')).toEqual({ elo: 984, pontos: 0, partidas: 1 });
    const [pa] = await b.db.select().from(participacoes).where(eq(participacoes.usuarioId, ana.id));
    expect(pa).toMatchObject({ abandonou: true, venceu: false, eloAntes: 1000, eloDepois: 984 });
  });

  test('todos os humanos saíram: partida abandonada, ninguém mais pontua', async () => {
    const { ana, bia } = await doisJogadores();
    const id = await iniciarPartida(b.db, { variante: 'paulista', modo: 'ranqueada', formato: '1x1', assentos: assentos1x1(ana.id, bia.id) }, T0);
    await registrarAbandono(b.db, id, ana.id, OPC);
    await registrarAbandono(b.db, id, bia.id, OPC);
    expect(await terminarPartida(b.db, id, fim(1, [3, 12]), OPC)).toEqual(new Map());
    const [p] = await b.db.select().from(partidas).where(eq(partidas.id, id));
    expect(p.abandonada).toBe(true);
    expect((await ratingDe(b.db, bia.id, 'paulista')).elo).toBe(984);
  });
});

describe('partida casual', () => {
  test('grava histórico e estatísticas, sem Elo; abandono não bloqueia', async () => {
    const { ana } = await doisJogadores();
    const id = await iniciarPartida(
      b.db,
      {
        variante: 'paulista',
        modo: 'classica',
        formato: null,
        assentos: [
          { cadeira: 0, usuarioId: ana.id, nome: 'ana', humano: true },
          { cadeira: 1, usuarioId: null, nome: 'Bot Zé', humano: false },
          { cadeira: 2, usuarioId: null, nome: 'Convidado', humano: true },
          { cadeira: 3, usuarioId: null, nome: 'Bot Tião', humano: false },
        ],
      },
      T0,
    );
    expect(await registrarAbandono(b.db, id, ana.id, OPC)).toBeNull();
    expect(await bloqueioAte(b.db, ana.id, T0)).toBeNull();
    await terminarPartida(b.db, id, fim(0, [12, 0]), OPC);
    expect(await b.db.select().from(ratings)).toEqual([]);
    const [p] = await b.db.select().from(partidas).where(eq(partidas.id, id));
    expect(p.abandonada).toBe(false); // o convidado ficou até o fim
    expect((await perfil(b.db, ana.id))?.variantes.paulista).toMatchObject({ jogos: 1, vitorias: 0, partidasRanqueadas: 0 });
  });

  test('perfil de usuário inexistente', async () => {
    expect(await perfil(b.db, 999)).toBeNull();
  });
});
```

**Step 3: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test repo-partidas`
Expected: FAIL — `Failed to load url ../src/repo/partidas`.

**Step 4: Implementação**

`apps/server/src/repo/partidas.ts`
```ts
import { type Cadeira, type Dupla, duplaDe, type Variante } from '@truco/engine';
import { and, asc, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import type { Formato, ItemHistorico, LinhaRanking, PerfilApi, RatingVariante } from '../api/tipos';
import type { Banco } from '../banco/banco';
import { bloqueiosFila, participacoes, partidas, ratings, usuarios, VARIANTES } from '../banco/schema';
import type { ModoMesa } from '../mesa/protocolo';
import { ELO_INICIAL, novosPontos, patenteDe, proximaPatente } from '../ranking/elo';
import { type Contadores, contadoresZerados, percentual } from '../ranking/estatisticas';
import { deltaAbandono, deltasDoFim, type JogadorRanqueado } from '../ranking/resultado';

/** O que `Banco` e uma transação têm em comum (o que as funções abaixo usam). */
type Exec = Pick<Banco, 'select' | 'insert' | 'update' | 'delete'>;

export interface AssentoRegistro {
  cadeira: Cadeira;
  usuarioId: number | null;
  nome: string;
  humano: boolean;
}

export interface InicioPartida {
  variante: Variante;
  modo: ModoMesa;
  formato: Formato | null;
  assentos: AssentoRegistro[];
}

export interface FimPartida {
  placar: readonly [number, number];
  vencedora: Dupla | null;
  /** Por cadeira (0–3). */
  contadores: readonly Contadores[];
}

export interface OpcoesRanking {
  k: number;
  agora: Date;
}

async function lerRating(db: Exec, usuarioId: number, variante: Variante) {
  const [r] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.usuarioId, usuarioId), eq(ratings.variante, variante)));
  return r ? { elo: r.elo, pontos: r.pontos, partidas: r.partidas } : { elo: ELO_INICIAL, pontos: 0, partidas: 0 };
}

export const ratingDe = (db: Banco, usuarioId: number, variante: Variante) => lerRating(db, usuarioId, variante);

/** Soma o delta ao Elo e aos pontos (piso 0) e conta a partida ranqueada. */
async function somarRating(db: Exec, usuarioId: number, variante: Variante, delta: number, agora: Date): Promise<void> {
  await db
    .insert(ratings)
    .values({ usuarioId, variante, elo: ELO_INICIAL + delta, pontos: novosPontos(0, delta), partidas: 1, atualizadoEm: agora })
    .onConflictDoUpdate({
      target: [ratings.usuarioId, ratings.variante],
      set: {
        elo: sql`${ratings.elo} + ${delta}`,
        pontos: sql`greatest(0, ${ratings.pontos} + ${delta})`,
        partidas: sql`${ratings.partidas} + 1`,
        atualizadoEm: agora,
      },
    });
}

type LinhaParticipacao = typeof participacoes.$inferSelect;

function jogadoresRanqueados(ps: readonly LinhaParticipacao[]): JogadorRanqueado[] {
  return ps
    .filter((x) => x.humano && x.usuarioId !== null && x.eloAntes !== null)
    .map((x) => ({ usuarioId: x.usuarioId!, dupla: x.dupla as Dupla, elo: x.eloAntes! }));
}

export async function iniciarPartida(db: Banco, i: InicioPartida, agora: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const ranqueada = i.modo === 'ranqueada';
    const [p] = await tx
      .insert(partidas)
      .values({ variante: i.variante, modo: i.modo, formato: i.formato, ranqueada, iniciadaEm: agora })
      .returning({ id: partidas.id });
    const linhas = [];
    for (const a of i.assentos) {
      const eloAntes = ranqueada && a.humano && a.usuarioId !== null ? (await lerRating(tx, a.usuarioId, i.variante)).elo : null;
      linhas.push({
        partidaId: p.id,
        usuarioId: a.usuarioId,
        nome: a.nome,
        humano: a.humano,
        cadeira: a.cadeira,
        dupla: duplaDe(a.cadeira),
        eloAntes,
      });
    }
    await tx.insert(participacoes).values(linhas);
    return p.id;
  });
}

/**
 * Saída definitiva antes do fim. Ranqueada: derrota na hora + bloqueio de fila.
 * Devolve o delta aplicado (null se não houve penalidade ou já estava registrado).
 */
export async function registrarAbandono(
  db: Banco,
  partidaId: number,
  usuarioId: number,
  o: OpcoesRanking & { bloqueioMs: number },
): Promise<number | null> {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(partidas).where(eq(partidas.id, partidaId));
    if (!p || p.terminadaEm) return null;
    const ps = await tx.select().from(participacoes).where(eq(participacoes.partidaId, partidaId));
    const eu = ps.find((x) => x.humano && x.usuarioId === usuarioId);
    if (!eu || eu.abandonou) return null;
    if (!p.ranqueada || eu.eloAntes === null) {
      await tx.update(participacoes).set({ abandonou: true }).where(eq(participacoes.id, eu.id));
      return null;
    }
    const delta = deltaAbandono(jogadoresRanqueados(ps), usuarioId, o.k);
    await tx
      .update(participacoes)
      .set({ abandonou: true, venceu: false, eloDepois: eu.eloAntes + delta })
      .where(eq(participacoes.id, eu.id));
    await somarRating(tx, usuarioId, p.variante, delta, o.agora);
    const ate = new Date(o.agora.getTime() + o.bloqueioMs);
    await tx
      .insert(bloqueiosFila)
      .values({ usuarioId, ate, motivo: 'abandono' })
      .onConflictDoUpdate({ target: bloqueiosFila.usuarioId, set: { ate, motivo: 'abandono' } });
    return delta;
  });
}

/** Fim: placar, estatísticas, vitória e (ranqueada) Elo de quem ficou. Devolve os deltas. */
export async function terminarPartida(db: Banco, partidaId: number, fim: FimPartida, o: OpcoesRanking): Promise<Map<number, number>> {
  return db.transaction(async (tx) => {
    const deltas = new Map<number, number>();
    const [p] = await tx.select().from(partidas).where(eq(partidas.id, partidaId));
    if (!p || p.terminadaEm) return deltas;
    const ps = await tx.select().from(participacoes).where(eq(participacoes.partidaId, partidaId));
    const presentes = ps.filter((x) => x.humano && !x.abandonou);
    for (const x of ps) {
      const c = fim.contadores[x.cadeira] ?? contadoresZerados();
      const venceu = x.humano && !x.abandonou && fim.vencedora !== null ? x.dupla === fim.vencedora : x.venceu;
      await tx.update(participacoes).set({ ...c, venceu }).where(eq(participacoes.id, x.id));
    }
    const abandonada = presentes.length === 0;
    if (p.ranqueada && !abandonada && fim.vencedora !== null) {
      const alvos = presentes.filter((x) => x.usuarioId !== null && x.eloAntes !== null).map((x) => x.usuarioId!);
      for (const [uid, d] of deltasDoFim(jogadoresRanqueados(ps), alvos, fim.vencedora, o.k)) {
        deltas.set(uid, d);
        const x = ps.find((y) => y.usuarioId === uid)!;
        await tx.update(participacoes).set({ eloDepois: x.eloAntes! + d }).where(eq(participacoes.id, x.id));
        await somarRating(tx, uid, p.variante, d, o.agora);
      }
    }
    await tx
      .update(partidas)
      .set({ placar0: fim.placar[0], placar1: fim.placar[1], vencedora: fim.vencedora, terminadaEm: o.agora, abandonada })
      .where(eq(partidas.id, partidaId));
    return deltas;
  });
}

export async function bloqueioAte(db: Banco, usuarioId: number, agora: Date): Promise<Date | null> {
  const [x] = await db
    .select({ ate: bloqueiosFila.ate })
    .from(bloqueiosFila)
    .where(and(eq(bloqueiosFila.usuarioId, usuarioId), gt(bloqueiosFila.ate, agora)));
  return x?.ate ?? null;
}

export async function perfil(db: Banco, usuarioId: number): Promise<PerfilApi | null> {
  const [u] = await db.select({ id: usuarios.id, apelido: usuarios.apelido }).from(usuarios).where(eq(usuarios.id, usuarioId));
  if (!u) return null;
  const rs = await db.select().from(ratings).where(eq(ratings.usuarioId, usuarioId));
  const est = await db
    .select({
      variante: partidas.variante,
      jogos: sql<number>`(count(*))::int`,
      vitorias: sql<number>`(count(*) filter (where ${participacoes.venceu}))::int`,
      respostas: sql<number>`(coalesce(sum(${participacoes.respostasTruco}), 0))::int`,
      aceitos: sql<number>`(coalesce(sum(${participacoes.trucosAceitos}), 0))::int`,
      corridas: sql<number>`(coalesce(sum(${participacoes.corridas}), 0))::int`,
    })
    .from(participacoes)
    .innerJoin(partidas, eq(participacoes.partidaId, partidas.id))
    .where(and(eq(participacoes.usuarioId, usuarioId), isNotNull(partidas.terminadaEm)))
    .groupBy(partidas.variante);
  const variantes = {} as Record<Variante, RatingVariante>;
  for (const v of VARIANTES) {
    const r = rs.find((x) => x.variante === v);
    const e = est.find((x) => x.variante === v);
    const pontos = r?.pontos ?? 0;
    variantes[v] = {
      elo: r?.elo ?? ELO_INICIAL,
      pontos,
      patente: patenteDe(pontos),
      proxima: proximaPatente(pontos),
      partidasRanqueadas: r?.partidas ?? 0,
      jogos: e?.jogos ?? 0,
      vitorias: e?.vitorias ?? 0,
      pctTrucoAceito: percentual(e?.aceitos ?? 0, e?.respostas ?? 0),
      corridas: e?.corridas ?? 0,
    };
  }
  return { usuario: u, variantes };
}

export async function historico(db: Banco, usuarioId: number, limite = 20): Promise<ItemHistorico[]> {
  const linhas = await db
    .select({
      partidaId: partidas.id,
      variante: partidas.variante,
      modo: partidas.modo,
      ranqueada: partidas.ranqueada,
      placar0: partidas.placar0,
      placar1: partidas.placar1,
      iniciadaEm: partidas.iniciadaEm,
      terminadaEm: partidas.terminadaEm,
      dupla: participacoes.dupla,
      venceu: participacoes.venceu,
      abandonou: participacoes.abandonou,
      eloAntes: participacoes.eloAntes,
      eloDepois: participacoes.eloDepois,
    })
    .from(participacoes)
    .innerJoin(partidas, eq(participacoes.partidaId, partidas.id))
    .where(eq(participacoes.usuarioId, usuarioId))
    .orderBy(desc(partidas.iniciadaEm), desc(partidas.id))
    .limit(Math.min(100, Math.max(1, limite)));
  return linhas.map((l) => ({
    partidaId: l.partidaId,
    variante: l.variante,
    modo: l.modo,
    ranqueada: l.ranqueada,
    nos: l.dupla === 0 ? l.placar0 : l.placar1,
    eles: l.dupla === 0 ? l.placar1 : l.placar0,
    venceu: l.venceu,
    abandonou: l.abandonou,
    deltaElo: l.eloAntes !== null && l.eloDepois !== null ? l.eloDepois - l.eloAntes : null,
    iniciadaEm: l.iniciadaEm.toISOString(),
    terminadaEm: l.terminadaEm?.toISOString() ?? null,
  }));
}

export async function ranking(db: Banco, variante: Variante, limite = 50): Promise<LinhaRanking[]> {
  const linhas = await db
    .select({
      usuarioId: ratings.usuarioId,
      apelido: usuarios.apelido,
      pontos: ratings.pontos,
      elo: ratings.elo,
      partidas: ratings.partidas,
    })
    .from(ratings)
    .innerJoin(usuarios, eq(ratings.usuarioId, usuarios.id))
    .where(and(eq(ratings.variante, variante), gt(ratings.partidas, 0)))
    .orderBy(desc(ratings.pontos), desc(ratings.elo), asc(ratings.usuarioId))
    .limit(Math.min(200, Math.max(1, limite)));
  return linhas.map((l, i) => ({ posicao: i + 1, ...l, patente: patenteDe(l.pontos) }));
}
```

**Step 5: Rodar e ver passar**

Run: `pnpm --filter @truco/server test repo-partidas`
Expected: PASS (6 testes).

Run: `pnpm --filter @truco/server typecheck` → sem erros. (Se o `tx` do Drizzle não satisfizer `Exec` na sua versão, troque o tipo por `Parameters<Parameters<Banco['transaction']>[0]>[0] | Banco`.)

**Step 6: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src apps/server/test/repo-partidas.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): partidas, participações, Elo no fim e no abandono, bloqueio, perfil, histórico e ranking" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Auth — cookies, limite de taxa, e-mail (Resend/console/caixa de teste) e Google

**Files:**
- Modify: `apps/server/src/auth/tokens.ts`, `apps/server/src/auth/google.ts`
- Create: `apps/server/src/auth/limite.ts`, `apps/server/src/auth/emails.ts`
- Test: `apps/server/test/auth-util.test.ts`

**Step 1: Teste que falha**

`apps/server/test/auth-util.test.ts`
```ts
import { describe, expect, test, vi } from 'vitest';
import { CaixaDeTeste, emailDoLink, emailsConsole, emailsResend, extrairLink } from '../src/auth/emails';
import { LimiteTaxa } from '../src/auth/limite';
import { bearer, COOKIE_SESSAO, cookieApagado, cookieSessao, lerCookie } from '../src/auth/tokens';

describe('cookies', () => {
  test('lerCookie', () => {
    expect(lerCookie('a=1; truco_sessao=abc%2Dd; b=2', COOKIE_SESSAO)).toBe('abc-d');
    expect(lerCookie('a=1', COOKIE_SESSAO)).toBeNull();
    expect(lerCookie(undefined, COOKIE_SESSAO)).toBeNull();
    expect(lerCookie('truco_sessao=%E0%A4%A', COOKIE_SESSAO)).toBeNull();
  });

  test('cookieSessao e cookieApagado', () => {
    expect(cookieSessao('tok', { seguro: false, maxAgeS: 60 })).toBe('truco_sessao=tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=60');
    expect(cookieSessao('tok', { seguro: true, maxAgeS: 60 })).toMatch(/; Secure$/);
    expect(cookieApagado(false)).toBe('truco_sessao=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  });

  test('bearer', () => {
    expect(bearer('Bearer xyz')).toBe('xyz');
    expect(bearer('Basic xyz')).toBeNull();
    expect(bearer(undefined)).toBeNull();
  });
});

describe('LimiteTaxa', () => {
  test('máximo por janela, por chave', () => {
    let t = 0;
    const l = new LimiteTaxa(2, 1_000, () => t);
    expect([l.permitir('ip'), l.permitir('ip'), l.permitir('ip'), l.permitir('outro')]).toEqual([true, true, false, true]);
    t = 1_001;
    expect(l.permitir('ip')).toBe(true);
  });
});

describe('e-mails', () => {
  test('emailDoLink e extrairLink', () => {
    const e = emailDoLink('http://x.test/#/entrar?token=abc', 'ana@x.com');
    expect(e.para).toBe('ana@x.com');
    expect(e.assunto).toBe('Seu link para entrar no Truco');
    expect(e.html).toContain('href="http://x.test/#/entrar?token=abc"');
    expect(extrairLink(e.texto)).toBe('http://x.test/#/entrar?token=abc');
  });

  test('caixa de teste guarda em memória', async () => {
    const c = new CaixaDeTeste();
    await c.enviar(emailDoLink('http://l', 'a@x.com'));
    expect(c.enviados).toHaveLength(1);
  });

  test('console imprime o link (dev sem RESEND_API_KEY)', async () => {
    const log = vi.fn();
    await emailsConsole(log).enviar(emailDoLink('http://l/#/entrar?token=1', 'a@x.com'));
    expect(log.mock.calls[0][0]).toContain('http://l/#/entrar?token=1');
  });

  test('Resend: POST com Bearer e JSON; erro HTTP vira exceção', async () => {
    const f = vi.fn(async () => new Response('{"id":"1"}', { status: 200 }));
    await emailsResend({ chave: 're_x', remetente: 'Truco <t@x.com>', fetch: f }).enviar(emailDoLink('http://l', 'a@x.com'));
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_x');
    expect(JSON.parse(init.body as string)).toMatchObject({ from: 'Truco <t@x.com>', to: ['a@x.com'], subject: 'Seu link para entrar no Truco' });
    const ruim = vi.fn(async () => new Response('quota', { status: 429 }));
    await expect(emailsResend({ chave: 'k', remetente: 'r', fetch: ruim }).enviar(emailDoLink('http://l', 'a@x.com'))).rejects.toThrow('Resend 429');
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test auth-util`
Expected: FAIL — exports inexistentes.

**Step 3: Implementação**

Acrescente ao fim de `apps/server/src/auth/tokens.ts`:
```ts
export const COOKIE_SESSAO = 'truco_sessao';

export function lerCookie(cabecalho: string | null | undefined, nome: string): string | null {
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0 || parte.slice(0, i).trim() !== nome) continue;
    try {
      return decodeURIComponent(parte.slice(i + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function bearer(cabecalho: string | null | undefined): string | null {
  const m = cabecalho?.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

const BASE_COOKIE = `Path=/; HttpOnly; SameSite=Lax`;

export function cookieSessao(token: string, o: { seguro: boolean; maxAgeS: number }): string {
  return `${COOKIE_SESSAO}=${encodeURIComponent(token)}; ${BASE_COOKIE}; Max-Age=${o.maxAgeS}${o.seguro ? '; Secure' : ''}`;
}

export function cookieApagado(seguro: boolean): string {
  return `${COOKIE_SESSAO}=; ${BASE_COOKIE}; Max-Age=0${seguro ? '; Secure' : ''}`;
}
```

`apps/server/src/auth/limite.ts`
```ts
/** Janela deslizante em memória (um processo). Suficiente para o pedido de link. */
export class LimiteTaxa {
  private readonly batidas = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly janelaMs: number,
    private readonly agora: () => number = Date.now,
  ) {}

  permitir(chave: string): boolean {
    const t = this.agora();
    const desde = t - this.janelaMs;
    const lista = (this.batidas.get(chave) ?? []).filter((x) => x > desde);
    if (lista.length >= this.max) {
      this.batidas.set(chave, lista);
      return false;
    }
    lista.push(t);
    this.batidas.set(chave, lista);
    if (this.batidas.size > 10_000) this.limpar(desde);
    return true;
  }

  private limpar(desde: number): void {
    for (const [k, v] of this.batidas) if (v.every((x) => x <= desde)) this.batidas.delete(k);
  }
}
```

`apps/server/src/auth/emails.ts`
```ts
export interface Email {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

export interface Emails {
  enviar(e: Email): Promise<void>;
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function emailDoLink(url: string, para: string): Email {
  return {
    para,
    assunto: 'Seu link para entrar no Truco',
    texto: `Para entrar no Truco, abra este link (vale por 15 minutos, uma vez só):\n\n${url}\n\nSe não foi você, ignore este e-mail.`,
    html: `<p>Para entrar no Truco, clique no link abaixo (vale por 15 minutos, uma vez só):</p><p><a href="${escapar(url)}">Entrar no Truco</a></p><p>Se não foi você, ignore este e-mail.</p>`,
  };
}

export function extrairLink(texto: string): string | null {
  return texto.match(/https?:\/\/\S+/)?.[0] ?? null;
}

/** Dev sem RESEND_API_KEY: o link aparece no console do servidor. */
export function emailsConsole(log: (msg: string) => void = console.log): Emails {
  return {
    async enviar(e) {
      log(`[e-mail para ${e.para}] ${e.assunto}\n${e.texto}`);
    },
  };
}

/** E2E (`TRUCO_EMAIL_TESTE=1`): guarda em memória e `GET /api/teste/emails` expõe. */
export class CaixaDeTeste implements Emails {
  readonly enviados: Email[] = [];
  async enviar(e: Email): Promise<void> {
    this.enviados.push(e);
    if (this.enviados.length > 200) this.enviados.shift();
  }
}

export function emailsResend(o: { chave: string; remetente: string; fetch?: typeof fetch }): Emails {
  const f = o.fetch ?? fetch;
  return {
    async enviar(e) {
      const r = await f('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${o.chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: o.remetente, to: [e.para], subject: e.assunto, text: e.texto, html: e.html }),
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    },
  };
}
```

`apps/server/src/auth/google.ts` (substitui o arquivo da Tarefa 5):
```ts
import { OAuth2Client } from 'google-auth-library';

export interface PerfilGoogle {
  sub: string;
  email: string | null;
  emailVerificado: boolean;
  nome: string | null;
}

export type VerificadorGoogle = (credencial: string) => Promise<PerfilGoogle>;

/**
 * Valida o ID token do Google Identity Services (assinatura, `aud` = nosso client ID,
 * expiração). Adaptador fino: os testes usam um verificador falso.
 */
export function verificadorGoogle(clientId: string): VerificadorGoogle {
  const cliente = new OAuth2Client(clientId);
  return async (credencial) => {
    const ticket = await cliente.verifyIdToken({ idToken: credencial, audience: clientId });
    const p = ticket.getPayload();
    if (!p?.sub) throw new Error('token do Google sem sub');
    return { sub: p.sub, email: p.email ?? null, emailVerificado: p.email_verified === true, nome: p.given_name ?? p.name ?? null };
  };
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test auth-util`
Expected: PASS (9 testes).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src/auth apps/server/test/auth-util.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): cookies de sessão, limite de taxa, e-mail (Resend/console/teste) e verificação do Google" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Serviços e configuração a partir do ambiente

**Files:**
- Create: `apps/server/src/servicos.ts`
- Test: `apps/server/test/servicos.test.ts`

**Step 1: Teste que falha**

`apps/server/test/servicos.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { configDoAmbiente } from '../src/servicos';

const PADROES = { pastaPglite: '/dados/pglite' };

describe('configDoAmbiente', () => {
  test('dev sem nada: PGlite em disco, console, sem Google, sem avisos', () => {
    expect(configDoAmbiente({}, PADROES)).toEqual({
      producao: false,
      databaseUrl: null,
      pastaPglite: '/dados/pglite',
      resend: null,
      googleClientId: null,
      urlPublica: null,
      emailTeste: false,
      kElo: 32,
      origens: [],
      avisos: [],
    });
  });

  test('TRUCO_PGLITE=memoria e caminho próprio', () => {
    expect(configDoAmbiente({ TRUCO_PGLITE: 'memoria' }, PADROES).pastaPglite).toBeNull();
    expect(configDoAmbiente({ TRUCO_PGLITE: 'C:/x' }, PADROES).pastaPglite).toBe('C:/x');
  });

  test('produção completa (Railway)', () => {
    const c = configDoAmbiente(
      {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://u:p@h/db',
        RESEND_API_KEY: 're_1',
        TRUCO_EMAIL_REMETENTE: 'Truco <oi@truco.app>',
        GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com',
        RAILWAY_PUBLIC_DOMAIN: 'truco.up.railway.app',
        TRUCO_ORIGENS: 'https://truco.app, https://www.truco.app',
        TRUCO_K_ELO: '24',
      },
      PADROES,
    );
    expect(c).toMatchObject({
      producao: true,
      databaseUrl: 'postgres://u:p@h/db',
      pastaPglite: null,
      resend: { chave: 're_1', remetente: 'Truco <oi@truco.app>' },
      googleClientId: 'cid.apps.googleusercontent.com',
      urlPublica: 'https://truco.up.railway.app',
      kElo: 24,
      origens: ['https://truco.app', 'https://www.truco.app'],
      avisos: [],
    });
  });

  test('TRUCO_URL_PUBLICA vence o domínio do Railway e perde a barra final', () => {
    expect(configDoAmbiente({ TRUCO_URL_PUBLICA: 'https://truco.app/', RAILWAY_PUBLIC_DOMAIN: 'x' }, PADROES).urlPublica).toBe('https://truco.app');
  });

  test('caixa de teste: liga com TRUCO_EMAIL_TESTE=1 ou NODE_ENV=test; nunca em produção', () => {
    expect(configDoAmbiente({ TRUCO_EMAIL_TESTE: '1' }, PADROES).emailTeste).toBe(true);
    expect(configDoAmbiente({ NODE_ENV: 'test' }, PADROES).emailTeste).toBe(true);
    const p = configDoAmbiente({ NODE_ENV: 'production', TRUCO_EMAIL_TESTE: '1', DATABASE_URL: 'x', TRUCO_URL_PUBLICA: 'https://a' }, PADROES);
    expect(p.emailTeste).toBe(false);
    expect(p.avisos).toContainEqual(expect.stringContaining('TRUCO_EMAIL_TESTE'));
  });

  test('produção sem banco nem URL pública gera avisos; K inválido volta a 32', () => {
    const c = configDoAmbiente({ NODE_ENV: 'production', TRUCO_K_ELO: '500' }, PADROES);
    expect(c.kElo).toBe(32);
    expect(c.avisos).toEqual([expect.stringContaining('DATABASE_URL'), expect.stringContaining('URL pública'), expect.stringContaining('RESEND_API_KEY')]);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test servicos`
Expected: FAIL — módulo inexistente.

**Step 3: Implementação**

`apps/server/src/servicos.ts`
```ts
import { abrirBanco, type Banco } from './banco/banco';
import { CaixaDeTeste, type Emails, emailsConsole, emailsResend } from './auth/emails';
import { type VerificadorGoogle, verificadorGoogle } from './auth/google';
import { K_PADRAO } from './ranking/elo';

/** Tudo de que HTTP, salas e registro precisam. Os testes montam um com `servicosDeTeste`. */
export interface Servicos {
  banco: Banco;
  emails: Emails;
  caixaTeste: CaixaDeTeste | null;
  google: { clientId: string; verificar: VerificadorGoogle } | null;
  /** Base dos links mágicos; null = origem do pedido (dev). */
  urlPublica: string | null;
  producao: boolean;
  /** Origens extras aceitas no CORS em produção. */
  origens: string[];
  kElo: number;
  bloqueioAbandonoMs: number;
  agora: () => Date;
}

export interface ConfigAmbiente {
  producao: boolean;
  databaseUrl: string | null;
  /** null = PGlite em memória (ou Postgres, se há `databaseUrl`). */
  pastaPglite: string | null;
  resend: { chave: string; remetente: string } | null;
  googleClientId: string | null;
  urlPublica: string | null;
  emailTeste: boolean;
  kElo: number;
  origens: string[];
  avisos: string[];
}

type Env = Record<string, string | undefined>;

const vazio = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

export function configDoAmbiente(env: Env, padroes: { pastaPglite: string }): ConfigAmbiente {
  const avisos: string[] = [];
  const producao = env.NODE_ENV === 'production';
  const databaseUrl = vazio(env.DATABASE_URL);
  const pg = vazio(env.TRUCO_PGLITE);
  const pastaPglite = databaseUrl || pg === 'memoria' ? null : (pg ?? padroes.pastaPglite);
  if (producao && !databaseUrl) avisos.push('produção sem DATABASE_URL: usando PGlite (dados somem se o disco não for persistente)');

  const railway = vazio(env.RAILWAY_PUBLIC_DOMAIN);
  const urlPublica = (vazio(env.TRUCO_URL_PUBLICA) ?? (railway ? `https://${railway}` : null))?.replace(/\/+$/, '') ?? null;
  if (producao && !urlPublica) avisos.push('produção sem URL pública (TRUCO_URL_PUBLICA ou RAILWAY_PUBLIC_DOMAIN): links mágicos usarão o Host do pedido');

  const chave = vazio(env.RESEND_API_KEY);
  const resend = chave ? { chave, remetente: vazio(env.TRUCO_EMAIL_REMETENTE) ?? 'Truco <onboarding@resend.dev>' } : null;

  let emailTeste = env.TRUCO_EMAIL_TESTE === '1' || env.NODE_ENV === 'test';
  if (producao && emailTeste) {
    emailTeste = false;
    avisos.push('TRUCO_EMAIL_TESTE ignorada em produção');
  }
  if (producao && !resend && !emailTeste) avisos.push('produção sem RESEND_API_KEY: links mágicos só aparecem no log');

  const k = Number(env.TRUCO_K_ELO);
  const kElo = Number.isInteger(k) && k >= 1 && k <= 100 ? k : K_PADRAO;
  const origens = (env.TRUCO_ORIGENS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return { producao, databaseUrl, pastaPglite, resend, googleClientId: vazio(env.GOOGLE_CLIENT_ID), urlPublica, emailTeste, kElo, origens, avisos };
}

export const BLOQUEIO_ABANDONO_MS = 5 * 60_000;

export async function servicosDoAmbiente(
  env: Env,
  padroes: { pastaPglite: string },
): Promise<{ servicos: Servicos; config: ConfigAmbiente; fechar: () => Promise<void> }> {
  const config = configDoAmbiente(env, padroes);
  const conexao = await abrirBanco({ url: config.databaseUrl ?? undefined, pastaPglite: config.pastaPglite ?? undefined });
  const caixa = config.emailTeste ? new CaixaDeTeste() : null;
  const emails = caixa ?? (config.resend ? emailsResend(config.resend) : emailsConsole());
  const google = config.googleClientId ? { clientId: config.googleClientId, verificar: verificadorGoogle(config.googleClientId) } : null;
  return {
    config,
    fechar: conexao.fechar,
    servicos: {
      banco: conexao.db,
      emails,
      caixaTeste: caixa,
      google,
      urlPublica: config.urlPublica,
      producao: config.producao,
      origens: config.origens,
      kElo: config.kElo,
      bloqueioAbandonoMs: BLOQUEIO_ABANDONO_MS,
      agora: () => new Date(),
    },
  };
}

/** Para testes: caixa de teste, sem Google, URL pública fixa. */
export function servicosDeTeste(banco: Banco, extra: Partial<Servicos> = {}): Servicos {
  const caixa = new CaixaDeTeste();
  return {
    banco,
    emails: caixa,
    caixaTeste: caixa,
    google: null,
    urlPublica: 'http://truco.test',
    producao: false,
    origens: [],
    kElo: K_PADRAO,
    bloqueioAbandonoMs: BLOQUEIO_ABANDONO_MS,
    agora: () => new Date(),
    ...extra,
  };
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test servicos`
Expected: PASS (6 testes).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src/servicos.ts apps/server/test/servicos.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): serviços e configuração a partir do ambiente (sem segredos obrigatórios)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: HTTP — app Express com login por link mágico, Google, sessão e apelido

**Files:**
- Create: `apps/server/src/http/app.ts`, `apps/server/test/http-helpers.ts`
- Test: `apps/server/test/http-auth.test.ts`

**Step 1: Teste que falha**

`apps/server/test/http-helpers.ts`
```ts
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { configurarApp, type ExtrasApp } from '../src/http/app';
import type { Servicos } from '../src/servicos';

export interface Resposta {
  status: number;
  json: any;
  texto: string;
  setCookie: string | null;
  headers: Headers;
}

/** Sobe só o Express (sem Colyseus) numa porta efêmera. */
export async function subirApp(servicos: Servicos, extras: ExtrasApp = {}) {
  const app = express();
  configurarApp(app, servicos, extras);
  const srv = await new Promise<Server>((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s));
  });
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  async function pedir(caminho: string, o: { metodo?: string; corpo?: unknown; cookie?: string; tipo?: string; auth?: string } = {}): Promise<Resposta> {
    const headers: Record<string, string> = {};
    if (o.corpo !== undefined) headers['content-type'] = o.tipo ?? 'application/json';
    if (o.cookie) headers.cookie = o.cookie;
    if (o.auth) headers.authorization = o.auth;
    const r = await fetch(base + caminho, {
      method: o.metodo ?? (o.corpo !== undefined ? 'POST' : 'GET'),
      headers,
      body: o.corpo === undefined ? undefined : typeof o.corpo === 'string' ? o.corpo : JSON.stringify(o.corpo),
    });
    const texto = await r.text();
    let json: any = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      // não era JSON (ex.: index.html)
    }
    return { status: r.status, json, texto, setCookie: r.headers.get('set-cookie'), headers: r.headers };
  }
  return { base, pedir, fechar: () => new Promise<void>((ok) => srv.close(() => ok())) };
}

/** "nome=valor" do Set-Cookie, para mandar de volta em `cookie`. */
export const cookieDe = (setCookie: string | null): string => setCookie?.split(';')[0] ?? '';

export const tokenDoLink = (link: string): string => new URL(link.replace('/#/', '/')).searchParams.get('token') ?? '';
```

`apps/server/test/http-auth.test.ts`
```ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { extrairLink } from '../src/auth/emails';
import { LimiteTaxa } from '../src/auth/limite';
import { criarUsuario } from '../src/repo/usuarios';
import { type Servicos, servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';
import { cookieDe, subirApp, tokenDoLink } from './http-helpers';

let b: BancoDeTeste;
let s: Servicos;
let app: Awaited<ReturnType<typeof subirApp>>;

beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(async () => {
  await b.limpar();
  s = servicosDeTeste(b.db, {
    google: {
      clientId: 'cid-teste',
      verificar: async (c) => {
        if (c !== 'credencial-boa') throw new Error('assinatura inválida');
        return { sub: 'g-1', email: 'bia@x.com', emailVerificado: true, nome: 'Bia' };
      },
    },
  });
  app = await subirApp(s, { limiteLinkIp: new LimiteTaxa(2, 60_000) });
});
afterEach(() => app.fechar());
afterAll(() => b.fechar());

async function entrarPorLink(email: string): Promise<string> {
  expect((await app.pedir('/api/auth/link', { corpo: { email } })).status).toBe(204);
  const link = extrairLink(s.caixaTeste!.enviados.at(-1)!.texto)!;
  const r = await app.pedir('/api/auth/link/confirmar', { corpo: { token: tokenDoLink(link) } });
  expect(r.status).toBe(200);
  return cookieDe(r.setCookie);
}

describe('config e sessão', () => {
  test('config pública', async () => {
    const r = await app.pedir('/api/config');
    expect(r.json).toEqual({ google: 'cid-teste', emailTeste: true });
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  test('sem cookie: usuário nulo', async () => {
    expect((await app.pedir('/api/eu')).json).toEqual({ usuario: null });
  });
});

describe('link mágico', () => {
  test('pedir → e-mail com link no fragmento → confirmar → cookie de sessão', async () => {
    const r = await app.pedir('/api/auth/link', { corpo: { email: ' Ana@X.com ' } });
    expect(r.status).toBe(204);
    const e = s.caixaTeste!.enviados[0];
    expect(e.para).toBe('ana@x.com');
    const link = extrairLink(e.texto)!;
    expect(link).toMatch(/^http:\/\/truco\.test\/#\/entrar\?token=[A-Za-z0-9_-]{43}$/);

    const c = await app.pedir('/api/auth/link/confirmar', { corpo: { token: tokenDoLink(link) } });
    expect(c.status).toBe(200);
    expect(c.json.usuario).toMatchObject({ apelido: 'ana', email: 'ana@x.com' });
    expect(c.setCookie).toMatch(/^truco_sessao=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/);

    const eu = await app.pedir('/api/eu', { cookie: cookieDe(c.setCookie) });
    expect(eu.json.usuario.apelido).toBe('ana');

    const deNovo = await app.pedir('/api/auth/link/confirmar', { corpo: { token: tokenDoLink(link) } });
    expect(deNovo.status).toBe(400);
    expect(deNovo.json.erro).toMatch(/inválido ou expirado/);
  });

  test('e-mail inválido → 400; limite por IP → 429', async () => {
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'nada' } })).status).toBe(400);
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'a@x.com' } })).status).toBe(204);
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'b@x.com' } })).status).toBe(204);
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'c@x.com' } })).status).toBe(429);
  });

  test('POST sem JSON → 415; JSON quebrado → 400', async () => {
    expect((await app.pedir('/api/auth/link', { corpo: 'email=a@x.com', tipo: 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect((await app.pedir('/api/auth/link', { corpo: '{quebrado' })).status).toBe(400);
  });

  test('falha do provedor de e-mail → 502', async () => {
    await app.fechar();
    app = await subirApp({ ...s, emails: { enviar: async () => Promise.reject(new Error('fora do ar')) } });
    expect((await app.pedir('/api/auth/link', { corpo: { email: 'a@x.com' } })).status).toBe(502);
  });
});

describe('sair, Bearer e apelido', () => {
  test('sair apaga a sessão e o cookie', async () => {
    const cookie = await entrarPorLink('ana@x.com');
    const r = await app.pedir('/api/auth/sair', { corpo: {}, cookie });
    expect(r.status).toBe(204);
    expect(r.setCookie).toMatch(/Max-Age=0/);
    expect((await app.pedir('/api/eu', { cookie })).json.usuario).toBeNull();
  });

  test('token de sessão também vale como Bearer', async () => {
    const cookie = await entrarPorLink('ana@x.com');
    const token = cookie.split('=')[1];
    expect((await app.pedir('/api/eu', { auth: `Bearer ${token}` })).json.usuario.apelido).toBe('ana');
  });

  test('trocar apelido: 401 sem login, 400 inválido, 409 em uso, 200 ok', async () => {
    await criarUsuario(b.db, { apelidoBase: 'bia' });
    expect((await app.pedir('/api/eu', { metodo: 'PATCH', corpo: { apelido: 'Novo' } })).status).toBe(401);
    const cookie = await entrarPorLink('ana@x.com');
    expect((await app.pedir('/api/eu', { metodo: 'PATCH', corpo: { apelido: 'ab' }, cookie })).status).toBe(400);
    expect((await app.pedir('/api/eu', { metodo: 'PATCH', corpo: { apelido: 'bia' }, cookie })).status).toBe(409);
    const ok = await app.pedir('/api/eu', { metodo: 'PATCH', corpo: { apelido: 'Aninha' }, cookie });
    expect(ok.status).toBe(200);
    expect(ok.json.usuario.apelido).toBe('Aninha');
  });
});

describe('Google', () => {
  test('credencial boa cria/entra; ruim → 401; desligado → 404', async () => {
    const r = await app.pedir('/api/auth/google', { corpo: { credencial: 'credencial-boa' } });
    expect(r.status).toBe(200);
    expect(r.json.usuario).toMatchObject({ apelido: 'Bia', email: 'bia@x.com' });
    expect(r.setCookie).toMatch(/^truco_sessao=/);
    expect((await app.pedir('/api/auth/google', { corpo: { credencial: 'falsa' } })).status).toBe(401);
    await app.fechar();
    app = await subirApp({ ...s, google: null });
    expect((await app.pedir('/api/auth/google', { corpo: { credencial: 'credencial-boa' } })).status).toBe(404);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test http-auth`
Expected: FAIL — `Failed to load url ../src/http/app`.

**Step 3: Implementação**

`apps/server/src/http/app.ts`
```ts
import { sql } from 'drizzle-orm';
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import type { SalaAberta } from '../api/tipos';
import { emailDoLink } from '../auth/emails';
import { LimiteTaxa } from '../auth/limite';
import { bearer, COOKIE_SESSAO, cookieApagado, cookieSessao, lerCookie } from '../auth/tokens';
import {
  consumirLinkMagico,
  criarLinkMagico,
  criarSessao,
  DURACAO_SESSAO_MS,
  encerrarSessao,
  entrarComEmail,
  entrarComGoogle,
  normalizarEmail,
  trocarApelido,
  type Usuario,
  usuarioDaSessao,
  usuarioPorId,
} from '../repo/usuarios';
import type { Servicos } from '../servicos';

export interface ExtrasApp {
  /** Mesas casuais abertas (o servidor passa `listarSalasAbertas`). */
  listarSalas?: () => Promise<SalaAberta[]>;
  /** Pasta do build do web; ausente/null = não serve estáticos (dev usa o Vite). */
  pastaWeb?: string | null;
  limiteLinkIp?: LimiteTaxa;
  limiteLinkEmail?: LimiteTaxa;
}

const tokenDe = (req: Request): string | null => lerCookie(req.headers.cookie, COOKIE_SESSAO) ?? bearer(req.headers.authorization);

/** Em dev (sem URL pública) o link volta para quem pediu: o Vite em :5173 manda `Origin`. */
function origemDoPedido(req: Request, producao: boolean): string {
  const origem = producao ? undefined : req.get('origin');
  return origem ?? `${req.protocol}://${req.get('host')}`;
}

export function configurarApp(app: Application, s: Servicos, x: ExtrasApp = {}): void {
  const limiteIp = x.limiteLinkIp ?? new LimiteTaxa(5, 15 * 60_000);
  const limiteEmail = x.limiteLinkEmail ?? new LimiteTaxa(3, 15 * 60_000);
  const usuarioDe = (req: Request) => usuarioDaSessao(s.banco, tokenDe(req), s.agora());
  const entrar = async (res: Response, u: Usuario) => {
    const token = await criarSessao(s.banco, u.id, s.agora());
    res.setHeader('Set-Cookie', cookieSessao(token, { seguro: s.producao, maxAgeS: Math.floor(DURACAO_SESSAO_MS / 1000) }));
    res.json({ usuario: u });
  };

  // Railway (e qualquer proxy na frente) manda X-Forwarded-For/Proto: `req.ip` e `req.protocol` corretos.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.get('/saude', async (_req, res) => {
    await s.banco.execute(sql`select 1`);
    res.json({ ok: true });
  });

  const api = express.Router();
  api.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Exigir JSON força preflight em pedidos de outra origem (junto com SameSite=Lax, contra CSRF).
    if (req.method !== 'GET' && req.method !== 'HEAD' && !req.is('application/json')) {
      res.status(415).json({ erro: 'use Content-Type: application/json' });
      return;
    }
    next();
  });
  api.use(express.json({ limit: '16kb' }));

  api.get('/config', (_req, res) => {
    res.json({ google: s.google?.clientId ?? null, emailTeste: s.caixaTeste !== null });
  });

  api.get('/eu', async (req, res) => {
    res.json({ usuario: await usuarioDe(req) });
  });

  api.patch('/eu', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    const r = await trocarApelido(s.banco, u.id, req.body?.apelido);
    if (r === 'invalido') return void res.status(400).json({ erro: 'o apelido precisa ter de 3 a 20 caracteres' });
    if (r === 'em-uso') return void res.status(409).json({ erro: 'esse apelido já tem dono' });
    res.json({ usuario: await usuarioPorId(s.banco, u.id) });
  });

  api.post('/auth/link', async (req, res) => {
    const email = normalizarEmail(req.body?.email);
    if (!email) return void res.status(400).json({ erro: 'e-mail inválido' });
    if (!limiteIp.permitir(req.ip ?? '?') || !limiteEmail.permitir(email)) {
      return void res.status(429).json({ erro: 'muitos pedidos; tente de novo em alguns minutos' });
    }
    const token = await criarLinkMagico(s.banco, email, s.agora());
    const base = s.urlPublica ?? origemDoPedido(req, s.producao);
    try {
      await s.emails.enviar(emailDoLink(`${base}/#/entrar?token=${token}`, email));
    } catch (e) {
      console.error('[auth] falha ao enviar o e-mail', e);
      return void res.status(502).json({ erro: 'não foi possível enviar o e-mail agora' });
    }
    res.status(204).end();
  });

  api.post('/auth/link/confirmar', async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const email = await consumirLinkMagico(s.banco, token, s.agora());
    if (!email) return void res.status(400).json({ erro: 'link inválido ou expirado; peça outro' });
    await entrar(res, await entrarComEmail(s.banco, email));
  });

  api.post('/auth/google', async (req, res) => {
    if (!s.google) return void res.status(404).json({ erro: 'login com Google desligado' });
    const credencial = typeof req.body?.credencial === 'string' ? req.body.credencial : '';
    let perfilGoogle;
    try {
      perfilGoogle = await s.google.verificar(credencial);
    } catch {
      return void res.status(401).json({ erro: 'não foi possível validar o login do Google' });
    }
    await entrar(res, await entrarComGoogle(s.banco, perfilGoogle));
  });

  api.post('/auth/sair', async (req, res) => {
    const t = tokenDe(req);
    if (t) await encerrarSessao(s.banco, t);
    res.setHeader('Set-Cookie', cookieApagado(s.producao));
    res.status(204).end();
  });

  // (Tarefa 10: perfil, histórico, ranking, salas e caixa de teste entram aqui.)

  api.use((_req, res) => {
    res.status(404).json({ erro: 'não encontrado' });
  });
  app.use('/api', api);

  // (Tarefa 10: estáticos e fallback da SPA entram aqui.)

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const tipo = (err as { type?: string } | null)?.type;
    if (tipo === 'entity.parse.failed') return void res.status(400).json({ erro: 'JSON inválido' });
    if (tipo === 'entity.too.large') return void res.status(413).json({ erro: 'pedido grande demais' });
    console.error('[http]', err);
    res.status(500).json({ erro: 'erro interno' });
  });
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test http-auth`
Expected: PASS (11 testes).

Run: `pnpm --filter @truco/server typecheck` → sem erros.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src/http apps/server/test/http-helpers.ts apps/server/test/http-auth.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): API de login (link mágico, Google), sessão por cookie e troca de apelido" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: HTTP — perfil, histórico, ranking, salas, caixa de teste, estáticos da SPA e CORS

**Files:**
- Modify: `apps/server/src/http/app.ts`
- Create: `apps/server/src/http/cors.ts`
- Test: `apps/server/test/http-dados.test.ts`

**Step 1: Teste que falha**

`apps/server/test/http-dados.test.ts`
```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { cabecalhosCors } from '../src/http/cors';
import { contadoresZerados } from '../src/ranking/estatisticas';
import { iniciarPartida, terminarPartida } from '../src/repo/partidas';
import { criarSessao, criarUsuario } from '../src/repo/usuarios';
import { type Servicos, servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';
import { subirApp } from './http-helpers';

let b: BancoDeTeste;
let s: Servicos;
let app: Awaited<ReturnType<typeof subirApp>>;
let pastaWeb: string;

beforeAll(async () => {
  b = await bancoDeTeste();
  pastaWeb = mkdtempSync(join(tmpdir(), 'truco-web-'));
  writeFileSync(join(pastaWeb, 'index.html'), '<!doctype html><div id="raiz"></div>');
  mkdirSync(join(pastaWeb, 'assets'));
  writeFileSync(join(pastaWeb, 'assets', 'app.js'), 'console.log(1)');
}, 30_000);
beforeEach(async () => {
  await b.limpar();
  s = servicosDeTeste(b.db);
  app = await subirApp(s, {
    pastaWeb,
    listarSalas: async () => [
      { id: 'abc', modo: 'classica', variante: 'paulista', humanos: 2, nivelBot: 'facil', regras: null, ocupados: 1, dono: 'Ana' },
    ],
  });
});
afterEach(() => app.fechar());
afterAll(() => b.fechar());

async function partidaRanqueada() {
  const ana = await criarUsuario(b.db, { apelidoBase: 'ana' });
  const bia = await criarUsuario(b.db, { apelidoBase: 'bia' });
  const id = await iniciarPartida(
    b.db,
    {
      variante: 'mineiro',
      modo: 'ranqueada',
      formato: '1x1',
      assentos: [
        { cadeira: 0, usuarioId: ana.id, nome: 'ana', humano: true },
        { cadeira: 1, usuarioId: bia.id, nome: 'bia', humano: true },
        { cadeira: 2, usuarioId: null, nome: 'Bot', humano: false },
        { cadeira: 3, usuarioId: null, nome: 'Bot', humano: false },
      ],
    },
    new Date(),
  );
  await terminarPartida(b.db, id, { placar: [12, 4], vencedora: 0, contadores: [0, 1, 2, 3].map(contadoresZerados) }, { k: 32, agora: new Date() });
  return { ana, bia, cookieAna: `truco_sessao=${await criarSessao(b.db, ana.id, new Date())}` };
}

describe('dados', () => {
  test('perfil próprio exige login; perfil público por id', async () => {
    const { ana, bia, cookieAna } = await partidaRanqueada();
    expect((await app.pedir('/api/perfil')).status).toBe(401);
    const meu = await app.pedir('/api/perfil', { cookie: cookieAna });
    expect(meu.json.usuario).toEqual({ id: ana.id, apelido: 'ana' });
    expect(meu.json.variantes.mineiro).toMatchObject({ elo: 1016, pontos: 16, patente: 'Bronze', vitorias: 1 });
    expect((await app.pedir(`/api/perfil/${bia.id}`)).json.variantes.mineiro.elo).toBe(984);
    expect((await app.pedir('/api/perfil/999')).status).toBe(404);
    expect((await app.pedir('/api/perfil/abc')).status).toBe(400);
  });

  test('histórico do usuário logado', async () => {
    const { cookieAna } = await partidaRanqueada();
    expect((await app.pedir('/api/historico')).status).toBe(401);
    const h = await app.pedir('/api/historico', { cookie: cookieAna });
    expect(h.json.partidas).toEqual([expect.objectContaining({ variante: 'mineiro', nos: 12, eles: 4, venceu: true, deltaElo: 16 })]);
  });

  test('ranking por variante', async () => {
    await partidaRanqueada();
    const r = await app.pedir('/api/ranking/mineiro');
    expect(r.json.linhas.map((l: any) => l.apelido)).toEqual(['ana', 'bia']);
    expect((await app.pedir('/api/ranking/gaucho')).status).toBe(400);
  });

  test('salas abertas', async () => {
    expect((await app.pedir('/api/salas')).json.salas).toHaveLength(1);
  });

  test('caixa de teste: só quando ligada', async () => {
    await app.pedir('/api/auth/link', { corpo: { email: 'ana@x.com' } });
    const r = await app.pedir('/api/teste/emails');
    expect(r.json.emails).toEqual([{ para: 'ana@x.com', assunto: 'Seu link para entrar no Truco', link: expect.stringMatching(/#\/entrar\?token=/) }]);
    await app.fechar();
    app = await subirApp({ ...s, caixaTeste: null });
    expect((await app.pedir('/api/teste/emails')).status).toBe(404);
  });

  test('/saude', async () => {
    const r = await app.pedir('/saude');
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
  });
});

describe('estáticos da SPA', () => {
  test('/ e rotas desconhecidas servem o index.html; assets e /api seguem seu caminho', async () => {
    const raiz = await app.pedir('/');
    expect(raiz.status).toBe(200);
    expect(raiz.texto).toContain('<div id="raiz">');
    expect(raiz.headers.get('cache-control')).toBe('no-cache');
    expect((await app.pedir('/qualquer/coisa')).texto).toContain('<div id="raiz">');
    expect((await app.pedir('/assets/app.js')).texto).toBe('console.log(1)');
    const api = await app.pedir('/api/nao-existe');
    expect(api.status).toBe(404);
    expect(api.json).toEqual({ erro: 'não encontrado' });
  });
});

describe('cabecalhosCors', () => {
  const PROD = { producao: true, origens: ['https://truco.app'] };
  test('dev reflete qualquer origem', () => {
    expect(cabecalhosCors('http://localhost:5173', 'localhost:2567', { producao: false, origens: [] })).toEqual({
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      Vary: 'Origin',
    });
  });
  test('produção: só a própria origem ou as listadas', () => {
    expect(cabecalhosCors('https://x.up.railway.app', 'x.up.railway.app', PROD)['Access-Control-Allow-Origin']).toBe('https://x.up.railway.app');
    expect(cabecalhosCors('https://truco.app', 'x.up.railway.app', PROD)['Access-Control-Allow-Origin']).toBe('https://truco.app');
    expect(cabecalhosCors('https://malicioso.com', 'x.up.railway.app', PROD)).toEqual({});
    expect(cabecalhosCors('lixo', 'x', PROD)).toEqual({});
    expect(cabecalhosCors(null, 'x', PROD)).toEqual({});
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test http-dados`
Expected: FAIL — `cors` inexistente; rotas de dados 404.

**Step 3: Implementação**

`apps/server/src/http/cors.ts`
```ts
import { matchMaker } from '@colyseus/core';

const permitir = (origem: string) => ({ 'Access-Control-Allow-Origin': origem, Vary: 'Origin' });

/**
 * Cabeçalhos que o Colyseus soma aos padrões (`Allow-Origin: *`, `Allow-Credentials: true`).
 * Devolver `{}` deixa o `*`, que o navegador recusa em pedidos com credenciais.
 */
export function cabecalhosCors(
  origem: string | null,
  host: string | null,
  o: { producao: boolean; origens: readonly string[] },
): Record<string, string> {
  if (!origem) return {};
  if (!o.producao) return permitir(origem);
  let mesmoHost = false;
  try {
    mesmoHost = new URL(origem).host === host;
  } catch {
    return {};
  }
  return mesmoHost || o.origens.includes(origem) ? permitir(origem) : {};
}

/** Vale para TODO pedido HTTP do servidor (o Colyseus aplica num listener prefixado). */
export function instalarCors(o: { producao: boolean; origens: readonly string[] }): void {
  matchMaker.controller.getCorsHeaders = (headers: Headers) => cabecalhosCors(headers.get('origin'), headers.get('host'), o);
}
```

Em `apps/server/src/http/app.ts`:
- imports: acrescente `import type { Variante } from '@truco/engine';`, `import { extrairLink } from '../auth/emails';` (junto do `emailDoLink`), `import { VARIANTES } from '../banco/schema';` e `import { historico, perfil, ranking } from '../repo/partidas';`.
- no lugar do comentário `// (Tarefa 10: perfil, histórico, ranking, salas e caixa de teste entram aqui.)`:
```ts
  api.get('/perfil', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    res.json(await perfil(s.banco, u.id));
  });

  api.get('/perfil/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return void res.status(400).json({ erro: 'id inválido' });
    const p = await perfil(s.banco, id);
    if (!p) return void res.status(404).json({ erro: 'jogador não encontrado' });
    res.json(p);
  });

  api.get('/historico', async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return void res.status(401).json({ erro: 'entre na sua conta' });
    res.json({ partidas: await historico(s.banco, u.id) });
  });

  api.get('/ranking/:variante', async (req, res) => {
    const v = req.params.variante;
    if (!(VARIANTES as readonly string[]).includes(v)) return void res.status(400).json({ erro: 'variante inválida' });
    res.json({ linhas: await ranking(s.banco, v as Variante) });
  });

  api.get('/salas', async (_req, res) => {
    res.json({ salas: x.listarSalas ? await x.listarSalas() : [] });
  });

  api.get('/teste/emails', (_req, res) => {
    if (!s.caixaTeste) return void res.status(404).json({ erro: 'não encontrado' });
    res.json({ emails: s.caixaTeste.enviados.map((e) => ({ para: e.para, assunto: e.assunto, link: extrairLink(e.texto) })) });
  });
```
- no lugar do comentário `// (Tarefa 10: estáticos e fallback da SPA entram aqui.)`:
```ts
  if (x.pastaWeb) {
    const pasta = x.pastaWeb;
    // Os arquivos do Vite em /assets têm hash no nome: podem ficar em cache.
    app.use(express.static(pasta, { index: false, maxAge: '7d' }));
    // `/{*caminho}` (Express 5) casa também "/": sem isso o Colyseus responderia "/" com a própria versão.
    app.get('/{*caminho}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile('index.html', { root: pasta });
    });
  }
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test http`
Expected: PASS — `http-auth` (11) e `http-dados` (9).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src/http apps/server/test/http-dados.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): API de perfil, histórico, ranking e salas; estáticos da SPA; CORS restrito em produção" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `Mesa` — cadeira escolhida, `modo` no estado, gancho `aoAplicar` e chat de mesa privada

**Files:**
- Modify: `apps/server/src/mesa/protocolo.ts`, `apps/server/src/mesa/Mesa.ts`
- Modify: `apps/web/test/fixtures.ts` (o `MsgEstado` ganha `modo`)
- Test: `apps/server/test/mesa-plano4.test.ts`, `apps/server/test/protocolo.test.ts`

**Step 1: Testes que falham**

Em `apps/server/test/protocolo.test.ts`, importe `limparChat` e `MAX_CHAT` e acrescente:
```ts
describe('limparChat', () => {
  test('tira controles, junta espaços, corta em 200', () => {
    expect(limparChat('  oi\u0007 \n pessoal\u200b ')).toBe('oi pessoal');
    expect(limparChat('x'.repeat(500))).toHaveLength(MAX_CHAT);
    expect(limparChat(42)).toBe('');
    expect(limparChat('   ')).toBe('');
  });
});
```

`apps/server/test/mesa-plano4.test.ts`
```ts
import type { AcaoJogador } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('sentar em cadeira escolhida', () => {
  test('respeita a cadeira pedida e recusa a ocupada', () => {
    const { mesa, estado } = criarMesa({ humanosEsperados: 2 });
    expect(mesa.sentar('a', 'Ana', 1)).toBe(1);
    expect(mesa.sentar('b', 'Bia', 1)).toBeNull();
    expect(mesa.sentar('b', 'Bia', 0)).toBe(0);
    expect(estado('a')?.minhaCadeira).toBe(1);
    expect(mesa.iniciada).toBe(true);
  });
});

describe('modo', () => {
  test('vai no MsgEstado (padrão: clássica)', () => {
    const t1 = criarMesa();
    t1.mesa.sentar('a', 'Ana');
    expect(t1.estado('a')?.modo).toBe('classica');
    const t2 = criarMesa({ modo: 'privada', humanosEsperados: 2 });
    t2.mesa.sentar('a', 'Ana');
    expect(t2.estado('a')?.modo).toBe('privada');
  });
});

describe('aoAplicar', () => {
  test('avisa cada ação aplicada, dizendo se veio de humano', () => {
    const chamadas: [AcaoJogador, boolean][] = [];
    const { mesa, estado } = criarMesa({ aoAplicar: (a, h) => chamadas.push([a, h]) });
    mesa.sentar('a', 'Ana');
    avancarAte(() => !!estado('a')?.minhasAcoes.some((x) => x.tipo === 'jogar'));
    // tudo o que aconteceu até aqui foi de bot
    expect(chamadas.every(([, porHumano]) => !porHumano)).toBe(true);
    const jogar = estado('a')!.minhasAcoes.find((x) => x.tipo === 'jogar')!;
    const antes = chamadas.length;
    mesa.acao('a', jogar);
    expect(chamadas.length).toBe(antes + 1);
    expect(chamadas.at(-1)).toEqual([expect.objectContaining({ tipo: 'jogar', cadeira: 0 }), true]);
  });

  test('exceção no gancho não derruba a mesa', () => {
    const aoErro = vi.fn();
    const { mesa, estado } = criarMesa({
      aoErro,
      aoAplicar: () => {
        throw new Error('banco fora');
      },
    });
    mesa.sentar('a', 'Ana');
    avancarAte(() => !!estado('a')?.minhasAcoes.some((x) => x.tipo === 'jogar'));
    mesa.acao('a', estado('a')!.minhasAcoes.find((x) => x.tipo === 'jogar')!);
    expect(aoErro).toHaveBeenCalled();
    // a partida segue: o humano volta a ter jogada mais adiante
    const versao = estado('a');
    avancarAte(() => estado('a') !== versao && !!estado('a')?.minhasAcoes.some((x) => x.tipo === 'jogar'));
  });
});

describe('chat', () => {
  test('só na privada; limpa o texto; 1 por segundo por jogador; vale na sala de espera', () => {
    const { mesa, de } = criarMesa({ modo: 'privada', humanosEsperados: 3 });
    mesa.sentar('a', 'Ana');
    mesa.sentar('b', 'Bia');
    mesa.chat('a', '  oi\u0007 pessoal ');
    expect(de('b', 'chat')).toEqual([{ de: 0, nome: 'Ana', texto: 'oi pessoal' }]);
    expect(de('a', 'chat')).toHaveLength(1);
    mesa.chat('a', 'de novo');
    expect(de('b', 'chat')).toHaveLength(1);
    expect(de('a', 'erro').at(-1)).toEqual({ mensagem: 'calma: uma mensagem por segundo' });
    vi.advanceTimersByTime(1_000);
    mesa.chat('a', 'de novo');
    expect(de('b', 'chat')).toHaveLength(2);
    mesa.chat('b', '   ');
    expect(de('a', 'chat')).toHaveLength(2);
    mesa.chat('x', 'quem?');
    expect(de('a', 'chat')).toHaveLength(2);
  });

  test('fora da privada responde erro', () => {
    const { mesa, de } = criarMesa({ humanosEsperados: 2 });
    mesa.sentar('a', 'Ana');
    mesa.chat('a', 'oi');
    expect(de('a', 'chat')).toEqual([]);
    expect(de('a', 'erro').at(-1)).toEqual({ mensagem: 'chat só em mesa privada' });
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test mesa-plano4`
Expected: FAIL — `sentar` ignora a cadeira, `modo` indefinido, `mesa.chat is not a function`.

**Step 3: Implementação**

`apps/server/src/mesa/protocolo.ts` — acrescente:
```ts
export const MAX_CHAT = 200;

export interface MsgChat {
  de: Cadeira;
  nome: string;
  texto: string;
}

/** Texto de chat: sem caracteres de controle/invisíveis, espaços juntados, até 200. */
export function limparChat(cru: unknown): string {
  if (typeof cru !== 'string') return '';
  return cru
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHAT)
    .trim();
}
```
e em `MsgEstado`, depois de `cadeiras`, o campo:
```ts
  /** Tipo da mesa (a tela usa para chat, convite e avisos da ranqueada). */
  modo: ModoMesa;
```

`apps/server/src/mesa/Mesa.ts`:
- import do protocolo: acrescente `limparChat`, `type ModoMesa`, `type MsgChat`.
- em `OpcoesMesa`, acrescente:
```ts
  /** Tipo da mesa; vai no `MsgEstado`. Padrão 'classica'. */
  modo?: ModoMesa;
  /** Chat de texto. Padrão: só na privada. */
  chat?: boolean;
  /** Toda ação aplicada (humano ou bot). `porHumano` = veio de `acao()` (não de bot nem de tempo esgotado). */
  aoAplicar?: (acao: AcaoJogador, porHumano: boolean) => void;
```
- campo novo na classe (junto dos outros `private`): `private readonly ultimoChat: number[] = [-Infinity, -Infinity, -Infinity, -Infinity];`
- `sentar` passa a aceitar a cadeira (ranqueada usa as cadeiras da fila):
```ts
  sentar(id: string, nome: unknown, cadeira?: Cadeira): Cadeira | null {
    if (this.iniciada || this.cadeiraDe(id) !== null) return null;
    const cad =
      cadeira !== undefined
        ? this.ocupantes[cadeira]?.id === null
          ? cadeira
          : undefined
        : ORDEM_SENTAR.find((c) => this.ocupantes[c].id === null);
    if (cad === undefined) return null;
```
(o resto do método fica igual).
- método público novo, depois de `fala`:
```ts
  chat(id: string, cru: unknown): void {
    const c = this.cadeiraDe(id);
    if (c === null) return;
    if (!(this.o.chat ?? this.o.modo === 'privada')) {
      this.erro(id, 'chat só em mesa privada');
      return;
    }
    const texto = limparChat(cru);
    if (!texto) return;
    const agora = this.relogio.agora();
    if (agora - this.ultimoChat[c] < this.tempos.intervaloMensagemMs) {
      this.erro(id, 'calma: uma mensagem por segundo');
      return;
    }
    this.ultimoChat[c] = agora;
    const msg: MsgChat = { de: c, nome: this.ocupantes[c].nome ?? 'Jogador', texto };
    this.paraHumanos((destino) => this.o.enviar(destino, 'chat', msg));
  }
```
- em `aplicar`, logo depois de `this.versao++;`:
```ts
    try {
      this.o.aoAplicar?.(acao, idHumano !== undefined);
    } catch (e) {
      this.falha(e);
    }
```
- em `enviarEstado`, no objeto `msg`, depois de `cadeiras,`: `modo: this.o.modo ?? 'classica',`

`apps/web/test/fixtures.ts` — no objeto devolvido por `msgEstado`, acrescente `modo: 'classica',` (o TypeScript do web passa a exigir).

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test`
Expected: PASS — todos (os testes antigos da `Mesa` não usam `modo`).

Run: `pnpm typecheck`
Expected: sem erros nos três pacotes (o web vê o `modo` novo pelo alias `@truco/protocolo`).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server apps/web/test/fixtures.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): Mesa com cadeira escolhida, modo no estado, gancho aoAplicar e chat da mesa privada" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `RegistroMesa` — ponte entre a sala e o banco

Isola do `MesaRoom` toda a gravação (início, ações, abandono, fim), serializando as escritas numa cadeia de promessas: a sala só chama métodos síncronos e nunca espera o banco.

**Files:**
- Create: `apps/server/src/registroMesa.ts`
- Test: `apps/server/test/registro-mesa.test.ts`

**Step 1: Teste que falha**

`apps/server/test/registro-mesa.test.ts`
```ts
import { type Dupla, type EstadoPartida, novaPartida, REGRAS_RANQUEADA } from '@truco/engine';
import { asc } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Banco } from '../src/banco/banco';
import { participacoes, partidas } from '../src/banco/schema';
import { RegistroMesa } from '../src/registroMesa';
import { bloqueioAte, ratingDe } from '../src/repo/partidas';
import { criarUsuario } from '../src/repo/usuarios';
import { servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

const T0 = new Date('2026-11-05T12:00:00Z');
const fimDe = (vencedor: Dupla, placar: [number, number]): EstadoPartida => ({
  ...novaPartida(REGRAS_RANQUEADA.paulista, 0),
  fase: 'fimPartida',
  placar,
  vencedor,
});

describe('RegistroMesa', () => {
  test('ranqueada 1x1: só ações de humano contam; abandono custa Elo; quem fica pontua', async () => {
    const s = servicosDeTeste(b.db, { agora: () => T0 });
    const ana = await criarUsuario(b.db, { apelidoBase: 'ana' });
    const bia = await criarUsuario(b.db, { apelidoBase: 'bia' });
    const r = new RegistroMesa(s, { variante: 'paulista', modo: 'ranqueada', formato: '1x1' });
    // Ordem real: o `sentar` do último humano dispara o início ANTES do `sentou` dele.
    r.sentou({ cadeira: 0, usuarioId: ana.id, nome: 'ana' });
    r.iniciou();
    r.sentou({ cadeira: 1, usuarioId: bia.id, nome: 'bia' });
    r.acao({ tipo: 'truco', cadeira: 1 }, true);
    r.acao({ tipo: 'correr', cadeira: 0 }, false);
    r.acao({ tipo: 'truco', cadeira: 2 }, false);
    r.abandonou(0);
    r.terminou(fimDe(1, [5, 12]));
    await r.ocioso();

    expect(await ratingDe(b.db, ana.id, 'paulista')).toEqual({ elo: 984, pontos: 0, partidas: 1 });
    expect(await ratingDe(b.db, bia.id, 'paulista')).toEqual({ elo: 1016, pontos: 16, partidas: 1 });
    expect(await bloqueioAte(b.db, ana.id, T0)).toEqual(new Date(T0.getTime() + 5 * 60_000));
    const ps = await b.db.select().from(participacoes).orderBy(asc(participacoes.cadeira));
    expect(ps.map((p) => [p.nome, p.humano, p.trucosPedidos, p.corridas, p.venceu, p.abandonou])).toEqual([
      ['ana', true, 0, 0, false, true],
      ['bia', true, 1, 0, true, false],
      ['Bot', false, 0, 0, null, false],
      ['Bot', false, 0, 0, null, false],
    ]);
  });

  test('só convidados: nada é gravado', async () => {
    const r = new RegistroMesa(servicosDeTeste(b.db), { variante: 'mineiro', modo: 'classica', formato: null });
    r.sentou({ cadeira: 0, usuarioId: null, nome: 'Convidado' });
    r.iniciou();
    r.terminou(fimDe(0, [12, 0]));
    await r.ocioso();
    expect(await b.db.select().from(partidas)).toEqual([]);
  });

  test('quem saiu antes do início não entra na partida', async () => {
    const ana = await criarUsuario(b.db, { apelidoBase: 'ana' });
    const bia = await criarUsuario(b.db, { apelidoBase: 'bia' });
    const r = new RegistroMesa(servicosDeTeste(b.db), { variante: 'mineiro', modo: 'privada', formato: null });
    r.sentou({ cadeira: 0, usuarioId: ana.id, nome: 'ana' });
    r.sentou({ cadeira: 2, usuarioId: bia.id, nome: 'bia' });
    r.saiuAntesDoInicio(2);
    r.iniciou();
    await r.ocioso();
    const ps = await b.db.select().from(participacoes).orderBy(asc(participacoes.cadeira));
    expect(ps.map((p) => p.usuarioId)).toEqual([ana.id, null, null, null]);
  });

  test('sem serviços (null) não faz nada; erro de banco vai para aoErro', async () => {
    const semBanco = new RegistroMesa(null, { variante: 'paulista', modo: 'classica', formato: null });
    semBanco.sentou({ cadeira: 0, usuarioId: 1, nome: 'x' });
    semBanco.iniciou();
    await semBanco.ocioso();

    const aoErro = vi.fn();
    const quebrado = new RegistroMesa(servicosDeTeste({} as Banco), { variante: 'paulista', modo: 'classica', formato: null }, aoErro);
    quebrado.sentou({ cadeira: 0, usuarioId: 1, nome: 'x' });
    quebrado.iniciou();
    await quebrado.ocioso();
    expect(aoErro).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test registro-mesa`
Expected: FAIL — `Failed to load url ../src/registroMesa`.

**Step 3: Implementação**

`apps/server/src/registroMesa.ts`
```ts
import type { AcaoJogador, Cadeira, EstadoPartida, Variante } from '@truco/engine';
import type { Formato } from './api/tipos';
import type { ModoMesa } from './mesa/protocolo';
import { type Contadores, contadoresZerados, contarAcao } from './ranking/estatisticas';
import { type AssentoRegistro, iniciarPartida, registrarAbandono, terminarPartida } from './repo/partidas';
import type { Servicos } from './servicos';

export interface JogadorSala {
  cadeira: Cadeira;
  /** null = convidado. */
  usuarioId: number | null;
  nome: string;
}

export interface InfoRegistro {
  variante: Variante;
  modo: ModoMesa;
  formato: Formato | null;
}

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

/**
 * Grava a partida de uma sala. Métodos síncronos; as escritas rodam em fila (uma
 * cadeia de promessas), na ordem das chamadas. Falhas vão para `aoErro` e não param a mesa.
 */
export class RegistroMesa {
  private partidaId: number | null = null;
  private readonly humanos = new Map<Cadeira, JogadorSala>();
  private readonly contadores: Contadores[] = CADEIRAS.map(contadoresZerados);
  private cadeia: Promise<void> = Promise.resolve();

  constructor(
    private readonly s: Servicos | null,
    private readonly info: InfoRegistro,
    private readonly aoErro: (e: unknown) => void = (e) => console.error('[registro]', e),
  ) {}

  sentou(j: JogadorSala): void {
    this.humanos.set(j.cadeira, j);
  }

  saiuAntesDoInicio(c: Cadeira): void {
    this.humanos.delete(c);
  }

  acao(a: AcaoJogador, porHumano: boolean): void {
    if (porHumano && this.humanos.has(a.cadeira)) this.contadores[a.cadeira] = contarAcao(this.contadores[a.cadeira], a);
  }

  /**
   * A gravação roda depois (microtarefa): o `sentar` do último humano dispara o início
   * antes de a sala chamar `sentou` para ele.
   */
  iniciou(): void {
    const s = this.s;
    if (!s) return;
    this.encadear(async () => {
      if (![...this.humanos.values()].some((j) => j.usuarioId !== null)) return;
      const assentos: AssentoRegistro[] = CADEIRAS.map((c) => {
        const j = this.humanos.get(c);
        return j ? { cadeira: c, usuarioId: j.usuarioId, nome: j.nome, humano: true } : { cadeira: c, usuarioId: null, nome: 'Bot', humano: false };
      });
      this.partidaId = await iniciarPartida(s.banco, { ...this.info, assentos }, s.agora());
    });
  }

  abandonou(c: Cadeira): void {
    const s = this.s;
    const usuarioId = this.humanos.get(c)?.usuarioId ?? null;
    if (!s || usuarioId === null) return;
    this.encadear(async () => {
      if (this.partidaId === null) return;
      await registrarAbandono(s.banco, this.partidaId, usuarioId, { k: s.kElo, agora: s.agora(), bloqueioMs: s.bloqueioAbandonoMs });
    });
  }

  terminou(e: EstadoPartida): void {
    const s = this.s;
    if (!s) return;
    const fim = {
      placar: [e.placar[0], e.placar[1]] as const,
      vencedora: e.vencedor,
      contadores: this.contadores.map((c) => ({ ...c })),
    };
    this.encadear(async () => {
      if (this.partidaId === null) return;
      await terminarPartida(s.banco, this.partidaId, fim, { k: s.kElo, agora: s.agora() });
    });
  }

  /** Espera as gravações pendentes (testes e desligamento). */
  ocioso(): Promise<void> {
    return this.cadeia;
  }

  private encadear(fn: () => Promise<void>): void {
    this.cadeia = this.cadeia.then(fn).catch((e) => this.aoErro(e));
  }
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test registro-mesa`
Expected: PASS (4 testes).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src/registroMesa.ts apps/server/test/registro-mesa.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): RegistroMesa grava início, estatísticas, abandono e fim em fila" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: `MesaRoom` com contas, privada, ranqueada protegida e HTTP no mesmo servidor

**Files:**
- Create: `apps/server/src/sessaoSala.ts`, `apps/server/src/salas.ts`
- Modify (substituir): `apps/server/src/MesaRoom.ts`, `apps/server/src/servidor.ts`, `apps/server/src/main.ts`
- Test: `apps/server/test/integracao.test.ts`

**Step 1: Teste que falha**

Em `apps/server/test/integracao.test.ts`:
- imports novos:
```ts
import { Client } from '@colyseus/sdk';
import { eq } from 'drizzle-orm';
import { participacoes } from '../src/banco/schema';
import { criarSessao, entrarComEmail } from '../src/repo/usuarios';
import { type Servicos, servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';
```
- troque `beforeAll`/`afterEach`/`afterAll` por:
```ts
let banco: BancoDeTeste;
let servicos: Servicos;

beforeAll(async () => {
  MesaRoom.tempos = { botMs: 20, pausaMaoMs: 50, jogadaMs: 2_000 };
  banco = await bancoDeTeste();
  servicos = servicosDeTeste(banco.db);
  colyseus = await boot(criarServidor(servicos));
}, 30_000);
afterEach(async () => {
  await colyseus.cleanup();
  await banco.limpar();
});
afterAll(async () => {
  await colyseus.shutdown();
  await banco.fechar();
});

const URL_TESTE = 'http://localhost:2568';

/** Usuário logado: sessão criada direto no banco e mandada como Bearer pelo SDK. */
async function logado(email: string) {
  const u = await entrarComEmail(banco.db, email);
  const token = await criarSessao(banco.db, u.id, new Date());
  const cliente = new Client(URL_TESTE);
  cliente.auth.token = token;
  return { u, token, cliente };
}

async function esperarAsync(cond: () => Promise<boolean>, ms = 5_000) {
  const t0 = Date.now();
  while (!(await cond())) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado esperando condição');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const salasAbertas = async () => (await (await fetch(`${URL_TESTE}/api/salas`)).json()).salas as any[];
```
- novo `describe` no fim do arquivo:
```ts
describe('contas, privadas e HTTP no mesmo servidor', () => {
  test('/saude e /api/config respondem na porta do Colyseus', async () => {
    expect((await fetch(`${URL_TESTE}/saude`)).status).toBe(200);
    expect(await (await fetch(`${URL_TESTE}/api/config`)).json()).toEqual({ google: null, emailTeste: true });
  });

  test('logado senta com o apelido da conta e a partida é gravada ao começar', async () => {
    const ana = await logado('ana@x.com');
    const sala = await ana.cliente.joinOrCreate('mesa', { humanos: 1, nome: 'Outro Nome' });
    const m = coletor(sala);
    await esperar(() => !!m.estado?.some((x) => x.visao));
    expect(m.estado.at(-1).cadeiras[0].nome).toBe('ana');
    expect(m.estado.at(-1).modo).toBe('classica');
    await esperarAsync(async () => (await banco.db.select().from(participacoes)).length === 4);
    const [p] = await banco.db.select().from(participacoes).where(eq(participacoes.usuarioId, ana.u.id));
    expect(p).toMatchObject({ cadeira: 0, humano: true, nome: 'ana' });
  });

  test('token de sessão inválido entra como convidado', async () => {
    const c = new Client(URL_TESTE);
    c.auth.token = 'inventado';
    const sala = await c.joinOrCreate('mesa', { humanos: 1, nome: 'Convidado' });
    const m = coletor(sala);
    await esperar(() => !!m.estado?.length);
    expect(m.estado.at(-1).cadeiras[0].nome).toBe('Convidado');
  });

  test('mesa privada: fora da lista e do joinOrCreate, entra por código e tem chat', async () => {
    const a = await colyseus.sdk.create('mesa', { modo: 'privada', humanos: 2, nome: 'Ana' });
    const ma = coletor(a);
    await esperar(() => !!ma.estado?.length);
    expect(ma.estado.at(-1).modo).toBe('privada');
    expect((await salasAbertas()).map((s) => s.id)).not.toContain(a.roomId);
    const outro = await colyseus.sdk.joinOrCreate('mesa', { modo: 'privada', humanos: 2, nome: 'Cid' });
    coletor(outro);
    expect(outro.roomId).not.toBe(a.roomId);

    const b = await colyseus.sdk.joinById(a.roomId, { nome: 'Bia' });
    const mb = coletor(b);
    await esperar(() => !!mb.estado?.length);
    a.send('chat', '  oi\u0007 pessoal ');
    await esperar(() => !!mb.chat?.length);
    expect(mb.chat[0]).toEqual({ de: 0, nome: 'Ana', texto: 'oi pessoal' });
  });

  test('mesa casual esperando gente aparece em /api/salas', async () => {
    const a = await colyseus.sdk.joinOrCreate('mesa', { humanos: 2, nivelBot: 'dificil', nome: 'Ana' });
    coletor(a);
    await esperarAsync(async () => (await salasAbertas()).some((s) => s.id === a.roomId));
    expect((await salasAbertas()).find((s) => s.id === a.roomId)).toMatchObject({
      modo: 'desafio',
      variante: 'paulista',
      humanos: 2,
      nivelBot: 'dificil',
      ocupados: 1,
      dono: 'Ana',
    });
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test integracao`
Expected: FAIL — `criarServidor` não aceita serviços / `/saude` 200 com corpo errado ou 404 / nome do logado é "Outro Nome" / chat não chega.

**Step 3: Implementação**

`apps/server/src/sessaoSala.ts`
```ts
import { COOKIE_SESSAO, lerCookie } from './auth/tokens';
import { usuarioDaSessao } from './repo/usuarios';
import type { Servicos } from './servicos';

/** O que vai em `client.auth` de quem está logado. */
export interface UsuarioConexao {
  usuarioId: number;
  apelido: string;
}

/** Sessão a partir do cookie (navegador) ou do Bearer (`client.auth.token` do SDK). */
export async function usuarioDaConexao(
  s: Servicos | null,
  token: string | null | undefined,
  headers: Headers | undefined,
): Promise<UsuarioConexao | null> {
  if (!s) return null;
  const bruto = lerCookie(headers?.get('cookie'), COOKIE_SESSAO) ?? (token || null);
  if (!bruto) return null;
  const u = await usuarioDaSessao(s.banco, bruto, s.agora());
  return u ? { usuarioId: u.id, apelido: u.apelido } : null;
}
```

`apps/server/src/salas.ts`
```ts
import { matchMaker } from '@colyseus/core';
import type { SalaAberta } from './api/tipos';

/** Mesas casuais públicas ainda esperando jogadores (as cheias já foram trancadas ao começar). */
export async function listarSalasAbertas(): Promise<SalaAberta[]> {
  const salas = await matchMaker.query({ name: 'mesa', locked: false, private: false });
  return salas
    .filter((s) => (s.metadata?.modo === 'classica' || s.metadata?.modo === 'desafio') && s.clients < s.maxClients)
    .map((s) => ({
      id: s.roomId,
      modo: s.metadata.modo,
      variante: s.metadata.variante,
      humanos: s.metadata.humanos,
      nivelBot: s.metadata.nivelBot,
      regras: s.metadata.regras ?? null,
      ocupados: s.clients,
      dono: s.metadata.dono ?? null,
    }));
}
```

`apps/server/src/MesaRoom.ts` (arquivo inteiro):
```ts
import { type AuthContext, type Client, ErrorCode, Room, type RoomException, type RoomMethodName, ServerError } from '@colyseus/core';
import type { Cadeira } from '@truco/engine';
import { randomInt, randomUUID } from 'node:crypto';
import { Mesa, type Tempos } from './mesa/Mesa';
import { filtroDaSala, limparNome, opcoesDaSala, SAIDA_PARTIDA_CANCELADA } from './mesa/protocolo';
import { RegistroMesa } from './registroMesa';
import type { Servicos } from './servicos';
import { type UsuarioConexao, usuarioDaConexao } from './sessaoSala';

const randCripto = () => randomInt(0, 2 ** 32) / 2 ** 32;

/** Quem a fila reservou para uma mesa ranqueada, e onde senta. */
export interface JogadorReservado {
  usuarioId: number;
  cadeira: Cadeira;
}

function jogadoresReservados(cru: unknown): JogadorReservado[] {
  if (!Array.isArray(cru)) return [];
  return cru.filter((j): j is JogadorReservado => {
    const x = j as Partial<JogadorReservado> | null;
    return !!x && Number.isInteger(x.usuarioId) && [0, 1, 2, 3].includes(x.cadeira as number);
  });
}

export class MesaRoom extends Room {
  /** Sobrescrito nos testes para acelerar. */
  static tempos: Partial<Tempos> = {};
  /** Banco, e-mail etc. (`criarServidor` define). null = sem gravação nem login. */
  static servicos: Servicos | null = null;
  /** Só a fila conhece: impede cliente de criar mesa ranqueada. */
  static readonly fichaInterna = randomUUID();
  /** Ranqueada que não lota nesse tempo é cancelada. */
  static esperaRanqueadaMs = 30_000;

  private mesa!: Mesa;
  private registro!: RegistroMesa;
  private reservados: JogadorReservado[] | null = null;

  /**
   * Roda no pedido HTTP de matchmaking, ANTES de o Colyseus procurar sala, e recebe o
   * MESMO objeto de opções que vai para o filtro e para `createRoom`: reescreve nele os
   * campos do `filterBy` com os valores validados (quem omite um campo procura a sala
   * padrão, não "qualquer sala") e apaga campos que só a fila pode mandar. Devolve o
   * usuário logado (vira `client.auth`) ou `true` (convidado).
   */
  static async onAuth(token: string, options: unknown, context: AuthContext): Promise<unknown> {
    if (options && typeof options === 'object') {
      const o = options as Record<string, unknown>;
      if (o.modo === 'ranqueada') throw new ServerError(ErrorCode.AUTH_FAILED, 'mesa ranqueada só pela fila');
      delete o.fichaInterna;
      delete o.jogadores;
      Object.assign(o, filtroDaSala(opcoesDaSala(o)));
    }
    return (await usuarioDaConexao(MesaRoom.servicos, token, context.headers)) ?? true;
  }

  onCreate(options: unknown) {
    const cru = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
    const opcoes = opcoesDaSala(cru);
    const { modo, regras, humanos, nivelBot, chanceInterceptarSinal } = opcoes;
    if (modo === 'ranqueada') {
      if (cru.fichaInterna !== MesaRoom.fichaInterna) throw new Error('mesa ranqueada só pela fila');
      this.reservados = jogadoresReservados(cru.jogadores);
      if (this.reservados.length !== humanos) throw new Error('reservas não batem com a quantidade de humanos');
    }
    this.maxClients = humanos;
    // O Colyseus 0.18 copia os campos do `filterBy` das opções cruas de criação para
    // `metadata`, e o `joinOrCreate` compara com `metadata`: trocar pelos valores
    // validados (o `setMetadata` substitui, não mescla). `regras`/`dono` são para a lista.
    void this.setMetadata({ ...filtroDaSala(opcoes), regras, dono: modo === 'ranqueada' ? null : limparNome(cru.nome) });
    if (modo === 'privada' || modo === 'ranqueada') void this.setPrivate(true);
    // Acima disso o Colyseus derruba o cliente (sinais/falas/chat já têm limite próprio na Mesa).
    this.maxMessagesPerSecond = 20;
    this.registro = new RegistroMesa(
      MesaRoom.servicos,
      { variante: regras.variante, modo, formato: modo === 'ranqueada' ? (humanos === 2 ? '1x1' : '2x2') : null },
      (e) => console.error(`[MesaRoom ${this.roomId}] falha ao gravar`, e),
    );
    this.mesa = new Mesa({
      regras,
      modo,
      nivelBot,
      humanosEsperados: humanos,
      chanceInterceptarSinal,
      chanceFalaBot: 0.2,
      tempos: MesaRoom.tempos,
      rand: randCripto,
      relogio: {
        agendar: (ms, fn) => {
          const d = this.clock.setTimeout(fn, ms);
          return () => d.clear();
        },
        agora: () => Date.now(),
      },
      enviar: (id, tipo, payload) => this.clients.get(id)?.send(tipo, payload),
      aoErro: (e) => console.error(`[MesaRoom ${this.roomId}] erro na mesa`, e),
      aoAplicar: (a, porHumano) => this.registro.acao(a, porHumano),
      aoIniciar: () => {
        this.lock().catch((e) => console.error('[MesaRoom] falha ao trancar a sala', e));
        this.registro.iniciou();
      },
      aoTerminar: (s) => this.registro.terminou(s),
    });

    this.onMessage('acao', (client, payload) => this.mesa.acao(client.sessionId, payload));
    this.onMessage('sinal', (client, payload) => this.mesa.sinal(client.sessionId, payload));
    this.onMessage('fala', (client, payload) => this.mesa.fala(client.sessionId, payload));
    this.onMessage('chat', (client, payload) => this.mesa.chat(client.sessionId, payload));
    // Ranqueada começa sozinha quando todos os reservados sentam; ninguém completa com bots.
    this.onMessage('iniciar', (client) => {
      if (!this.reservados) this.mesa.iniciar(client.sessionId);
    });
    this.onMessage('sincronizar', (client) => this.mesa.sincronizar(client.sessionId));

    if (this.reservados) {
      this.clock.setTimeout(() => {
        if (!this.mesa.iniciada) void this.disconnect(SAIDA_PARTIDA_CANCELADA);
      }, MesaRoom.esperaRanqueadaMs);
    }
  }

  onJoin(client: Client, options?: { nome?: unknown }) {
    const auth = client.auth as UsuarioConexao | undefined;
    let cadeira: Cadeira | null;
    if (this.reservados) {
      const r = auth ? this.reservados.find((j) => j.usuarioId === auth.usuarioId) : undefined;
      if (!r || !auth) throw new Error('lugar não reservado para você');
      cadeira = this.mesa.sentar(client.sessionId, auth.apelido, r.cadeira);
    } else {
      cadeira = this.mesa.sentar(client.sessionId, auth?.apelido ?? options?.nome);
    }
    if (cadeira === null) throw new Error('mesa cheia ou já iniciada');
    this.registro.sentou({ cadeira, usuarioId: auth?.usuarioId ?? null, nome: auth?.apelido ?? limparNome(options?.nome) });
  }

  onDrop(client: Client) {
    // Cliente cujo onJoin falhou (nunca sentou) também passa por aqui.
    if (this.mesa.cadeiraDe(client.sessionId) === null) return;
    this.mesa.desconectar(client.sessionId);
    this.allowReconnection(client, 60).catch(() => {});
  }

  onReconnect(client: Client) {
    this.mesa.reconectar(client.sessionId);
  }

  /** Saída definitiva (consentida ou fim dos 60 s de reconexão). */
  onLeave(client: Client) {
    const c = this.mesa.cadeiraDe(client.sessionId);
    if (c !== null) {
      if (!this.mesa.iniciada) this.registro.saiuAntesDoInicio(c);
      else if (this.mesa.partida?.fase !== 'fimPartida') this.registro.abandonou(c);
    }
    this.mesa.sair(client.sessionId);
  }

  onDispose() {
    this.mesa.dispose();
  }

  /** Sem isto, uma exceção num timer do `clock` derruba o processo inteiro. */
  onUncaughtException(err: RoomException, method: RoomMethodName) {
    // onJoin recusado ("mesa cheia ou já iniciada") é esperado e o erro já volta ao cliente.
    if (method === 'onJoin') {
      console.warn(`[MesaRoom ${this.roomId}] entrada recusada: ${err.message}`);
      return;
    }
    console.error(`[MesaRoom ${this.roomId}] exceção em ${method}`, err.cause ?? err);
  }
}
```
(Se o revisor tiver mudado algo no `MesaRoom` depois de `7243dec`, mantenha a mudança dele ao substituir.)

`apps/server/src/servidor.ts` (arquivo inteiro):
```ts
import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { configurarApp } from './http/app';
import { instalarCors } from './http/cors';
import { MesaRoom } from './MesaRoom';
import { listarSalasAbertas } from './salas';
import type { Servicos } from './servicos';

export interface ExtrasServidor {
  /** Pasta do build do web, servida na mesma origem (produção). */
  pastaWeb?: string | null;
}

export function criarServidor(servicos: Servicos, extras: ExtrasServidor = {}) {
  MesaRoom.servicos = servicos;
  instalarCors(servicos);
  return defineServer({
    transport: new WebSocketTransport(),
    // Só junta quem pediu o mesmo modo, variante, quantidade de humanos, nível de bot e
    // regras (`chaveRegras`). `MesaRoom.onAuth` preenche esses campos nas opções de quem
    // procura e `MesaRoom.onCreate` na metadata da sala: ninguém fica sem filtro.
    rooms: { mesa: defineRoom(MesaRoom).filterBy(['modo', 'variante', 'humanos', 'nivelBot', 'chaveRegras']) },
    // Rotas HTTP no mesmo servidor: o roteador do Colyseus atende /matchmake e /__healthcheck,
    // o resto cai neste Express.
    express: (app) => configurarApp(app, servicos, { listarSalas: listarSalasAbertas, pastaWeb: extras.pastaWeb ?? null }),
  });
}
```

`apps/server/src/main.ts` (arquivo inteiro):
```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MesaRoom } from './MesaRoom';
import { criarServidor } from './servidor';
import { servicosDoAmbiente } from './servicos';
import { temposDoAmbiente } from './tempos';

const PASTA_WEB = fileURLToPath(new URL('../../web/dist/', import.meta.url));
const PASTA_PGLITE = fileURLToPath(new URL('../.dados/pglite', import.meta.url));

MesaRoom.tempos = temposDoAmbiente(process.env);
const { servicos, config, fechar } = await servicosDoAmbiente(process.env, { pastaPglite: PASTA_PGLITE });
for (const a of config.avisos) console.warn(`truco: aviso: ${a}`);

const pastaWeb = existsSync(join(PASTA_WEB, 'index.html')) ? PASTA_WEB : null;
const servidor = criarServidor(servicos, { pastaWeb });
servidor.onShutdown(fechar);

const porta = Number(process.env.PORT ?? 2567);
await servidor.listen(porta);
const banco = config.databaseUrl ? 'postgres' : config.pastaPglite ? `pglite em ${config.pastaPglite}` : 'pglite em memória';
const modo = process.env.TRUCO_TEMPOS ? `, tempos: ${process.env.TRUCO_TEMPOS}` : '';
console.log(`truco: servidor ouvindo na porta ${porta} (banco: ${banco}; web: ${pastaWeb ? 'build servido' : 'não servido'}${modo})`);
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test`
Expected: PASS — todos os arquivos, inclusive os testes antigos de `integracao` (convidados continuam funcionando).

Run: `pnpm --filter @truco/server typecheck` → sem erros.

Smoke manual rápido (dev):
Run: `pnpm dev:server`
Expected: `truco: servidor ouvindo na porta 2567 (banco: pglite em ...\apps\server\.dados\pglite; web: não servido)`; em outro terminal `curl http://localhost:2567/saude` → `{"ok":true}`. Pare com Ctrl+C.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): MesaRoom com login, registro de partida, mesa privada com chat e ranqueada protegida; HTTP no mesmo servidor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Fila ranqueada — pareamento puro com faixa que alarga

**Files:**
- Create: `apps/server/src/fila/fila.ts`
- Test: `apps/server/test/fila.test.ts`

**Step 1: Teste que falha**

`apps/server/test/fila.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { cadeirasDoPareamento, type EntradaFila, faixa, Fila, normalizarCodigoDupla, parear } from '../src/fila/fila';

const T0 = 1_000_000;
let n = 0;
const e = (elo: number, extra: Partial<EntradaFila> = {}): EntradaFila => {
  n++;
  return { id: `s${n}`, usuarioId: n, apelido: `j${n}`, elo, variante: 'paulista', formato: '1x1', codigoDupla: null, desde: T0, ...extra };
};
const ids = (xs: EntradaFila[]) => xs.map((x) => x.id);

describe('faixa', () => {
  test('100, +50 a cada 15 s, teto 1000', () => {
    expect(faixa(0)).toBe(100);
    expect(faixa(14_999)).toBe(100);
    expect(faixa(15_000)).toBe(150);
    expect(faixa(60_000)).toBe(300);
    expect(faixa(10 * 60_000)).toBe(1000);
    expect(faixa(-5)).toBe(100);
  });
});

describe('normalizarCodigoDupla', () => {
  test('4 a 12 letras/números, maiúsculas', () => {
    expect(normalizarCodigoDupla(' ze123 ')).toBe('ZE123');
    expect(normalizarCodigoDupla('abc')).toBeNull();
    expect(normalizarCodigoDupla('com espaço')).toBeNull();
    expect(normalizarCodigoDupla(7)).toBeNull();
  });
});

describe('parear 1x1', () => {
  test('dentro da faixa: casa', () => {
    const a = e(1000);
    const b = e(1050);
    expect(parear([a, b], T0)).toEqual([{ variante: 'paulista', formato: '1x1', times: [[a], [b]] }]);
  });

  test('fora da faixa espera; a faixa alarga com o tempo', () => {
    const a = e(1000);
    const b = e(1300);
    expect(parear([a, b], T0)).toEqual([]);
    expect(parear([a, b], T0 + 59_999)).toEqual([]);
    expect(parear([a, b], T0 + 60_000)).toHaveLength(1);
  });

  test('a faixa maior dos dois vale (quem espera há mais tempo puxa o novato)', () => {
    const velho = e(1000, { desde: T0 - 60_000 });
    const novo = e(1300);
    expect(parear([velho, novo], T0)).toHaveLength(1);
  });

  test('o mais antigo escolhe o mais próximo em Elo', () => {
    const a = e(1000, { desde: T0 - 1 });
    const longe = e(1090);
    const perto = e(1020);
    const [p] = parear([a, longe, perto], T0);
    expect(p.times).toEqual([[a], [perto]]);
  });

  test('variantes e formatos diferentes não se misturam', () => {
    expect(parear([e(1000), e(1000, { variante: 'mineiro' })], T0)).toEqual([]);
    expect(parear([e(1000), e(1000, { formato: '2x2' })], T0)).toEqual([]);
  });

  test('código de dupla é ignorado no 1x1', () => {
    expect(parear([e(1000, { codigoDupla: 'AMIGOS' }), e(1000, { codigoDupla: 'AMIGOS' })], T0)).toHaveLength(1);
  });
});

describe('parear 2x2', () => {
  test('quatro solos: os dois mais próximos viram dupla', () => {
    const [a, b, c, d] = [e(1000, { formato: '2x2' }), e(1010, { formato: '2x2' }), e(1020, { formato: '2x2' }), e(1030, { formato: '2x2' })];
    const [p] = parear([d, c, b, a], T0);
    expect(p.times.map(ids)).toEqual([ids([a, b]), ids([c, d])]);
  });

  test('dupla completa por código contra dois solos', () => {
    const x1 = e(1000, { formato: '2x2', codigoDupla: 'ZE12' });
    const x2 = e(1100, { formato: '2x2', codigoDupla: 'ZE12' });
    const s1 = e(1040, { formato: '2x2' });
    const s2 = e(1060, { formato: '2x2' });
    const [p] = parear([x1, s1, x2, s2], T0);
    expect(p.times.map((t) => ids(t).sort())).toEqual([ids([x1, x2]).sort(), ids([s1, s2]).sort()]);
  });

  test('dupla incompleta não entra', () => {
    const sozinho = e(1000, { formato: '2x2', codigoDupla: 'ZE12' });
    expect(parear([sozinho, e(1000, { formato: '2x2' }), e(1000, { formato: '2x2' })], T0)).toEqual([]);
  });
});

describe('cadeirasDoPareamento', () => {
  test('1x1: 0 e 1; 2x2: dupla A em 0/2, dupla B em 1/3', () => {
    const [a, b, c, d] = [e(1), e(2), e(3), e(4)];
    expect(cadeirasDoPareamento({ variante: 'paulista', formato: '1x1', times: [[a], [b]] }).map((x) => [x.entrada.id, x.cadeira])).toEqual([
      [a.id, 0],
      [b.id, 1],
    ]);
    expect(cadeirasDoPareamento({ variante: 'paulista', formato: '2x2', times: [[a, b], [c, d]] }).map((x) => [x.entrada.id, x.cadeira])).toEqual([
      [a.id, 0],
      [b.id, 2],
      [c.id, 1],
      [d.id, 3],
    ]);
  });
});

describe('Fila', () => {
  test('mesmo usuário em outra aba substitui a entrada antiga', () => {
    const f = new Fila();
    const a = e(1000);
    expect(f.entrar(a)).toBeNull();
    expect(f.entrar({ ...a, id: 'outra-aba' })).toEqual(a);
    expect(f.tamanho).toBe(1);
  });

  test('rodada tira os pareados; devolver recoloca; status', () => {
    const f = new Fila();
    const [a, b, c] = [e(1000), e(1000), e(1900)];
    for (const x of [a, b, c]) f.entrar(x);
    expect(f.status(c.id, T0 + 15_000)).toEqual({ esperaS: 15, faixa: 150, naFila: 3, aguardandoParceiro: false });
    const ps = f.rodada(T0);
    expect(ps).toHaveLength(1);
    expect(f.tamanho).toBe(1);
    expect(f.status(a.id, T0)).toBeNull();
    f.devolver(ps[0]);
    expect(f.tamanho).toBe(3);
    expect(f.sair(c.id)).toBe(true);
    expect(f.sair(c.id)).toBe(false);
  });

  test('status: aguardando parceiro com o mesmo código', () => {
    const f = new Fila();
    const a = e(1000, { formato: '2x2', codigoDupla: 'ZE12' });
    f.entrar(a);
    expect(f.status(a.id, T0)?.aguardandoParceiro).toBe(true);
    f.entrar(e(1000, { formato: '2x2', codigoDupla: 'ZE12' }));
    expect(f.status(a.id, T0)?.aguardandoParceiro).toBe(false);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test fila`
Expected: FAIL — `Failed to load url ../src/fila/fila`.

**Step 3: Implementação**

`apps/server/src/fila/fila.ts`
```ts
import type { Cadeira, Variante } from '@truco/engine';
import type { Formato, MsgStatusFila } from '../api/tipos';
import { media } from '../ranking/elo';

export interface EntradaFila {
  /** sessionId do cliente na sala `fila`. */
  id: string;
  usuarioId: number;
  apelido: string;
  elo: number;
  variante: Variante;
  formato: Formato;
  /** Só no 2x2: amigos que digitam o mesmo código ficam parceiros. */
  codigoDupla: string | null;
  /** Epoch ms de entrada. */
  desde: number;
}

export interface Pareamento {
  variante: Variante;
  formato: Formato;
  times: [EntradaFila[], EntradaFila[]];
}

export const FAIXA_INICIAL = 100;
export const PASSO_FAIXA = 50;
export const INTERVALO_FAIXA_MS = 15_000;
export const FAIXA_MAXIMA = 1000;

/** Diferença de Elo aceita para quem espera há `esperaMs`. */
export function faixa(esperaMs: number): number {
  return Math.min(FAIXA_MAXIMA, FAIXA_INICIAL + PASSO_FAIXA * Math.floor(Math.max(0, esperaMs) / INTERVALO_FAIXA_MS));
}

export function normalizarCodigoDupla(cru: unknown): string | null {
  if (typeof cru !== 'string') return null;
  const c = cru.trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(c) ? c : null;
}

interface Grupo {
  membros: EntradaFila[];
  elo: number;
  desde: number;
}

const grupo = (membros: EntradaFila[]): Grupo => ({
  membros,
  elo: media(membros.map((m) => m.elo)),
  desde: Math.min(...membros.map((m) => m.desde)),
});

function cabem(a: Grupo, b: Grupo, agora: number): boolean {
  return Math.abs(a.elo - b.elo) <= Math.max(faixa(agora - a.desde), faixa(agora - b.desde));
}

/** Guloso: o grupo mais antigo escolhe o mais próximo em Elo que caiba na faixa. */
function casar(grupos: Grupo[], agora: number): [Grupo, Grupo][] {
  const livres = [...grupos].sort((x, y) => x.desde - y.desde || x.elo - y.elo);
  const pares: [Grupo, Grupo][] = [];
  while (livres.length > 1) {
    const a = livres.shift()!;
    let melhor = -1;
    for (let i = 0; i < livres.length; i++) {
      if (!cabem(a, livres[i], agora)) continue;
      if (melhor < 0 || Math.abs(livres[i].elo - a.elo) < Math.abs(livres[melhor].elo - a.elo)) melhor = i;
    }
    if (melhor >= 0) pares.push([a, livres.splice(melhor, 1)[0]]);
  }
  return pares;
}

/** Pareamentos possíveis agora (função pura; a `Fila` tira os pareados). */
export function parear(entradas: readonly EntradaFila[], agora: number): Pareamento[] {
  const out: Pareamento[] = [];
  const chaves = [...new Set(entradas.map((x) => `${x.variante}|${x.formato}`))].sort();
  for (const chave of chaves) {
    const [variante, formato] = chave.split('|') as [Variante, Formato];
    const lista = entradas.filter((x) => x.variante === variante && x.formato === formato);
    if (formato === '1x1') {
      for (const [a, b] of casar(lista.map((x) => grupo([x])), agora)) out.push({ variante, formato, times: [a.membros, b.membros] });
      continue;
    }
    const porCodigo = new Map<string, EntradaFila[]>();
    const solos: EntradaFila[] = [];
    for (const x of lista) {
      if (x.codigoDupla) porCodigo.set(x.codigoDupla, [...(porCodigo.get(x.codigoDupla) ?? []), x]);
      else solos.push(x);
    }
    const times: Grupo[] = [];
    for (const membros of porCodigo.values()) {
      if (membros.length >= 2) times.push(grupo([...membros].sort((p, q) => p.desde - q.desde).slice(0, 2)));
    }
    for (const [a, b] of casar(solos.map((x) => grupo([x])), agora)) times.push(grupo([...a.membros, ...b.membros]));
    for (const [a, b] of casar(times, agora)) out.push({ variante, formato, times: [a.membros, b.membros] });
  }
  return out;
}

/** 1x1: cadeiras 0 e 1 (bots nas 2 e 3, parceiros). 2x2: dupla A em 0/2, B em 1/3. */
export function cadeirasDoPareamento(p: Pareamento): { entrada: EntradaFila; cadeira: Cadeira }[] {
  const [a, b] = p.times;
  if (p.formato === '1x1') {
    return [
      { entrada: a[0], cadeira: 0 },
      { entrada: b[0], cadeira: 1 },
    ];
  }
  return [
    { entrada: a[0], cadeira: 0 },
    { entrada: a[1], cadeira: 2 },
    { entrada: b[0], cadeira: 1 },
    { entrada: b[1], cadeira: 3 },
  ];
}

export class Fila {
  private readonly entradas = new Map<string, EntradaFila>();

  /** Entra. Se o mesmo usuário já estava (outra aba), tira e devolve a entrada antiga. */
  entrar(e: EntradaFila): EntradaFila | null {
    let antiga: EntradaFila | null = null;
    for (const x of this.entradas.values()) if (x.usuarioId === e.usuarioId) antiga = x;
    if (antiga) this.entradas.delete(antiga.id);
    this.entradas.set(e.id, e);
    return antiga;
  }

  sair(id: string): boolean {
    return this.entradas.delete(id);
  }

  get tamanho(): number {
    return this.entradas.size;
  }

  /** Pareia e tira da fila quem foi pareado. */
  rodada(agora: number): Pareamento[] {
    const ps = parear([...this.entradas.values()], agora);
    for (const p of ps) for (const t of p.times) for (const x of t) this.entradas.delete(x.id);
    return ps;
  }

  /** Recoloca (ex.: a mesa não pôde ser criada), mantendo o tempo de espera. */
  devolver(p: Pareamento): void {
    for (const t of p.times) for (const x of t) this.entradas.set(x.id, x);
  }

  status(id: string, agora: number): MsgStatusFila | null {
    const e = this.entradas.get(id);
    if (!e) return null;
    const mesma = [...this.entradas.values()].filter((x) => x.variante === e.variante && x.formato === e.formato);
    const aguardandoParceiro = e.formato === '2x2' && e.codigoDupla !== null && mesma.filter((x) => x.codigoDupla === e.codigoDupla).length < 2;
    return { esperaS: Math.floor((agora - e.desde) / 1000), faixa: faixa(agora - e.desde), naFila: mesma.length, aguardandoParceiro };
  }
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test fila`
Expected: PASS (16 testes).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server/src/fila apps/server/test/fila.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): fila ranqueada pura — pareamento por Elo com faixa que alarga e duplas por código" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: `FilaRoom` — fila no Colyseus, mesa ranqueada com assentos reservados e bloqueio

**Files:**
- Create: `apps/server/src/FilaRoom.ts`
- Modify: `apps/server/src/servidor.ts`
- Test: `apps/server/test/integracao.test.ts`

**Step 1: Teste que falha**

Em `apps/server/test/integracao.test.ts`:
- imports novos: `import { REGRAS_RANQUEADA } from '@truco/engine';`, `import { FilaRoom } from '../src/FilaRoom';`, `import { ratingDe } from '../src/repo/partidas';` e `bloqueiosFila` junto de `participacoes` no import do schema.
- no `beforeAll`, antes do `boot`: `FilaRoom.intervaloMs = 100;`
- novo `describe` no **fim** do arquivo (por último: as saídas no fim gravam no banco):
```ts
describe('fila ranqueada', () => {
  const FILA_1X1 = { variante: 'paulista', formato: '1x1' };

  test('convidado não entra na fila', async () => {
    await expect(colyseus.sdk.joinOrCreate('fila', FILA_1X1)).rejects.toThrow(/entre na sua conta/);
  });

  test('1x1: pareados numa mesa ranqueada privada com bots parceiros; abandono custa Elo e bloqueia', async () => {
    const ana = await logado('ana@x.com');
    const bia = await logado('bia@x.com');
    const fa = coletor(await ana.cliente.joinOrCreate('fila', FILA_1X1));
    const fb = coletor(await bia.cliente.joinOrCreate('fila', FILA_1X1));
    await esperar(() => !!fa.pareado?.length && !!fb.pareado?.length);

    const mesaA = await ana.cliente.consumeSeatReservation(fa.pareado[0].reserva);
    const ma = coletor(mesaA);
    const mesaB = await bia.cliente.consumeSeatReservation(fb.pareado[0].reserva);
    const mb = coletor(mesaB);
    expect(mesaA.roomId).toBe(mesaB.roomId);
    await esperar(() => !!ma.estado?.some((m) => m.visao) && !!mb.estado?.some((m) => m.visao));
    const e = ma.estado.at(-1);
    expect(e.modo).toBe('ranqueada');
    expect(e.regras).toEqual(REGRAS_RANQUEADA.paulista);
    expect(e.cadeiras.map((c: any) => c.tipo)).toEqual(['humano', 'humano', 'bot', 'bot']);
    expect([e.cadeiras[0].nome, e.cadeiras[1].nome].sort()).toEqual(['ana', 'bia']);
    expect((await salasAbertas()).map((s) => s.id)).not.toContain(mesaA.roomId);

    await mesaA.leave(true);
    await esperarAsync(async () => (await ratingDe(banco.db, ana.u.id, 'paulista')).elo === 984);
    await expect(ana.cliente.joinOrCreate('fila', FILA_1X1)).rejects.toThrow(/bloqueada/);

    await mesaB.leave(true);
    await esperarAsync(async () => (await banco.db.select().from(bloqueiosFila)).length === 2);
  });

  test('2x2: quem usa o mesmo código fica parceiro', async () => {
    const jogadores = [];
    for (const email of ['ana1@x.com', 'ana2@x.com', 'bia1@x.com', 'bia2@x.com']) jogadores.push(await logado(email));
    const filas = [];
    for (const [i, j] of jogadores.entries()) {
      const opcoes = { variante: 'mineiro', formato: '2x2', ...(i < 2 ? { codigoDupla: 'amigos' } : {}) };
      filas.push(coletor(await j.cliente.joinOrCreate('fila', opcoes)));
    }
    await esperar(() => filas.every((f) => !!f.pareado?.length));
    const mesas = [];
    for (const [i, j] of jogadores.entries()) mesas.push(await j.cliente.consumeSeatReservation(filas[i].pareado[0].reserva));
    const m0 = coletor(mesas[0]);
    for (const m of mesas.slice(1)) coletor(m);
    await esperar(() => !!m0.estado?.some((x) => x.visao));
    const nomes: string[] = m0.estado.at(-1).cadeiras.map((c: any) => c.nome);
    expect(nomes.indexOf('ana1') % 2).toBe(nomes.indexOf('ana2') % 2);
    expect(nomes.indexOf('bia1') % 2).toBe(nomes.indexOf('bia2') % 2);
    expect(m0.estado.at(-1).regras).toEqual(REGRAS_RANQUEADA.mineiro);

    for (const m of mesas) await m.leave(true);
    await esperarAsync(async () => (await banco.db.select().from(bloqueiosFila)).length === 4);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test integracao`
Expected: FAIL — `provided room name "fila" not defined`.

**Step 3: Implementação**

`apps/server/src/FilaRoom.ts`
```ts
import { type AuthContext, type Client, ErrorCode, matchMaker, Room, ServerError } from '@colyseus/core';
import type { Variante } from '@truco/engine';
import type { Formato, MsgPareado } from './api/tipos';
import { cadeirasDoPareamento, Fila, normalizarCodigoDupla, type Pareamento } from './fila/fila';
import { MesaRoom } from './MesaRoom';
import { bloqueioAte, ratingDe } from './repo/partidas';
import type { Servicos } from './servicos';
import { type UsuarioConexao, usuarioDaConexao } from './sessaoSala';

/** Close code: o mesmo usuário entrou na fila por outra aba. */
export const SAIDA_FILA_SUBSTITUIDA = 4011;

/**
 * Uma sala só (sem filtro) com todo mundo que está na fila. A cada `intervaloMs` pareia,
 * cria a mesa ranqueada, reserva os assentos e manda `pareado` com a reserva; o cliente
 * sai da fila e consome a reserva.
 */
export class FilaRoom extends Room {
  static servicos: Servicos | null = null;
  /** Sobrescrito nos testes. */
  static intervaloMs = 1_000;

  private readonly fila = new Fila();
  private rodando = false;

  static async onAuth(token: string, _options: unknown, context: AuthContext): Promise<unknown> {
    const s = FilaRoom.servicos;
    const u = await usuarioDaConexao(s, token, context.headers);
    if (!s || !u) throw new ServerError(ErrorCode.AUTH_FAILED, 'entre na sua conta para jogar ranqueada');
    const ate = await bloqueioAte(s.banco, u.usuarioId, s.agora());
    if (ate) throw new ServerError(ErrorCode.AUTH_FAILED, `fila bloqueada até ${ate.toISOString()} por abandono de partida ranqueada`);
    return u;
  }

  onCreate() {
    this.maxClients = 5_000;
    this.clock.setInterval(() => void this.rodada(), FilaRoom.intervaloMs);
  }

  async onJoin(client: Client, options?: { variante?: unknown; formato?: unknown; codigoDupla?: unknown }) {
    const s = FilaRoom.servicos!;
    const auth = client.auth as UsuarioConexao;
    const variante: Variante = options?.variante === 'mineiro' ? 'mineiro' : 'paulista';
    const formato: Formato = options?.formato === '2x2' ? '2x2' : '1x1';
    const { elo } = await ratingDe(s.banco, auth.usuarioId, variante);
    const antiga = this.fila.entrar({
      id: client.sessionId,
      usuarioId: auth.usuarioId,
      apelido: auth.apelido,
      elo,
      variante,
      formato,
      codigoDupla: formato === '2x2' ? normalizarCodigoDupla(options?.codigoDupla) : null,
      desde: Date.now(),
    });
    if (antiga) this.clients.getById(antiga.id)?.leave(SAIDA_FILA_SUBSTITUIDA);
    this.enviarStatus(client);
  }

  onLeave(client: Client) {
    this.fila.sair(client.sessionId);
  }

  private async rodada(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    try {
      for (const p of this.fila.rodada(Date.now())) {
        if (p.times.flat().some((x) => !this.clients.getById(x.id))) {
          this.devolverPresentes(p);
          continue;
        }
        try {
          await this.criarMesa(p);
        } catch (e) {
          console.error('[FilaRoom] falha ao criar mesa ranqueada', e);
          this.devolverPresentes(p);
        }
      }
      for (const c of this.clients) this.enviarStatus(c);
    } finally {
      this.rodando = false;
    }
  }

  private devolverPresentes(p: Pareamento): void {
    const presente = (x: { id: string }) => !!this.clients.getById(x.id);
    this.fila.devolver({ ...p, times: [p.times[0].filter(presente), p.times[1].filter(presente)] });
  }

  private async criarMesa(p: Pareamento): Promise<void> {
    const assentos = cadeirasDoPareamento(p);
    const sala = await matchMaker.createRoom('mesa', {
      modo: 'ranqueada',
      variante: p.variante,
      humanos: assentos.length,
      fichaInterna: MesaRoom.fichaInterna,
      jogadores: assentos.map((a) => ({ usuarioId: a.entrada.usuarioId, cadeira: a.cadeira })),
    });
    for (const a of assentos) {
      const auth: UsuarioConexao = { usuarioId: a.entrada.usuarioId, apelido: a.entrada.apelido };
      // O authData vira `client.auth` na mesa (sem passar pelo onAuth de novo).
      const reserva = await matchMaker.reserveSeatFor(sala, { nome: a.entrada.apelido }, auth);
      const msg: MsgPareado = { reserva };
      this.clients.getById(a.entrada.id)?.send('pareado', msg);
    }
  }

  private enviarStatus(c: Client): void {
    const st = this.fila.status(c.sessionId, Date.now());
    if (st) c.send('status', st);
  }
}
```

`apps/server/src/servidor.ts` — importe `FilaRoom`, acrescente `FilaRoom.servicos = servicos;` logo abaixo de `MesaRoom.servicos = servicos;` e registre a sala:
```ts
    rooms: {
      mesa: defineRoom(MesaRoom).filterBy(['modo', 'variante', 'humanos', 'nivelBot', 'chaveRegras']),
      fila: defineRoom(FilaRoom),
    },
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test integracao`
Expected: PASS — inclusive os 3 testes da fila (o 2x2 leva alguns segundos).

Run: `pnpm --filter @truco/server test` e `pnpm --filter @truco/server typecheck` → tudo verde.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/server
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): sala fila cria mesas ranqueadas 1x1/2x2 com assentos reservados; bloqueio por abandono" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Build e start de produção na raiz + teste de fumaça local (sem Docker)

**Files:**
- Modify: `package.json` (raiz), `apps/server/package.json`, `apps/server/tsconfig.json`
- Create: `apps/server/scripts/fumaca.ts`

**Step 1: Scripts**

`package.json` da raiz — em `scripts`, acrescente:
```json
    "build": "pnpm --filter @truco/web build",
    "start": "pnpm --filter @truco/server start",
```
(O server roda TypeScript direto com `tsx`, como em dev: não há etapa de build do server. `tsx` já é dependência de produção do `@truco/server`.)

`apps/server/package.json` — em `scripts`, acrescente `"fumaca": "tsx scripts/fumaca.ts"`. `apps/server/tsconfig.json` — acrescente `"scripts"` ao `include`.

**Step 2: Teste de fumaça (falha sem servidor)**

`apps/server/scripts/fumaca.ts`
```ts
/**
 * Teste de fumaça contra um servidor já rodando (local ou Railway):
 *   TRUCO_URL_FUMACA=http://127.0.0.1:2580 pnpm --filter @truco/server fumaca
 */
import { Client } from '@colyseus/sdk';

const base = (process.env.TRUCO_URL_FUMACA ?? 'http://127.0.0.1:2567').replace(/\/+$/, '');

function ok(cond: unknown, msg: string): void {
  if (!cond) {
    console.error(`FALHOU: ${msg}`);
    process.exit(1);
  }
  console.log(`ok: ${msg}`);
}

const saude = await fetch(`${base}/saude`);
ok(saude.status === 200, 'GET /saude responde 200');
ok((await fetch(`${base}/`).then((r) => r.text())).includes('id="raiz"'), 'GET / serve o index.html do web');
ok((await fetch(`${base}/ranking/paulista`).then((r) => r.text())).includes('id="raiz"'), 'rota desconhecida cai no index.html');
const cfg = await fetch(`${base}/api/config`).then((r) => r.json());
ok(typeof cfg === 'object' && 'google' in cfg, 'GET /api/config responde JSON');
const ranking = await fetch(`${base}/api/ranking/paulista`).then((r) => r.json());
ok(Array.isArray(ranking.linhas), 'GET /api/ranking/paulista lê do banco');

const sala = await new Client(base).joinOrCreate('mesa', { humanos: 1, nome: 'Fumaça' });
const estado = await new Promise<{ cadeiras: { tipo: string }[] }>((resolver, rejeitar) => {
  const t = setTimeout(() => rejeitar(new Error('nenhum estado com visão em 10 s')), 10_000);
  for (const tipo of ['acao', 'sinal', 'fala', 'erro', 'chat']) sala.onMessage(tipo, () => {});
  sala.onMessage('estado', (m: { visao: unknown; cadeiras: { tipo: string }[] }) => {
    if (!m.visao) return;
    clearTimeout(t);
    resolver(m);
  });
  sala.send('sincronizar');
});
ok(estado.cadeiras.filter((c) => c.tipo === 'bot').length === 3, 'WebSocket: mesa com 3 bots começou');
await sala.leave(true);
console.log('fumaça: tudo certo');
process.exit(0);
```

Run (sem servidor no ar): `pnpm --filter @truco/server fumaca`
Expected: FAIL — `fetch failed` / `ECONNREFUSED` (prova que o script testa algo de verdade).

**Step 3: Build de produção e servidor em modo produção**

Run: `pnpm build`
Expected: `vite v5.4.x building for production...` e `✓ built in ...`, com `apps/web/dist/index.html` e `apps/web/dist/assets/*`.

Em um terminal (Git Bash; ou rode em segundo plano):
```
NODE_ENV=production TRUCO_PGLITE=memoria PORT=2580 pnpm start
```
(PowerShell: `$env:NODE_ENV='production'; $env:TRUCO_PGLITE='memoria'; $env:PORT='2580'; pnpm start`)
Expected no log:
```
truco: aviso: produção sem DATABASE_URL: usando PGlite (...)
truco: aviso: produção sem URL pública (...)
truco: aviso: produção sem RESEND_API_KEY: links mágicos só aparecem no log
truco: servidor ouvindo na porta 2580 (banco: pglite em memória; web: build servido)
```

**Step 4: Fumaça passa**

Em outro terminal:
Run: `TRUCO_URL_FUMACA=http://127.0.0.1:2580 pnpm --filter @truco/server fumaca` (PowerShell: `$env:TRUCO_URL_FUMACA='http://127.0.0.1:2580'; pnpm --filter @truco/server fumaca`)
Expected:
```
ok: GET /saude responde 200
ok: GET / serve o index.html do web
ok: rota desconhecida cai no index.html
ok: GET /api/config responde JSON
ok: GET /api/ranking/paulista lê do banco
ok: WebSocket: mesa com 3 bots começou
fumaça: tudo certo
```
Abra `http://127.0.0.1:2580` no navegador: o lobby carrega da mesma origem (o `urlServidor()` do web, em produção, usa `ws(s)://<mesmo host>` — conferido em `apps/web/src/rede/url.ts`). Pare o servidor (Ctrl+C).

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add package.json apps/server
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "chore: build/start de produção na raiz e teste de fumaça HTTP+WS" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Web — proxy da API, alias `@truco/api`, cliente HTTP, sessão e rotas por hash

**Files:**
- Modify: `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/rede/hooks.ts`, `apps/web/src/rede/instancia.ts`
- Create: `apps/web/src/rede/api.ts`, `apps/web/src/rede/sessao.ts`, `apps/web/src/rede/rota.ts`, `apps/web/src/logica/rotas.ts`
- Test: `apps/web/test/rotas.test.ts`, `apps/web/test/api.test.ts`, `apps/web/test/sessao.test.ts`

**Step 1: Configuração**

`apps/web/vite.config.ts`:
- antes do `export default`: `const alvoApi = process.env.TRUCO_PROXY_API ?? 'http://localhost:2567';`
- no `alias`, acrescente `'@truco/api': caminho('../server/src/api/tipos.ts'),`
- troque a linha do `server` por:
```ts
  // host: true expõe na rede local para testar no celular (o WebSocket vai a <mesmo-host>:2567).
  // /api e /saude passam pelo proxy: o cookie de sessão fica na origem da página.
  server: { port: 5173, host: true, proxy: { '/api': alvoApi, '/saude': alvoApi } },
```
`apps/web/tsconfig.json` — em `paths`, acrescente `"@truco/api": ["../server/src/api/tipos.ts"]`.

**Step 2: Testes que falham**

`apps/web/test/rotas.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { hrefDe, lerRota, linkConvite } from '../src/logica/rotas';

describe('rotas por hash', () => {
  test('lerRota', () => {
    expect(lerRota('')).toEqual({ tela: 'inicio' });
    expect(lerRota('#/')).toEqual({ tela: 'inicio' });
    expect(lerRota('#/entrar')).toEqual({ tela: 'entrar', token: null });
    expect(lerRota('#/entrar?token=abc_-1')).toEqual({ tela: 'entrar', token: 'abc_-1' });
    expect(lerRota('#/perfil')).toEqual({ tela: 'perfil', id: null });
    expect(lerRota('#/perfil/12')).toEqual({ tela: 'perfil', id: 12 });
    expect(lerRota('#/perfil/x')).toEqual({ tela: 'perfil', id: null });
    expect(lerRota('#/historico')).toEqual({ tela: 'historico' });
    expect(lerRota('#/ranking')).toEqual({ tela: 'ranking', variante: 'paulista' });
    expect(lerRota('#/ranking/mineiro')).toEqual({ tela: 'ranking', variante: 'mineiro' });
    expect(lerRota('#/salas')).toEqual({ tela: 'salas' });
    expect(lerRota('#/privada/AbC123xyz')).toEqual({ tela: 'privada', codigo: 'AbC123xyz' });
    expect(lerRota('#/privada/<script>')).toEqual({ tela: 'inicio' });
    expect(lerRota('#/fila')).toEqual({ tela: 'fila' });
    expect(lerRota('#/nada')).toEqual({ tela: 'inicio' });
  });

  test('hrefDe é o inverso de lerRota', () => {
    for (const h of ['#/', '#/entrar', '#/entrar?token=t1', '#/perfil', '#/perfil/3', '#/historico', '#/ranking/mineiro', '#/salas', '#/privada/abcd', '#/fila']) {
      expect(hrefDe(lerRota(h))).toBe(h);
    }
  });

  test('linkConvite', () => {
    expect(linkConvite('https://truco.app', 'abcd')).toBe('https://truco.app/#/privada/abcd');
  });
});
```

`apps/web/test/api.test.ts`
```ts
import { describe, expect, test, vi } from 'vitest';
import { criarApi, ErroApi } from '../src/rede/api';

function fetchFalso(respostas: Response[]) {
  const f = vi.fn(async (_url: string, _init?: RequestInit) => respostas.shift()!);
  return f;
}

describe('cliente da API', () => {
  test('GET com credenciais da mesma origem', async () => {
    const f = fetchFalso([new Response(JSON.stringify({ usuario: null }), { status: 200 })]);
    expect(await criarApi(f as unknown as typeof fetch).eu()).toEqual({ usuario: null });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/eu');
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  test('POST manda JSON; 204 devolve undefined', async () => {
    const f = fetchFalso([new Response(null, { status: 204 })]);
    expect(await criarApi(f as unknown as typeof fetch).pedirLink('ana@x.com')).toBeUndefined();
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/auth/link');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe('{"email":"ana@x.com"}');
  });

  test('erro HTTP vira ErroApi com a mensagem do servidor', async () => {
    const f = fetchFalso([new Response(JSON.stringify({ erro: 'link inválido ou expirado; peça outro' }), { status: 400 })]);
    const e = await criarApi(f as unknown as typeof fetch).confirmarLink('x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroApi);
    expect(e).toMatchObject({ status: 400, message: 'link inválido ou expirado; peça outro' });
  });

  test('caminhos', async () => {
    const corpo = () => new Response('{}', { status: 200 });
    const f = fetchFalso([corpo(), corpo(), corpo(), corpo(), corpo(), corpo(), corpo()]);
    const api = criarApi(f as unknown as typeof fetch);
    await api.perfil();
    await api.perfil(7);
    await api.historico();
    await api.ranking('mineiro');
    await api.salas();
    await api.trocarApelido('Zé');
    await api.sair();
    expect(f.mock.calls.map(([u, i]) => `${i?.method} ${u}`)).toEqual([
      'GET /api/perfil',
      'GET /api/perfil/7',
      'GET /api/historico',
      'GET /api/ranking/mineiro',
      'GET /api/salas',
      'PATCH /api/eu',
      'POST /api/auth/sair',
    ]);
  });
});
```

`apps/web/test/sessao.test.ts`
```ts
import { describe, expect, test, vi } from 'vitest';
import { criarSessao } from '../src/rede/sessao';

const USUARIO = { id: 1, apelido: 'ana', email: 'ana@x.com' };

describe('sessão', () => {
  test('carregar busca config e usuário', async () => {
    const s = criarSessao({
      config: vi.fn(async () => ({ google: 'cid', emailTeste: false })),
      eu: vi.fn(async () => ({ usuario: USUARIO })),
      sair: vi.fn(),
    });
    expect(s.getSnapshot().pronta).toBe(false);
    const ouvinte = vi.fn();
    s.subscribe(ouvinte);
    await s.carregar();
    expect(s.getSnapshot()).toEqual({ pronta: true, usuario: USUARIO, config: { google: 'cid', emailTeste: false } });
    expect(ouvinte).toHaveBeenCalled();
  });

  test('servidor fora do ar: pronta, sem usuário e sem Google', async () => {
    const s = criarSessao({ config: vi.fn(async () => Promise.reject(new Error('x'))), eu: vi.fn(async () => Promise.reject(new Error('x'))), sair: vi.fn() });
    await s.carregar();
    expect(s.getSnapshot()).toEqual({ pronta: true, usuario: null, config: { google: null, emailTeste: false } });
  });

  test('definirUsuario e sair (mesmo se o pedido falhar)', async () => {
    const s = criarSessao({ config: vi.fn(), eu: vi.fn(), sair: vi.fn(async () => Promise.reject(new Error('rede'))) });
    s.definirUsuario(USUARIO);
    expect(s.getSnapshot().usuario).toEqual(USUARIO);
    await s.sair();
    expect(s.getSnapshot().usuario).toBeNull();
  });
});
```

**Step 3: Rodar e ver falhar**

Run: `pnpm --filter @truco/web test rotas api sessao`
Expected: FAIL — módulos inexistentes.

**Step 4: Implementação**

`apps/web/src/logica/rotas.ts`
```ts
import type { Variante } from '@truco/engine';

export type Rota =
  | { tela: 'inicio' }
  | { tela: 'entrar'; token: string | null }
  | { tela: 'perfil'; id: number | null }
  | { tela: 'historico' }
  | { tela: 'ranking'; variante: Variante }
  | { tela: 'salas' }
  | { tela: 'privada'; codigo: string }
  | { tela: 'fila' };

export function lerRota(hash: string): Rota {
  const [caminho, busca = ''] = hash.replace(/^#/, '').split('?');
  const partes = caminho.split('/').filter(Boolean);
  switch (partes[0]) {
    case 'entrar':
      return { tela: 'entrar', token: new URLSearchParams(busca).get('token') || null };
    case 'perfil': {
      const id = Number(partes[1]);
      return { tela: 'perfil', id: Number.isInteger(id) && id > 0 ? id : null };
    }
    case 'historico':
      return { tela: 'historico' };
    case 'ranking':
      return { tela: 'ranking', variante: partes[1] === 'mineiro' ? 'mineiro' : 'paulista' };
    case 'salas':
      return { tela: 'salas' };
    case 'privada':
      return partes[1] && /^[A-Za-z0-9_-]{4,40}$/.test(partes[1]) ? { tela: 'privada', codigo: partes[1] } : { tela: 'inicio' };
    case 'fila':
      return { tela: 'fila' };
    default:
      return { tela: 'inicio' };
  }
}

export function hrefDe(r: Rota): string {
  switch (r.tela) {
    case 'inicio':
      return '#/';
    case 'entrar':
      return r.token ? `#/entrar?token=${encodeURIComponent(r.token)}` : '#/entrar';
    case 'perfil':
      return r.id ? `#/perfil/${r.id}` : '#/perfil';
    case 'historico':
      return '#/historico';
    case 'ranking':
      return `#/ranking/${r.variante}`;
    case 'salas':
      return '#/salas';
    case 'privada':
      return `#/privada/${r.codigo}`;
    case 'fila':
      return '#/fila';
  }
}

/** Link para mandar aos amigos (mesa privada). */
export const linkConvite = (origem: string, codigo: string): string => `${origem}/${hrefDe({ tela: 'privada', codigo })}`;
```

`apps/web/src/rede/rota.ts`
```ts
import { useMemo, useSyncExternalStore } from 'react';
import { hrefDe, lerRota, type Rota } from '../logica/rotas';

function assinar(f: () => void): () => void {
  window.addEventListener('hashchange', f);
  return () => window.removeEventListener('hashchange', f);
}

const hashAtual = () => window.location.hash;

export function useRota(): Rota {
  const hash = useSyncExternalStore(assinar, hashAtual);
  return useMemo(() => lerRota(hash), [hash]);
}

export function navegar(r: Rota): void {
  window.location.hash = hrefDe(r).slice(1);
}
```

`apps/web/src/rede/api.ts`
```ts
import type { Variante } from '@truco/engine';
import type { ConfigApi, ItemHistorico, LinhaRanking, PerfilApi, SalaAberta, UsuarioApi } from '@truco/api';

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Cliente da API HTTP do server. Em dev o Vite faz proxy de /api; em produção é a mesma origem. */
export function criarApi(f: typeof fetch = (...a) => fetch(...a), base = '') {
  async function pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    const r = await f(`${base}${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (r.status === 204) return undefined as T;
    const dados = (await r.json().catch(() => null)) as { erro?: string } | null;
    if (!r.ok) throw new ErroApi(r.status, dados?.erro ?? `erro ${r.status}`);
    return dados as T;
  }
  return {
    config: () => pedir<ConfigApi>('GET', '/api/config'),
    eu: () => pedir<{ usuario: UsuarioApi | null }>('GET', '/api/eu'),
    trocarApelido: (apelido: string) => pedir<{ usuario: UsuarioApi }>('PATCH', '/api/eu', { apelido }),
    pedirLink: (email: string) => pedir<void>('POST', '/api/auth/link', { email }),
    confirmarLink: (token: string) => pedir<{ usuario: UsuarioApi }>('POST', '/api/auth/link/confirmar', { token }),
    entrarGoogle: (credencial: string) => pedir<{ usuario: UsuarioApi }>('POST', '/api/auth/google', { credencial }),
    sair: () => pedir<void>('POST', '/api/auth/sair', {}),
    perfil: (id?: number) => pedir<PerfilApi>('GET', id ? `/api/perfil/${id}` : '/api/perfil'),
    historico: () => pedir<{ partidas: ItemHistorico[] }>('GET', '/api/historico'),
    ranking: (v: Variante) => pedir<{ linhas: LinhaRanking[] }>('GET', `/api/ranking/${v}`),
    salas: () => pedir<{ salas: SalaAberta[] }>('GET', '/api/salas'),
  };
}

export type Api = ReturnType<typeof criarApi>;
```

`apps/web/src/rede/sessao.ts`
```ts
import type { ConfigApi, UsuarioApi } from '@truco/api';
import type { Api } from './api';

export interface EstadoSessao {
  /** Já perguntou ao servidor (até lá, não mostra "Entrar"/"Sair" piscando). */
  pronta: boolean;
  usuario: UsuarioApi | null;
  config: ConfigApi;
}

const CONFIG_VAZIA: ConfigApi = { google: null, emailTeste: false };

/** Quem está logado + configuração pública; mesmo padrão da loja (useSyncExternalStore). */
export function criarSessao(api: Pick<Api, 'config' | 'eu' | 'sair'>) {
  let estado: EstadoSessao = { pronta: false, usuario: null, config: CONFIG_VAZIA };
  const ouvintes = new Set<() => void>();
  const mudar = (p: Partial<EstadoSessao>) => {
    estado = { ...estado, ...p };
    for (const f of ouvintes) f();
  };
  return {
    subscribe(f: () => void): () => void {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    getSnapshot: (): EstadoSessao => estado,
    async carregar(): Promise<void> {
      const [c, e] = await Promise.allSettled([api.config(), api.eu()]);
      mudar({
        pronta: true,
        config: c.status === 'fulfilled' ? c.value : CONFIG_VAZIA,
        usuario: e.status === 'fulfilled' ? e.value.usuario : null,
      });
    },
    definirUsuario: (u: UsuarioApi | null) => mudar({ usuario: u }),
    async sair(): Promise<void> {
      try {
        await api.sair();
      } catch {
        // o cookie expira sozinho; localmente já saímos
      } finally {
        mudar({ usuario: null });
      }
    },
  };
}

export type Sessao = ReturnType<typeof criarSessao>;
```

`apps/web/src/rede/hooks.ts` — acrescente (e `useState`/`useEffect` já estão importados):
```ts
import type { EstadoSessao, Sessao } from './sessao';

export const useSessao = (s: Sessao): EstadoSessao => useSyncExternalStore(s.subscribe, s.getSnapshot);

/** Busca dados ao montar e quando `deps` mudam; `recarregar()` busca de novo. */
export function useCarregar<T>(fn: () => Promise<T>, deps: readonly unknown[]) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string | null; carregando: boolean }>({ dados: null, erro: null, carregando: true });
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    fn().then(
      (dados) => {
        if (vivo) setEstado({ dados, erro: null, carregando: false });
      },
      (e: unknown) => {
        if (vivo) setEstado({ dados: null, erro: e instanceof Error ? e.message : String(e), carregando: false });
      },
    );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao]);
  return { ...estado, recarregar: () => setVersao((v) => v + 1) };
}
```
(Coloque o `import type` junto dos outros imports do topo.)

`apps/web/src/rede/instancia.ts` (arquivo inteiro):
```ts
import { criarApi } from './api';
import { gravarToken } from './conexao';
import { criarLoja } from './loja';
import { criarSessao } from './sessao';

/** A loja única da aplicação. */
export const loja = criarLoja({ persistirToken: gravarToken });
export const api = criarApi();
export const sessao = criarSessao(api);
```

**Step 5: Rodar e ver passar**

Run: `pnpm --filter @truco/web test`
Expected: PASS — os novos (rotas 3, api 4, sessão 3) e os antigos.

Run: `pnpm --filter @truco/web typecheck` → sem erros.

**Step 6: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/web
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(web): cliente da API, sessão, rotas por hash e proxy /api no Vite" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Web — tela Entrar (link mágico + Google), cabeçalho e App com rotas

**Files:**
- Create: `apps/web/src/telas/Entrar.tsx`, `apps/web/src/componentes/BotaoGoogle.tsx`, `apps/web/src/componentes/Cabecalho.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/telas/Lobby.tsx`, `apps/web/src/estilos.css`
- Test: `apps/web/test/entrar.test.tsx`, `apps/web/test/lobby.test.tsx`

**Step 1: Testes que falham**

`apps/web/test/entrar.test.tsx`
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BotaoGoogle, type GoogleId } from '../src/componentes/BotaoGoogle';
import { Cabecalho } from '../src/componentes/Cabecalho';
import { ErroApi } from '../src/rede/api';
import { TelaEntrar } from '../src/telas/Entrar';

const USUARIO = { id: 1, apelido: 'ana', email: 'ana@x.com' };
const SEM_GOOGLE = { google: null, emailTeste: false };

function apiFalsa() {
  return {
    pedirLink: vi.fn(async () => undefined),
    confirmarLink: vi.fn(async () => ({ usuario: USUARIO })),
    entrarGoogle: vi.fn(async () => ({ usuario: USUARIO })),
  };
}

describe('TelaEntrar', () => {
  test('pede o link e avisa para abrir neste navegador', async () => {
    const user = userEvent.setup();
    const api = apiFalsa();
    render(<TelaEntrar token={null} config={SEM_GOOGLE} api={api} aoEntrar={vi.fn()} />);
    await user.type(screen.getByLabelText('E-mail'), 'ana@x.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(api.pedirLink).toHaveBeenCalledWith('ana@x.com');
    expect(await screen.findByText(/Enviamos um link/)).toHaveTextContent('ana@x.com');
    expect(screen.queryByTestId('botao-google')).toBeNull();
  });

  test('erro do servidor aparece como alerta', async () => {
    const user = userEvent.setup();
    const api = { ...apiFalsa(), pedirLink: vi.fn(async () => Promise.reject(new ErroApi(429, 'muitos pedidos; tente de novo em alguns minutos'))) };
    render(<TelaEntrar token={null} config={SEM_GOOGLE} api={api} aoEntrar={vi.fn()} />);
    await user.type(screen.getByLabelText('E-mail'), 'ana@x.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('muitos pedidos');
  });

  test('com token na rota, confirma uma vez só e entra', async () => {
    const api = apiFalsa();
    const aoEntrar = vi.fn();
    const { rerender } = render(<TelaEntrar token="tok" config={SEM_GOOGLE} api={api} aoEntrar={aoEntrar} />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando…');
    await waitFor(() => expect(aoEntrar).toHaveBeenCalledWith(USUARIO));
    rerender(<TelaEntrar token="tok" config={SEM_GOOGLE} api={api} aoEntrar={aoEntrar} />);
    expect(api.confirmarLink).toHaveBeenCalledTimes(1);
  });

  test('token inválido mostra o erro e volta ao formulário', async () => {
    const api = { ...apiFalsa(), confirmarLink: vi.fn(async () => Promise.reject(new ErroApi(400, 'link inválido ou expirado; peça outro'))) };
    render(<TelaEntrar token="velho" config={SEM_GOOGLE} api={api} aoEntrar={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('link inválido');
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });
});

describe('BotaoGoogle', () => {
  test('inicializa com o client ID, desenha o botão e repassa a credencial', async () => {
    const capturado: { cb?: (r: { credential: string }) => void } = {};
    const g: GoogleId = {
      initialize: vi.fn((o: Parameters<GoogleId['initialize']>[0]) => {
        capturado.cb = o.callback;
      }),
      renderButton: vi.fn(),
    };
    const aoCredencial = vi.fn();
    render(<BotaoGoogle clientId="cid" aoCredencial={aoCredencial} carregar={async () => g} />);
    await waitFor(() => expect(g.renderButton).toHaveBeenCalledWith(screen.getByTestId('botao-google'), expect.objectContaining({ locale: 'pt-BR' })));
    expect(g.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'cid' }));
    capturado.cb!({ credential: 'jwt' });
    expect(aoCredencial).toHaveBeenCalledWith('jwt');
  });

  test('aparece na tela Entrar quando o servidor tem Google', () => {
    render(<TelaEntrar token={null} config={{ google: 'cid', emailTeste: false }} api={apiFalsa()} aoEntrar={vi.fn()} carregarGoogle={() => new Promise(() => {})} />);
    expect(screen.getByTestId('botao-google')).toBeInTheDocument();
  });
});

describe('Cabecalho', () => {
  test('convidado vê Entrar; logado vê apelido, Perfil, Histórico e Sair da conta', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Cabecalho usuario={null} aoSair={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '#/entrar');
    expect(screen.queryByRole('link', { name: 'Perfil' })).toBeNull();
    const aoSair = vi.fn();
    rerender(<Cabecalho usuario={USUARIO} aoSair={aoSair} />);
    expect(screen.getByTestId('usuario-logado')).toHaveTextContent('ana');
    expect(screen.getByRole('link', { name: 'Histórico' })).toHaveAttribute('href', '#/historico');
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(aoSair).toHaveBeenCalled();
  });
});
```

Em `apps/web/test/lobby.test.tsx`, troque o teste `'preenche o apelido salvo; ranqueada fica para depois'` por:
```tsx
  test('preenche o apelido salvo; botão Ranqueada chama aoRanqueada', async () => {
    const user = userEvent.setup();
    localStorage.setItem(CHAVE_APELIDO, 'Bia');
    const aoRanqueada = vi.fn();
    render(<Lobby aoJogar={vi.fn()} aoRanqueada={aoRanqueada} />);
    expect(screen.getByLabelText('Apelido')).toHaveValue('Bia');
    await user.click(screen.getByRole('button', { name: 'Ranqueada' }));
    expect(aoRanqueada).toHaveBeenCalled();
  });
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/web test entrar lobby`
Expected: FAIL — módulos inexistentes; botão "Ranqueada" não existe (ainda é "Ranqueada (em breve)").

**Step 3: Implementação**

`apps/web/src/componentes/BotaoGoogle.tsx`
```tsx
import { useEffect, useRef } from 'react';

/** O pedaço do Google Identity Services (`google.accounts.id`) que usamos. */
export interface GoogleId {
  initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
}

export type CarregarGoogle = () => Promise<GoogleId>;

let carregando: Promise<GoogleId> | null = null;

/** Carrega https://accounts.google.com/gsi/client uma vez (só quando o servidor tem GOOGLE_CLIENT_ID). */
export const carregarGsi: CarregarGoogle = () => {
  carregando ??= new Promise<GoogleId>((ok, falha) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      const g = (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;
      if (g) ok(g);
      else falha(new Error('Google Identity Services indisponível'));
    };
    s.onerror = () => {
      carregando = null;
      falha(new Error('não foi possível carregar o login do Google'));
    };
    document.head.appendChild(s);
  });
  return carregando;
};

interface Props {
  clientId: string;
  aoCredencial: (credencial: string) => void;
  carregar?: CarregarGoogle;
}

export function BotaoGoogle({ clientId, aoCredencial, carregar = carregarGsi }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(aoCredencial);
  cb.current = aoCredencial;
  useEffect(() => {
    let vivo = true;
    carregar().then(
      (g) => {
        if (!vivo || !ref.current) return;
        g.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
        g.renderButton(ref.current, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'pt-BR' });
      },
      (e: unknown) => console.warn('[google]', e),
    );
    return () => {
      vivo = false;
    };
  }, [clientId, carregar]);
  return <div ref={ref} className="botao-google" data-testid="botao-google" />;
}
```

`apps/web/src/componentes/Cabecalho.tsx`
```tsx
import type { UsuarioApi } from '@truco/api';

interface Props {
  usuario: UsuarioApi | null;
  aoSair: () => void;
}

export function Cabecalho({ usuario, aoSair }: Props) {
  return (
    <nav className="cabecalho" aria-label="Navegação">
      <a href="#/">Início</a>
      <a href="#/salas">Salas</a>
      <a href="#/ranking/paulista">Ranking</a>
      {usuario ? (
        <>
          <a href="#/perfil">Perfil</a>
          <a href="#/historico">Histórico</a>
          <span className="cabecalho-usuario" data-testid="usuario-logado">
            {usuario.apelido}
          </span>
          <button type="button" onClick={aoSair}>
            Sair da conta
          </button>
        </>
      ) : (
        <a href="#/entrar">Entrar</a>
      )}
    </nav>
  );
}
```

`apps/web/src/telas/Entrar.tsx`
```tsx
import type { ConfigApi, UsuarioApi } from '@truco/api';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { BotaoGoogle, type CarregarGoogle } from '../componentes/BotaoGoogle';
import type { Api } from '../rede/api';

interface Props {
  token: string | null;
  config: ConfigApi;
  api: Pick<Api, 'pedirLink' | 'confirmarLink' | 'entrarGoogle'>;
  aoEntrar: (u: UsuarioApi) => void;
  carregarGoogle?: CarregarGoogle;
}

const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function TelaEntrar({ token, config, api, aoEntrar, carregarGoogle }: Props) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'enviado' | 'confirmando'>(token ? 'confirmando' : 'livre');
  const [erro, setErro] = useState<string | null>(null);
  const confirmado = useRef<string | null>(null);

  useEffect(() => {
    if (!token || confirmado.current === token) return;
    confirmado.current = token;
    setEstado('confirmando');
    api.confirmarLink(token).then(
      (r) => aoEntrar(r.usuario),
      (e: unknown) => {
        setErro(mensagemDe(e));
        setEstado('livre');
      },
    );
  }, [token, api, aoEntrar]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEstado('enviando');
    try {
      await api.pedirLink(email.trim());
      setEstado('enviado');
    } catch (x) {
      setErro(mensagemDe(x));
      setEstado('livre');
    }
  };

  const google = async (credencial: string) => {
    setErro(null);
    try {
      aoEntrar((await api.entrarGoogle(credencial)).usuario);
    } catch (x) {
      setErro(mensagemDe(x));
    }
  };

  return (
    <main className="tela-conta">
      <h1>Entrar</h1>
      {estado === 'confirmando' ? (
        <p role="status">Entrando…</p>
      ) : estado === 'enviado' ? (
        <p role="status">
          Enviamos um link para <strong>{email.trim()}</strong>. Abra-o neste navegador para entrar (vale por 15 minutos).
        </p>
      ) : (
        <form className="formulario" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="botao-principal" disabled={estado === 'enviando'}>
            Enviar link
          </button>
        </form>
      )}
      {config.google && estado !== 'confirmando' && <BotaoGoogle clientId={config.google} aoCredencial={(c) => void google(c)} carregar={carregarGoogle} />}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      <p className="nota">Sem conta você joga Clássica e Desafio como convidado. Ranqueada, histórico e perfil pedem login.</p>
    </main>
  );
}
```

`apps/web/src/telas/Lobby.tsx`:
- em `Props`, acrescente `aoRanqueada?: () => void;` e receba-o na desestruturação (`export function Lobby({ aoJogar, aoRanqueada }: Props)`).
- troque o botão desabilitado por:
```tsx
          <button type="button" onClick={aoRanqueada} disabled={!aoRanqueada}>
            Ranqueada
          </button>
```

`apps/web/src/App.tsx` (arquivo inteiro; preserve qualquer mudança do revisor nas telas de mesa):
```tsx
import type { UsuarioApi } from '@truco/api';
import { useCallback, useEffect } from 'react';
import { Cabecalho } from './componentes/Cabecalho';
import { Toast } from './componentes/Toast';
import { entrarNaMesa, tentarReconectar } from './rede/conexao';
import { useLoja, useSessao } from './rede/hooks';
import { api, loja, sessao } from './rede/instancia';
import { navegar, useRota } from './rede/rota';
import { TelaEntrar } from './telas/Entrar';
import { Lobby } from './telas/Lobby';
import { TelaMesa } from './telas/Mesa';
import { SalaEspera } from './telas/SalaEspera';

export function App() {
  const snap = useLoja(loja);
  const ses = useSessao(sessao);
  const rota = useRota();

  useEffect(() => {
    void tentarReconectar(loja);
    void sessao.carregar();
  }, []);

  const aoEntrar = useCallback((u: UsuarioApi) => {
    sessao.definirUsuario(u);
    navegar({ tela: 'inicio' });
  }, []);

  let tela;
  if (snap.status === 'conectando') tela = <p className="aviso-centro">Conectando…</p>;
  else if (snap.status !== 'fora') {
    if (!snap.msg) tela = <p className="aviso-centro">Entrando na mesa…</p>;
    else if (!snap.msg.visao) tela = <SalaEspera msg={snap.msg} aoIniciar={loja.iniciar} aoSair={() => void loja.sair()} />;
    else tela = <TelaMesa snap={snap} acoes={loja} />;
  } else {
    let conteudo;
    switch (rota.tela) {
      case 'entrar':
        conteudo = <TelaEntrar token={rota.token} config={ses.config} api={api} aoEntrar={aoEntrar} />;
        break;
      default:
        conteudo = (
          <Lobby
            aoJogar={(o) => void entrarNaMesa(loja, o)}
            aoRanqueada={() => navegar(ses.usuario ? { tela: 'fila' } : { tela: 'entrar', token: null })}
          />
        );
    }
    tela = (
      <>
        <Cabecalho usuario={ses.usuario} aoSair={() => void sessao.sair()} />
        {conteudo}
      </>
    );
  }

  return (
    <>
      {snap.status === 'reconectando' && (
        <div className="faixa-aviso" role="status">
          Conexão caiu — reconectando…
        </div>
      )}
      {tela}
      {snap.erro && <Toast key={snap.erro.id} erro={snap.erro} aoFechar={loja.limparErro} />}
    </>
  );
}
```

`apps/web/src/estilos.css` — acrescente no fim:
```css
/* ---------- contas, navegação e telas de dados ---------- */
.cabecalho {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.25);
  font-size: 0.95rem;
}
.cabecalho a {
  color: inherit;
}
.cabecalho-usuario {
  margin-left: auto;
  font-weight: 600;
}
.tela-conta {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
}
.erro-form {
  color: #ffb4a8;
}
.nota {
  opacity: 0.75;
  font-size: 0.85rem;
}
.botao-google {
  margin: 16px 0;
  min-height: 44px;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/web test`
Expected: PASS — todos, inclusive `app.test.tsx` (o lobby ainda tem o `h1` "Truco"; o cabeçalho não tem títulos).

Run: `pnpm --filter @truco/web typecheck` → sem erros.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/web
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(web): tela Entrar com link mágico e Google, cabeçalho de conta e rotas no App" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Web — perfil (patente, Elo, estatísticas), histórico e ranking

**Files:**
- Create: `apps/web/src/logica/conta.ts`, `apps/web/src/telas/Perfil.tsx`, `apps/web/src/telas/Historico.tsx`, `apps/web/src/telas/Ranking.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/estilos.css`
- Test: `apps/web/test/conta.test.ts`, `apps/web/test/telas-conta.test.tsx`

**Step 1: Testes que falham**

`apps/web/test/conta.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { NOME_MODO, NOME_VARIANTE, textoDelta, textoResultado } from '../src/logica/conta';

const base = { partidaId: 1, variante: 'paulista', modo: 'ranqueada', ranqueada: true, nos: 12, eles: 3, iniciadaEm: '', deltaElo: 16 } as const;

describe('textos de conta', () => {
  test('nomes', () => {
    expect(NOME_VARIANTE.mineiro).toBe('Mineiro');
    expect(NOME_MODO.desafio).toBe('Desafio');
    expect(NOME_MODO.ranqueada).toBe('Ranqueada');
  });

  test('textoResultado', () => {
    expect(textoResultado({ ...base, venceu: true, abandonou: false, terminadaEm: 'x' })).toBe('Vitória');
    expect(textoResultado({ ...base, venceu: false, abandonou: false, terminadaEm: 'x' })).toBe('Derrota');
    expect(textoResultado({ ...base, venceu: false, abandonou: true, terminadaEm: null })).toBe('Abandonou');
    expect(textoResultado({ ...base, venceu: null, abandonou: false, terminadaEm: null })).toBe('Em andamento');
  });

  test('textoDelta', () => {
    expect(textoDelta(16)).toBe('+16');
    expect(textoDelta(-8)).toBe('−8');
    expect(textoDelta(0)).toBe('0');
    expect(textoDelta(null)).toBe('');
  });
});
```

`apps/web/test/telas-conta.test.tsx`
```tsx
import type { PerfilApi } from '@truco/api';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ErroApi } from '../src/rede/api';
import { TelaHistorico } from '../src/telas/Historico';
import { TelaPerfil } from '../src/telas/Perfil';
import { TelaRanking } from '../src/telas/Ranking';

const RV = { elo: 1000, pontos: 0, patente: 'Bronze', proxima: { nome: 'Prata', faltam: 300 }, partidasRanqueadas: 0, jogos: 0, vitorias: 0, pctTrucoAceito: null, corridas: 0 };
const PERFIL: PerfilApi = {
  usuario: { id: 1, apelido: 'ana' },
  variantes: {
    paulista: { ...RV, elo: 1016, pontos: 316, patente: 'Prata', proxima: { nome: 'Ouro', faltam: 284 }, partidasRanqueadas: 3, jogos: 5, vitorias: 4, pctTrucoAceito: 67, corridas: 2 },
    mineiro: RV,
  },
};

describe('TelaPerfil', () => {
  test('mostra patente, pontos, Elo e estatísticas por variante', async () => {
    render(<TelaPerfil id={null} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn() }} />);
    expect(await screen.findByRole('heading', { name: 'ana' })).toBeInTheDocument();
    const paulista = screen.getByRole('region', { name: 'Paulista' });
    expect(within(paulista).getByTestId('elo-paulista')).toHaveTextContent('1016');
    expect(within(paulista).getByTestId('pontos-paulista')).toHaveTextContent('316');
    expect(paulista).toHaveTextContent('Prata');
    expect(paulista).toHaveTextContent('faltam 284 para Ouro');
    expect(paulista).toHaveTextContent('67%');
    expect(within(screen.getByRole('region', { name: 'Mineiro' })).getByText('—')).toBeInTheDocument();
  });

  test('o próprio perfil troca o apelido; o de outro não', async () => {
    const user = userEvent.setup();
    const trocarApelido = vi.fn(async () => ({ usuario: { id: 1, apelido: 'Aninha', email: null } }));
    const aoTrocarApelido = vi.fn();
    const perfil = vi.fn(async () => PERFIL);
    const { unmount } = render(<TelaPerfil id={null} api={{ perfil, trocarApelido }} aoTrocarApelido={aoTrocarApelido} />);
    const campo = await screen.findByLabelText('Apelido');
    await user.clear(campo);
    await user.type(campo, 'Aninha');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(trocarApelido).toHaveBeenCalledWith('Aninha');
    expect(aoTrocarApelido).toHaveBeenCalledWith({ id: 1, apelido: 'Aninha', email: null });
    expect(perfil).toHaveBeenCalledTimes(2);
    unmount();
    render(<TelaPerfil id={2} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido }} />);
    await screen.findByRole('heading', { name: 'ana' });
    expect(screen.queryByLabelText('Apelido')).toBeNull();
  });

  test('erro de apelido em uso aparece', async () => {
    const user = userEvent.setup();
    render(<TelaPerfil id={null} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn(async () => Promise.reject(new ErroApi(409, 'esse apelido já tem dono'))) }} />);
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('já tem dono');
  });
});

describe('TelaHistorico', () => {
  test('lista as partidas com resultado e delta', async () => {
    const partidas = [
      { partidaId: 2, variante: 'mineiro', modo: 'ranqueada', ranqueada: true, nos: 12, eles: 8, venceu: true, abandonou: false, deltaElo: 16, iniciadaEm: '2026-11-05T12:00:00Z', terminadaEm: '2026-11-05T12:20:00Z' },
      { partidaId: 1, variante: 'paulista', modo: 'classica', ranqueada: false, nos: 3, eles: 12, venceu: false, abandonou: false, deltaElo: null, iniciadaEm: '2026-11-05T11:00:00Z', terminadaEm: '2026-11-05T11:15:00Z' },
    ] as const;
    render(<TelaHistorico api={{ historico: vi.fn(async () => ({ partidas: [...partidas] })) }} />);
    const itens = await screen.findAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Mineiro · Ranqueada');
    expect(itens[0]).toHaveTextContent('12 × 8');
    expect(itens[0]).toHaveTextContent('Vitória');
    expect(itens[0]).toHaveTextContent('+16');
    expect(itens[1]).toHaveTextContent('Derrota');
  });

  test('vazio', async () => {
    render(<TelaHistorico api={{ historico: vi.fn(async () => ({ partidas: [] })) }} />);
    expect(await screen.findByText('Nenhuma partida ainda.')).toBeInTheDocument();
  });
});

describe('TelaRanking', () => {
  test('abas por variante e tabela com link para o perfil', async () => {
    const ranking = vi.fn(async () => ({ linhas: [{ posicao: 1, usuarioId: 7, apelido: 'ana', pontos: 316, elo: 1016, patente: 'Prata', partidas: 3 }] }));
    render(<TelaRanking variante="mineiro" api={{ ranking }} />);
    expect(ranking).toHaveBeenCalledWith('mineiro');
    expect(screen.getByRole('link', { name: 'Mineiro' })).toHaveAttribute('aria-current', 'page');
    const link = await screen.findByRole('link', { name: 'ana' });
    expect(link).toHaveAttribute('href', '#/perfil/7');
    expect(screen.getByRole('row', { name: /ana/ })).toHaveTextContent('Prata');
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/web test conta`
Expected: FAIL — módulos inexistentes (o filtro `conta` pega `conta.test.ts` e `telas-conta.test.tsx`).

**Step 3: Implementação**

`apps/web/src/logica/conta.ts`
```ts
import type { ItemHistorico } from '@truco/api';
import type { Variante } from '@truco/engine';
import type { ModoMesa } from '@truco/protocolo';

export const NOME_VARIANTE: Record<Variante, string> = { paulista: 'Paulista', mineiro: 'Mineiro' };

export const NOME_MODO: Record<ModoMesa, string> = { classica: 'Clássica', desafio: 'Desafio', privada: 'Privada', ranqueada: 'Ranqueada' };

export function textoResultado(p: Pick<ItemHistorico, 'venceu' | 'abandonou' | 'terminadaEm'>): string {
  if (p.abandonou) return 'Abandonou';
  if (p.venceu === true) return 'Vitória';
  if (p.venceu === false) return 'Derrota';
  return p.terminadaEm ? '—' : 'Em andamento';
}

export function textoDelta(d: number | null): string {
  if (d === null) return '';
  if (d > 0) return `+${d}`;
  return d < 0 ? `−${-d}` : '0';
}
```

`apps/web/src/telas/Perfil.tsx`
```tsx
import type { RatingVariante, UsuarioApi } from '@truco/api';
import type { Variante } from '@truco/engine';
import { type FormEvent, useState } from 'react';
import { NOME_VARIANTE } from '../logica/conta';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

interface Props {
  api: Pick<Api, 'perfil' | 'trocarApelido'>;
  /** null = o próprio perfil (exige login). */
  id: number | null;
  aoTrocarApelido?: (u: UsuarioApi) => void;
}

export function TelaPerfil({ api, id, aoTrocarApelido }: Props) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.perfil(id ?? undefined), [id]);
  return (
    <main className="tela-conta">
      {carregando && !dados && <p role="status">Carregando…</p>}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && (
        <>
          <h1>{dados.usuario.apelido}</h1>
          {id === null && (
            <FormApelido
              atual={dados.usuario.apelido}
              api={api}
              aoSalvar={(u) => {
                aoTrocarApelido?.(u);
                recarregar();
              }}
            />
          )}
          {(['paulista', 'mineiro'] as const).map((v) => (
            <CartaoVariante key={v} variante={v} r={dados.variantes[v]} />
          ))}
        </>
      )}
    </main>
  );
}

function CartaoVariante({ variante, r }: { variante: Variante; r: RatingVariante }) {
  return (
    <section className="cartao-variante" aria-label={NOME_VARIANTE[variante]}>
      <h2>{NOME_VARIANTE[variante]}</h2>
      <p className="patente">
        {r.patente} · <span data-testid={`pontos-${variante}`}>{r.pontos}</span> pontos
        {r.proxima ? ` (faltam ${r.proxima.faltam} para ${r.proxima.nome})` : ''}
      </p>
      <dl className="estatisticas">
        <dt>Elo</dt>
        <dd data-testid={`elo-${variante}`}>{r.elo}</dd>
        <dt>Ranqueadas</dt>
        <dd>{r.partidasRanqueadas}</dd>
        <dt>Partidas</dt>
        <dd>{r.jogos}</dd>
        <dt>Vitórias</dt>
        <dd>{r.vitorias}</dd>
        <dt>Truco aceito</dt>
        <dd>{r.pctTrucoAceito === null ? '—' : `${r.pctTrucoAceito}%`}</dd>
        <dt>Corridas</dt>
        <dd>{r.corridas}</dd>
      </dl>
    </section>
  );
}

function FormApelido({ atual, api, aoSalvar }: { atual: string; api: Pick<Api, 'trocarApelido'>; aoSalvar: (u: UsuarioApi) => void }) {
  const [valor, setValor] = useState(atual);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      aoSalvar((await api.trocarApelido(valor.trim())).usuario);
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    }
  };
  return (
    <form className="formulario linha" onSubmit={salvar}>
      <div className="campo">
        <label htmlFor="apelido-conta">Apelido</label>
        <input id="apelido-conta" type="text" maxLength={20} value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <button type="submit">Salvar</button>
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}
```

`apps/web/src/telas/Historico.tsx`
```tsx
import { NOME_MODO, NOME_VARIANTE, textoDelta, textoResultado } from '../logica/conta';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

export function TelaHistorico({ api }: { api: Pick<Api, 'historico'> }) {
  const { dados, erro, carregando } = useCarregar(() => api.historico(), []);
  return (
    <main className="tela-conta">
      <h1>Histórico</h1>
      {carregando && !dados && <p role="status">Carregando…</p>}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && dados.partidas.length === 0 && <p>Nenhuma partida ainda.</p>}
      {dados && dados.partidas.length > 0 && (
        <ul className="lista-dados">
          {dados.partidas.map((p) => (
            <li key={p.partidaId}>
              <span>
                {NOME_VARIANTE[p.variante]} · {NOME_MODO[p.modo]}
              </span>
              <span>
                {p.nos} × {p.eles}
              </span>
              <span>{textoResultado(p)}</span>
              <span className="delta">{textoDelta(p.deltaElo)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

`apps/web/src/telas/Ranking.tsx`
```tsx
import type { Variante } from '@truco/engine';
import { NOME_VARIANTE } from '../logica/conta';
import { hrefDe } from '../logica/rotas';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

export function TelaRanking({ api, variante }: { api: Pick<Api, 'ranking'>; variante: Variante }) {
  const { dados, erro, carregando } = useCarregar(() => api.ranking(variante), [variante]);
  return (
    <main className="tela-conta">
      <h1>Ranking</h1>
      <nav className="abas" aria-label="Variante">
        {(['paulista', 'mineiro'] as const).map((v) => (
          <a key={v} href={hrefDe({ tela: 'ranking', variante: v })} aria-current={v === variante ? 'page' : undefined}>
            {NOME_VARIANTE[v]}
          </a>
        ))}
      </nav>
      {carregando && !dados && <p role="status">Carregando…</p>}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && dados.linhas.length === 0 && <p>Ninguém jogou ranqueada nesta variante ainda.</p>}
      {dados && dados.linhas.length > 0 && (
        <table className="tabela-ranking">
          <thead>
            <tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Patente</th>
              <th>Pontos</th>
              <th>Elo</th>
            </tr>
          </thead>
          <tbody>
            {dados.linhas.map((l) => (
              <tr key={l.usuarioId}>
                <td>{l.posicao}</td>
                <td>
                  <a href={hrefDe({ tela: 'perfil', id: l.usuarioId })}>{l.apelido}</a>
                </td>
                <td>{l.patente}</td>
                <td>{l.pontos}</td>
                <td>{l.elo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
```

`apps/web/src/App.tsx` — imports `TelaHistorico`, `TelaPerfil`, `TelaRanking` e, no `switch (rota.tela)`, antes do `default`:
```tsx
      case 'perfil':
        conteudo = (
          <TelaPerfil
            key={rota.id ?? 'eu'}
            id={rota.id}
            api={api}
            aoTrocarApelido={(u) => sessao.definirUsuario(u)}
          />
        );
        break;
      case 'historico':
        conteudo = <TelaHistorico api={api} />;
        break;
      case 'ranking':
        conteudo = <TelaRanking variante={rota.variante} api={api} />;
        break;
```

`apps/web/src/estilos.css` — acrescente:
```css
.cartao-variante {
  margin: 16px 0;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
}
.estatisticas {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  margin: 0;
}
.estatisticas dd {
  margin: 0;
  font-weight: 600;
}
.lista-dados {
  list-style: none;
  padding: 0;
}
.lista-dados li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.abas {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.abas a[aria-current='page'] {
  font-weight: 700;
  text-decoration: none;
}
.tabela-ranking {
  width: 100%;
  border-collapse: collapse;
}
.tabela-ranking th,
.tabela-ranking td {
  padding: 6px 4px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.formulario.linha {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/web test`
Expected: PASS — todos.

Run: `pnpm --filter @truco/web typecheck` → sem erros.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/web
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(web): perfil com patente, Elo e estatísticas; histórico e ranking por variante" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Web — chat, convite e saída confirmada (loja, conexão, sala de espera e mesa)

**Files:**
- Modify: `apps/web/src/rede/loja.ts`, `apps/web/src/rede/conexao.ts`, `apps/web/src/telas/SalaEspera.tsx`, `apps/web/src/telas/Mesa.tsx`, `apps/web/src/App.tsx`, `apps/web/src/estilos.css`
- Create: `apps/web/src/componentes/Chat.tsx`
- Modify (testes existentes): `apps/web/test/loja.test.ts` (linha do `ouvintesNoEnvio`), `apps/web/test/tela-mesa.test.tsx` (helper `snap`)
- Test: `apps/web/test/privada.test.tsx`, `apps/web/test/conexao.test.ts`

**Step 1: Testes que falham**

Em `apps/web/test/loja.test.ts`, a expectativa `{ estado: 1, acao: 1, sinal: 1, fala: 1, erro: 1 }` passa a ser `{ estado: 1, acao: 1, sinal: 1, fala: 1, erro: 1, chat: 1 }`. Em `apps/web/test/tela-mesa.test.tsx`, o helper `snap` passa a devolver `{ status: 'na-mesa', msg, eventos, erro: null, chat: [], salaId: 'r1' }`.

Em `apps/web/test/conexao.test.ts`, importe `criarMesaPrivada`, `entrarComReserva`, `entrarPorCodigo` e acrescente:
```ts
describe('mesa privada e reserva', () => {
  const clienteFalso = (sala: SalaFalsa) => ({
    joinOrCreate: vi.fn(),
    reconnect: vi.fn(),
    create: vi.fn(async () => sala),
    joinById: vi.fn(async () => sala),
    consumeSeatReservation: vi.fn(async () => sala),
  });

  test('criarMesaPrivada usa create com modo privada', async () => {
    const sala = new SalaFalsa();
    const c = clienteFalso(sala);
    const loja = novaLoja();
    await criarMesaPrivada(loja, opcoes, c);
    expect(c.create).toHaveBeenCalledWith('mesa', { ...opcoes, modo: 'privada' });
    expect(loja.getSnapshot()).toMatchObject({ status: 'na-mesa', salaId: 'r1' });
  });

  test('entrarPorCodigo usa joinById; entrarComReserva consome a reserva', async () => {
    const c = clienteFalso(new SalaFalsa());
    await entrarPorCodigo(novaLoja(), 'abcd1234', 'Bia', c);
    expect(c.joinById).toHaveBeenCalledWith('abcd1234', { nome: 'Bia' });
    const reserva = { roomId: 'r9', sessionId: 's1' };
    await entrarComReserva(novaLoja(), reserva, c);
    expect(c.consumeSeatReservation).toHaveBeenCalledWith(reserva);
  });

  test('código inválido volta ao lobby com toast', async () => {
    const c = { ...clienteFalso(new SalaFalsa()), joinById: vi.fn(async () => Promise.reject(new Error('room "x" not found'))) };
    const loja = novaLoja();
    await entrarPorCodigo(loja, 'xxxx', 'Bia', c);
    expect(loja.getSnapshot().status).toBe('fora');
    expect(loja.getSnapshot().erro?.mensagem).toBe('Não foi possível entrar na mesa: room "x" not found');
  });
});
```

`apps/web/test/privada.test.tsx`
```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SAIDA_PARTIDA_CANCELADA } from '@truco/protocolo';
import { describe, expect, test, vi } from 'vitest';
import { criarLoja, type EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { SalaEspera } from '../src/telas/SalaEspera';
import { distribuida, msgEstado, PAULISTA } from './fixtures';
import { SalaFalsa } from './sala-falsa';

const acoesFalsas = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn(async () => {}) });
const snap = (modo: 'classica' | 'privada' | 'ranqueada'): EstadoLoja => ({
  status: 'na-mesa',
  msg: msgEstado(distribuida(PAULISTA), 0, { modo }),
  eventos: [],
  erro: null,
  chat: [{ de: 1, nome: 'Bia', texto: 'bora' }],
  salaId: 'abcd1234',
});

describe('loja: chat, sala e cancelamento', () => {
  test('guarda mensagens de chat, envia e esquece ao sair', async () => {
    const loja = criarLoja();
    const sala = new SalaFalsa();
    loja.conectar(sala);
    expect(loja.getSnapshot().salaId).toBe('r1');
    sala.receber('chat', { de: 2, nome: 'Cid', texto: 'oi' });
    expect(loja.getSnapshot().chat).toEqual([{ de: 2, nome: 'Cid', texto: 'oi' }]);
    loja.enviarChat('olá');
    expect(sala.enviados.at(-1)).toEqual(['chat', 'olá']);
    await loja.sair();
    expect(loja.getSnapshot()).toMatchObject({ chat: [], salaId: null });
  });

  test('ranqueada cancelada volta ao lobby com aviso', () => {
    const loja = criarLoja();
    const sala = new SalaFalsa();
    loja.conectar(sala);
    sala.emit('leave', SAIDA_PARTIDA_CANCELADA);
    expect(loja.getSnapshot().status).toBe('fora');
    expect(loja.getSnapshot().erro?.mensagem).toBe('Partida ranqueada cancelada: nem todos entraram a tempo');
  });
});

describe('SalaEspera', () => {
  test('privada mostra o link de convite e o chat', async () => {
    const user = userEvent.setup();
    const aoChat = vi.fn();
    render(
      <SalaEspera
        msg={msgEstado(null, 0, { modo: 'privada' })}
        aoIniciar={vi.fn()}
        aoSair={vi.fn()}
        salaId="abcd1234"
        origem="https://truco.app"
        chat={[]}
        aoChat={aoChat}
      />,
    );
    expect(screen.getByLabelText('Link de convite')).toHaveValue('https://truco.app/#/privada/abcd1234');
    await user.type(screen.getByLabelText('Mensagem'), 'vem logo{Enter}');
    expect(aoChat).toHaveBeenCalledWith('vem logo');
    expect(screen.getByLabelText('Mensagem')).toHaveValue('');
  });

  test('ranqueada não tem "Começar com bots" nem convite', () => {
    render(<SalaEspera msg={msgEstado(null, 0, { modo: 'ranqueada' })} aoIniciar={vi.fn()} aoSair={vi.fn()} salaId="x1234" />);
    expect(screen.queryByRole('button', { name: 'Começar com bots' })).toBeNull();
    expect(screen.queryByLabelText('Link de convite')).toBeNull();
    expect(screen.getByText(/começa quando todos entrarem/)).toBeInTheDocument();
  });
});

describe('TelaMesa', () => {
  test('Sair pede confirmação; na ranqueada avisa da derrota e do bloqueio', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    render(<TelaMesa snap={snap('ranqueada')} acoes={acoes} />);
    await user.click(screen.getByRole('button', { name: 'Sair', exact: true }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Sair da mesa' });
    expect(dialogo).toHaveTextContent('conta como derrota');
    await user.click(within(dialogo).getByRole('button', { name: 'Continuar jogando' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(acoes.sair).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sair', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Sair da mesa' }));
    expect(acoes.sair).toHaveBeenCalled();
  });

  test('chat só aparece na privada', async () => {
    const user = userEvent.setup();
    const aoChat = vi.fn();
    const { unmount } = render(<TelaMesa snap={snap('classica')} acoes={acoesFalsas()} aoChat={aoChat} />);
    expect(screen.queryByRole('button', { name: 'Chat' })).toBeNull();
    unmount();
    render(<TelaMesa snap={snap('privada')} acoes={acoesFalsas()} aoChat={aoChat} />);
    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(within(screen.getByRole('region', { name: 'Chat da mesa' })).getByText('bora')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mensagem'), 'truco!{Enter}');
    expect(aoChat).toHaveBeenCalledWith('truco!');
  });
});

```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/web test privada conexao loja`
Expected: FAIL — `chat`/`salaId`/`enviarChat` inexistentes, funções de conexão inexistentes, sem botão "Sair".

**Step 3: Implementação**

`apps/web/src/rede/loja.ts`:
- import do protocolo: acrescente `type MsgChat` e `SAIDA_PARTIDA_CANCELADA`.
- `TIPOS_MENSAGEM` passa a ser `['estado', 'acao', 'sinal', 'fala', 'erro', 'chat'] as const`.
- em `EstadoLoja`, acrescente:
```ts
  /** Chat da mesa privada (últimas 50). */
  chat: MsgChat[];
  /** `roomId` da sala atual (código do convite da mesa privada). */
  salaId: string | null;
```
- `INICIAL` ganha `chat: [], salaId: null`.
- em `largar`, o `mudar` passa a ser `mudar({ status: 'fora', msg: null, eventos: [], chat: [], salaId: null });`
- em `conectar`, junto dos outros handlers (antes do `onDrop`):
```ts
    s.onMessage('chat', (m: MsgChat) => {
      if (sala === s) mudar({ chat: [...estado.chat, m].slice(-50) });
    });
```
- no `onLeave`, logo depois de `if (sala !== s) return;`:
```ts
      if (code === SAIDA_PARTIDA_CANCELADA) {
        largar(true);
        erro('Partida ranqueada cancelada: nem todos entraram a tempo');
        return;
      }
```
- o `mudar` final de `conectar` passa a ser `mudar({ status: 'na-mesa', msg: null, eventos: [], chat: [], salaId: s.roomId });`
- no objeto devolvido, junto de `enviarFala`: `enviarChat: (texto: string) => sala?.send('chat', texto),`

`apps/web/src/rede/conexao.ts`:
- depois de `ClienteLike`:
```ts
/** O resto do `Client` do SDK que as mesas privadas, a lista de salas e a fila usam. */
export interface ClienteSala extends ClienteLike {
  create(nomeSala: string, opcoes: object): Promise<unknown>;
  joinById(id: string, opcoes: object): Promise<unknown>;
  consumeSeatReservation(reserva: any): Promise<unknown>;
}
```
- `let padrao: Promise<ClienteSala> | null = null;` e `clientePadrao(): Promise<ClienteSala>` (com `as unknown as ClienteSala`).
- no fim do arquivo:
```ts
async function conectarCom(
  loja: Loja,
  abrir: (c: ClienteSala) => Promise<unknown>,
  cliente: ClienteSala | undefined,
  falha: string,
): Promise<void> {
  if (loja.getSnapshot().status !== 'fora') return;
  loja.marcarConectando();
  try {
    const c = cliente ?? (await clientePadrao());
    loja.conectar((await abrir(c)) as SalaLike);
  } catch (e) {
    loja.falhouConexao(`${falha}: ${mensagem(e)}`);
  }
}

/** Mesa privada nova: não aparece na lista nem no joinOrCreate; o `roomId` é o convite. */
export const criarMesaPrivada = (loja: Loja, opcoes: OpcoesEntrada, cliente?: ClienteSala) =>
  conectarCom(loja, (c) => c.create('mesa', { ...opcoes, modo: 'privada' }), cliente, 'Não foi possível criar a mesa');

/** Mesa por código (link de convite ou lista de salas). */
export const entrarPorCodigo = (loja: Loja, codigo: string, nome: string, cliente?: ClienteSala) =>
  conectarCom(loja, (c) => c.joinById(codigo, { nome }), cliente, 'Não foi possível entrar na mesa');

/** Mesa ranqueada criada pela fila (reserva vinda da mensagem `pareado`). */
export const entrarComReserva = (loja: Loja, reserva: unknown, cliente?: ClienteSala) =>
  conectarCom(loja, (c) => c.consumeSeatReservation(reserva), cliente, 'Não foi possível abrir a mesa ranqueada');

/** Sala `fila` (quem cuida dela é a loja da fila). */
export async function abrirFila(opcoes: object, cliente?: ClienteSala): Promise<unknown> {
  const c = cliente ?? (await clientePadrao());
  return c.joinOrCreate('fila', opcoes);
}
```

`apps/web/src/componentes/Chat.tsx`
```tsx
import { MAX_CHAT, type MsgChat } from '@truco/protocolo';
import { type FormEvent, useState } from 'react';

interface Props {
  mensagens: MsgChat[];
  aoEnviar: (texto: string) => void;
}

export function Chat({ mensagens, aoEnviar }: Props) {
  const [texto, setTexto] = useState('');
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    aoEnviar(t);
    setTexto('');
  };
  return (
    <section className="chat" aria-label="Chat da mesa">
      <ol className="chat-mensagens">
        {mensagens.map((m, i) => (
          <li key={i}>
            <strong>{m.nome}:</strong> {m.texto}
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={enviar}>
        <label htmlFor="chat-texto" className="visualmente-oculto">
          Mensagem
        </label>
        <input id="chat-texto" type="text" autoComplete="off" maxLength={MAX_CHAT} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button type="submit">Enviar</button>
      </form>
    </section>
  );
}
```

`apps/web/src/telas/SalaEspera.tsx`:
- imports: `import type { MsgChat } from '@truco/protocolo';` (junto do `MsgEstado`), `import { useState } from 'react';`, `import { Chat } from '../componentes/Chat';`, `import { linkConvite } from '../logica/rotas';`
- `Props` ganha:
```ts
  /** `roomId` (código do convite). */
  salaId?: string | null;
  /** Origem da página (testes passam uma fixa). */
  origem?: string;
  chat?: MsgChat[];
  aoChat?: (texto: string) => void;
```
- a assinatura passa a `export function SalaEspera({ msg, aoIniciar, aoSair, salaId = null, origem = window.location.origin, chat = [], aoChat }: Props)`.
- logo depois da lista `resumo-regras`:
```tsx
      {msg.modo === 'privada' && salaId && <Convite link={linkConvite(origem, salaId)} />}
      {msg.modo === 'privada' && aoChat && <Chat mensagens={chat} aoEnviar={aoChat} />}
```
- o bloco `{dono ? (...) : (...)}` fica dentro de:
```tsx
      {msg.modo === 'ranqueada' ? (
        <p>Partida ranqueada: começa quando todos entrarem.</p>
      ) : dono ? (
        /* botão "Começar com bots" de antes */
      ) : (
        /* parágrafo de antes */
      )}
```
- no fim do arquivo:
```tsx
function Convite({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="convite">
      <label htmlFor="link-convite">Link de convite</label>
      <input id="link-convite" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopiado(true), () => {})}>
        {copiado ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}
```

`apps/web/src/telas/Mesa.tsx`:
- import `import { Chat } from '../componentes/Chat';`
- `Props` ganha `aoChat?: (texto: string) => void;` e a assinatura passa a `export function TelaMesa({ snap, acoes, aoChat }: Props)`.
- o estado do painel passa a `useState<'sinais' | 'falas' | 'chat' | null>(null)`, o `alternar` aceita `'sinais' | 'falas' | 'chat'`, e acrescente `const [confirmarSaida, setConfirmarSaida] = useState(false);`
- dentro do `<nav className="barra-social">`, depois do botão "Falas":
```tsx
        {msg.modo === 'privada' && aoChat && (
          <button type="button" aria-pressed={painel === 'chat'} onClick={() => alternar('chat')}>
            Chat
          </button>
        )}
        <button type="button" onClick={() => setConfirmarSaida(true)}>
          Sair
        </button>
```
- depois do bloco do `PainelFalas`:
```tsx
      {painel === 'chat' && aoChat && <Chat mensagens={snap.chat} aoEnviar={aoChat} />}
      {confirmarSaida && (
        <div className="confirmar-saida" role="alertdialog" aria-label="Sair da mesa">
          <p>
            {msg.modo === 'ranqueada'
              ? 'Sair agora conta como derrota e bloqueia a fila ranqueada por 5 minutos.'
              : 'Um bot assume o seu lugar até o fim da partida.'}
          </p>
          <button type="button" className="botao-principal" onClick={() => void acoes.sair()}>
            Sair da mesa
          </button>
          <button type="button" onClick={() => setConfirmarSaida(false)}>
            Continuar jogando
          </button>
        </div>
      )}
```

`apps/web/src/App.tsx` — passe os novos props:
```tsx
    else if (!snap.msg.visao)
      tela = (
        <SalaEspera msg={snap.msg} aoIniciar={loja.iniciar} aoSair={() => void loja.sair()} salaId={snap.salaId} chat={snap.chat} aoChat={loja.enviarChat} />
      );
    else tela = <TelaMesa snap={snap} acoes={loja} aoChat={loja.enviarChat} />;
```

`apps/web/src/estilos.css` — acrescente:
```css
.visualmente-oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.chat {
  margin: 12px 0;
  padding: 8px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
}
.chat-mensagens {
  max-height: 30vh;
  overflow-y: auto;
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
}
.chat-form,
.convite {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.chat-form input,
.convite input {
  flex: 1;
  min-width: 0;
}
.confirmar-saida {
  position: fixed;
  inset: auto 16px 16px;
  z-index: 20;
  padding: 16px;
  border-radius: 12px;
  background: #1d2b22;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.confirmar-saida p {
  width: 100%;
  margin: 0 0 4px;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/web test`
Expected: PASS — todos.

Run: `pnpm --filter @truco/web typecheck` → sem erros.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/web
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(web): chat e convite da mesa privada, saída confirmada (aviso de abandono na ranqueada)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Web — lista de salas, criar mesa privada no lobby e entrar por link

**Files:**
- Modify: `apps/web/src/logica/lobby.ts`, `apps/web/src/telas/Lobby.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/src/telas/Salas.tsx`, `apps/web/src/telas/EntrarPrivada.tsx`
- Modify (testes existentes): `apps/web/test/lobby.test.tsx`, `apps/web/test/lobby-logica.test.ts` (acrescentar `modo` onde comparam `OpcoesEntrada` inteira)
- Test: `apps/web/test/salas.test.tsx`

**Step 1: Testes que falham**

Em `apps/web/test/lobby-logica.test.ts`, acrescente:
```ts
describe('modo', () => {
  test('clássica com bot fácil, desafio com difícil, privada quando marcada', () => {
    expect(opcoesDeEntrada(formPadrao('paulista', 'Ana')).modo).toBe('classica');
    expect(opcoesDeEntrada({ ...formPadrao('paulista', 'Ana'), nivelBot: 'dificil' }).modo).toBe('desafio');
    expect(opcoesDeEntrada({ ...formPadrao('paulista', 'Ana'), privada: true }).modo).toBe('privada');
  });

  test('trocar a variante mantém a privada', () => {
    expect(trocarVariante({ ...formPadrao(), privada: true }, 'mineiro').privada).toBe(true);
  });
});
```
(importe `trocarVariante` se ainda não estiver). Nos testes que comparam o resultado inteiro de `opcoesDeEntrada` (`toEqual`/`toHaveBeenCalledWith`), acrescente o `modo` correspondente (`'classica'`, ou `'desafio'` quando o teste usa bot difícil — como o primeiro teste de `lobby.test.tsx`).

Em `apps/web/test/lobby.test.tsx`, acrescente:
```tsx
  test('mesa privada: chama aoCriarPrivada em vez de aoJogar', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    const aoCriarPrivada = vi.fn();
    render(<Lobby aoJogar={aoJogar} aoCriarPrivada={aoCriarPrivada} />);
    await user.click(screen.getByLabelText('Mesa privada (só entra quem tiver o link)'));
    await user.click(screen.getByRole('button', { name: 'Criar mesa privada' }));
    expect(aoJogar).not.toHaveBeenCalled();
    expect(aoCriarPrivada.mock.calls[0][0]).toMatchObject({ modo: 'privada' });
  });
```

`apps/web/test/salas.test.tsx`
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { REGRAS_RANQUEADA } from '@truco/engine';
import { describe, expect, test, vi } from 'vitest';
import { TelaEntrarPrivada } from '../src/telas/EntrarPrivada';
import { TelaSalas } from '../src/telas/Salas';

const SALA = { id: 'abc123', modo: 'desafio', variante: 'mineiro', humanos: 2, nivelBot: 'dificil', regras: REGRAS_RANQUEADA.mineiro, ocupados: 1, dono: 'Ana' } as const;

describe('TelaSalas', () => {
  test('lista mesas abertas e entra pelo id', async () => {
    const user = userEvent.setup();
    const aoEntrar = vi.fn();
    const salas = vi.fn(async () => ({ salas: [{ ...SALA }] }));
    render(<TelaSalas api={{ salas }} aoEntrar={aoEntrar} />);
    const item = await screen.findByRole('listitem');
    expect(item).toHaveTextContent('Desafio · Mineiro');
    expect(item).toHaveTextContent('1/2 humanos');
    expect(item).toHaveTextContent('Ana');
    await user.click(screen.getByRole('button', { name: 'Entrar na mesa de Ana' }));
    expect(aoEntrar).toHaveBeenCalledWith('abc123');
    await user.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(salas).toHaveBeenCalledTimes(2);
  });

  test('vazia', async () => {
    render(<TelaSalas api={{ salas: vi.fn(async () => ({ salas: [] })) }} aoEntrar={vi.fn()} />);
    expect(await screen.findByText(/Nenhuma mesa esperando jogadores/)).toBeInTheDocument();
  });
});

describe('TelaEntrarPrivada', () => {
  test('pede o apelido e entra', async () => {
    const user = userEvent.setup();
    const aoEntrar = vi.fn();
    render(<TelaEntrarPrivada codigo="abcd1234" nomeInicial="Bia" aoEntrar={aoEntrar} />);
    expect(screen.getByText('abcd1234')).toBeInTheDocument();
    expect(screen.getByLabelText('Apelido')).toHaveValue('Bia');
    await user.click(screen.getByRole('button', { name: 'Entrar na mesa' }));
    expect(aoEntrar).toHaveBeenCalledWith('Bia');
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/web test lobby salas`
Expected: FAIL — `modo`/`privada` inexistentes; telas inexistentes.

**Step 3: Implementação**

`apps/web/src/logica/lobby.ts`:
- `FormLobby` ganha `/** Mesa privada (link de convite). */ privada: boolean;`
- `OpcoesEntrada` ganha `modo: 'classica' | 'desafio' | 'privada';`
- `formPadrao` devolve também `privada: false`; `trocarVariante` preserva `privada: f.privada`.
- em `opcoesDeEntrada`, acrescente ao objeto: `modo: f.privada ? 'privada' : f.nivelBot === 'dificil' ? 'desafio' : 'classica',`

`apps/web/src/telas/Lobby.tsx`:
- `Props` ganha `aoCriarPrivada?: (o: OpcoesEntrada) => void;` (desestruture junto de `aoJogar`, `aoRanqueada`).
- o `enviar` passa a:
```tsx
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    gravarApelido(f.nome.trim());
    const o = opcoesDeEntrada(f);
    if (o.modo === 'privada' && aoCriarPrivada) aoCriarPrivada(o);
    else aoJogar(o);
  };
```
- antes de `<div className="botoes-lobby">`:
```tsx
        {aoCriarPrivada && (
          <label className="campo-check">
            <input type="checkbox" checked={f.privada} onChange={(e) => mudar('privada', e.target.checked)} />
            Mesa privada (só entra quem tiver o link)
          </label>
        )}
```
- o texto do botão de envio passa a `{f.privada && aoCriarPrivada ? 'Criar mesa privada' : 'Jogar'}`.

`apps/web/src/telas/Salas.tsx`
```tsx
import { NOME_MODO, NOME_VARIANTE } from '../logica/conta';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

interface Props {
  api: Pick<Api, 'salas'>;
  aoEntrar: (id: string) => void;
}

export function TelaSalas({ api, aoEntrar }: Props) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.salas(), []);
  return (
    <main className="tela-conta">
      <h1>Mesas abertas</h1>
      <p>
        <button type="button" onClick={recarregar}>
          Atualizar
        </button>
      </p>
      {carregando && !dados && <p role="status">Carregando…</p>}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && dados.salas.length === 0 && <p>Nenhuma mesa esperando jogadores agora. Crie uma no Início.</p>}
      {dados && dados.salas.length > 0 && (
        <ul className="lista-dados">
          {dados.salas.map((s) => (
            <li key={s.id}>
              <span>
                {NOME_MODO[s.modo]} · {NOME_VARIANTE[s.variante]}
              </span>
              <span>
                {s.ocupados}/{s.humanos} humanos
              </span>
              <span>{s.dono ?? '—'}</span>
              <button type="button" aria-label={`Entrar na mesa de ${s.dono ?? 'alguém'}`} onClick={() => aoEntrar(s.id)}>
                Entrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

`apps/web/src/telas/EntrarPrivada.tsx`
```tsx
import { type FormEvent, useState } from 'react';
import { gravarApelido } from '../logica/lobby';

interface Props {
  codigo: string;
  nomeInicial: string;
  aoEntrar: (nome: string) => void;
}

export function TelaEntrarPrivada({ codigo, nomeInicial, aoEntrar }: Props) {
  const [nome, setNome] = useState(nomeInicial);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    gravarApelido(nome.trim());
    aoEntrar(nome.trim() || 'Jogador');
  };
  return (
    <main className="tela-conta">
      <h1>Mesa privada</h1>
      <p>
        Você foi convidado para a mesa <code>{codigo}</code>.
      </p>
      <form className="formulario" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="apelido-privada">Apelido</label>
          <input id="apelido-privada" type="text" maxLength={20} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <button type="submit" className="botao-principal">
          Entrar na mesa
        </button>
      </form>
    </main>
  );
}
```

`apps/web/src/App.tsx`:
- imports: `criarMesaPrivada`, `entrarPorCodigo` (de `./rede/conexao`), `lerApelido` (de `./logica/lobby`), `TelaSalas`, `TelaEntrarPrivada`.
- dentro do componente: `const nomePadrao = () => ses.usuario?.apelido ?? (lerApelido() || 'Jogador');`
- no `switch`, antes do `default`:
```tsx
      case 'salas':
        conteudo = <TelaSalas api={api} aoEntrar={(id) => void entrarPorCodigo(loja, id, nomePadrao())} />;
        break;
      case 'privada':
        conteudo = (
          <TelaEntrarPrivada
            key={rota.codigo}
            codigo={rota.codigo}
            nomeInicial={ses.usuario?.apelido ?? lerApelido()}
            aoEntrar={(nome) => {
              // ao sair da mesa volta ao início, não à tela do convite
              navegar({ tela: 'inicio' });
              void entrarPorCodigo(loja, rota.codigo, nome);
            }}
          />
        );
        break;
```
- no `default`, o `Lobby` ganha `aoCriarPrivada={(o) => void criarMesaPrivada(loja, o)}`.

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/web test` → PASS (todos).
Run: `pnpm typecheck` → sem erros nos três pacotes.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/web
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(web): lista de mesas abertas, mesa privada no lobby e entrada por link de convite" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: Web — fila ranqueada (loja da fila, tela e botão Ranqueada)

**Files:**
- Create: `apps/web/src/rede/fila.ts`, `apps/web/src/telas/Fila.tsx`
- Modify: `apps/web/src/logica/conta.ts`, `apps/web/src/rede/hooks.ts`, `apps/web/src/rede/instancia.ts`, `apps/web/src/App.tsx`
- Test: `apps/web/test/fila.test.tsx`, `apps/web/test/conta.test.ts`

**Step 1: Testes que falham**

Em `apps/web/test/conta.test.ts`, importe `formatarEspera` e `textoErroFila` e acrescente:
```ts
describe('fila', () => {
  test('formatarEspera', () => {
    expect(formatarEspera(0)).toBe('0:00');
    expect(formatarEspera(75)).toBe('1:15');
  });

  test('textoErroFila', () => {
    expect(textoErroFila('fila bloqueada até 2026-11-05T12:05:00.000Z por abandono de partida ranqueada')).toMatch(
      /^Fila bloqueada até \d{2}:\d{2} por abandono de partida ranqueada\.$/,
    );
    expect(textoErroFila('entre na sua conta para jogar ranqueada')).toBe('Entre na sua conta para jogar ranqueada.');
    expect(textoErroFila('rede caiu')).toBe('Não foi possível entrar na fila: rede caiu');
  });
});
```

`apps/web/test/fila.test.tsx`
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import { criarLojaFila, type EstadoFila, type SalaFilaLike } from '../src/rede/fila';
import { TelaFila } from '../src/telas/Fila';

class FilaFalsa extends EventEmitter implements SalaFilaLike {
  saiu = false;
  onMessage(tipo: string, cb: (p: any) => void) {
    this.on(`msg:${tipo}`, cb);
  }
  onLeave(cb: (code: number) => void) {
    this.on('leave', cb);
  }
  async leave() {
    this.saiu = true;
    return 4000;
  }
}

const OPC = { variante: 'paulista', formato: '1x1' } as const;

describe('loja da fila', () => {
  test('entra, recebe status, é pareada: sai da fila e consome a reserva', async () => {
    const sala = new FilaFalsa();
    const aoParear = vi.fn(async () => {});
    const f = criarLojaFila({ abrir: vi.fn(async () => sala), aoParear });
    await f.entrar(OPC);
    expect(f.getSnapshot().status).toBe('na-fila');
    sala.emit('msg:status', { esperaS: 3, faixa: 100, naFila: 2, aguardandoParceiro: false });
    expect(f.getSnapshot().info?.naFila).toBe(2);
    sala.emit('msg:pareado', { reserva: { roomId: 'r9' } });
    expect(sala.saiu).toBe(true);
    expect(aoParear).toHaveBeenCalledWith({ roomId: 'r9' });
    await vi.waitFor(() => expect(f.getSnapshot().status).toBe('fora'));
  });

  test('servidor recusa (bloqueio): fica fora com a mensagem traduzida', async () => {
    const f = criarLojaFila({ abrir: vi.fn(async () => Promise.reject(new Error('entre na sua conta para jogar ranqueada'))), aoParear: vi.fn() });
    await f.entrar(OPC);
    expect(f.getSnapshot()).toMatchObject({ status: 'fora', erro: 'Entre na sua conta para jogar ranqueada.' });
  });

  test('cancelar sai da sala; queda inesperada avisa', async () => {
    const sala = new FilaFalsa();
    const f = criarLojaFila({ abrir: vi.fn(async () => sala), aoParear: vi.fn() });
    await f.entrar(OPC);
    await f.cancelar();
    expect(sala.saiu).toBe(true);
    expect(f.getSnapshot().status).toBe('fora');
    const outra = new FilaFalsa();
    const g = criarLojaFila({ abrir: vi.fn(async () => outra), aoParear: vi.fn() });
    await g.entrar(OPC);
    outra.emit('leave', 1006);
    expect(g.getSnapshot()).toMatchObject({ status: 'fora', erro: 'Você saiu da fila.' });
  });
});

const FORA: EstadoFila = { status: 'fora', opcoes: null, info: null, erro: null };

describe('TelaFila', () => {
  test('escolhe variante, formato e código de dupla', async () => {
    const user = userEvent.setup();
    const aoEntrar = vi.fn();
    render(<TelaFila estado={FORA} aoEntrar={aoEntrar} aoCancelar={vi.fn()} />);
    expect(screen.queryByLabelText('Código da dupla (opcional)')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Variante'), 'mineiro');
    await user.selectOptions(screen.getByLabelText('Formato'), '2x2');
    await user.type(screen.getByLabelText('Código da dupla (opcional)'), 'amigos');
    expect(screen.getByText(/família fechada/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entrar na fila' }));
    expect(aoEntrar).toHaveBeenCalledWith({ variante: 'mineiro', formato: '2x2', codigoDupla: 'amigos' });
  });

  test('na fila: tempo, faixa e cancelar; erro como alerta', async () => {
    const user = userEvent.setup();
    const aoCancelar = vi.fn();
    const { rerender } = render(
      <TelaFila
        estado={{ status: 'na-fila', opcoes: { ...OPC }, info: { esperaS: 75, faixa: 300, naFila: 4, aguardandoParceiro: false }, erro: null }}
        aoEntrar={vi.fn()}
        aoCancelar={aoCancelar}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Procurando adversário…');
    expect(screen.getByRole('status')).toHaveTextContent('1:15 · faixa ±300 · 4 na fila');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(aoCancelar).toHaveBeenCalled();
    rerender(<TelaFila estado={{ ...FORA, erro: 'Fila bloqueada até 12:05 por abandono de partida ranqueada.' }} aoEntrar={vi.fn()} aoCancelar={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Fila bloqueada');
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/web test fila conta`
Expected: FAIL — módulos/funções inexistentes.

**Step 3: Implementação**

`apps/web/src/logica/conta.ts` — acrescente:
```ts
export function formatarEspera(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Mensagens do `onAuth` da sala `fila` em português de gente. */
export function textoErroFila(msg: string): string {
  const m = msg.match(/bloqueada até (\S+)/);
  if (m) {
    const d = new Date(m[1]);
    if (!Number.isNaN(d.getTime())) {
      return `Fila bloqueada até ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por abandono de partida ranqueada.`;
    }
  }
  if (/entre na sua conta/.test(msg)) return 'Entre na sua conta para jogar ranqueada.';
  return `Não foi possível entrar na fila: ${msg}`;
}
```

`apps/web/src/rede/fila.ts`
```ts
import type { Formato, MsgPareado, MsgStatusFila } from '@truco/api';
import type { Variante } from '@truco/engine';
import { textoErroFila } from '../logica/conta';

export interface OpcoesFila {
  variante: Variante;
  formato: Formato;
  codigoDupla?: string;
}

/** O mínimo do `Room` do SDK que a loja da fila usa. */
export interface SalaFilaLike {
  onMessage(tipo: string, cb: (payload: any) => void): unknown;
  onLeave(cb: (code: number) => void): unknown;
  leave(consented?: boolean): Promise<number>;
}

export type StatusFila = 'fora' | 'entrando' | 'na-fila' | 'pareado';

export interface EstadoFila {
  status: StatusFila;
  opcoes: OpcoesFila | null;
  info: MsgStatusFila | null;
  erro: string | null;
}

/** Close code do server quando o mesmo usuário entra na fila por outra aba (`SAIDA_FILA_SUBSTITUIDA`). */
const SAIDA_FILA_SUBSTITUIDA = 4011;

const INICIAL: EstadoFila = { status: 'fora', opcoes: null, info: null, erro: null };

export function criarLojaFila(o: { abrir: (op: OpcoesFila) => Promise<SalaFilaLike>; aoParear: (reserva: unknown) => Promise<void> }) {
  let estado: EstadoFila = INICIAL;
  let sala: SalaFilaLike | null = null;
  const ouvintes = new Set<() => void>();
  const mudar = (p: Partial<EstadoFila>) => {
    estado = { ...estado, ...p };
    for (const f of ouvintes) f();
  };

  return {
    subscribe(f: () => void): () => void {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    getSnapshot: (): EstadoFila => estado,

    async entrar(op: OpcoesFila): Promise<void> {
      if (estado.status !== 'fora') return;
      mudar({ status: 'entrando', opcoes: op, info: null, erro: null });
      let s: SalaFilaLike;
      try {
        s = await o.abrir(op);
      } catch (e) {
        mudar({ status: 'fora', erro: textoErroFila(e instanceof Error ? e.message : String(e)) });
        return;
      }
      sala = s;
      s.onMessage('status', (m: MsgStatusFila) => {
        if (sala === s) mudar({ status: 'na-fila', info: m });
      });
      s.onMessage('pareado', (m: MsgPareado) => {
        if (sala !== s) return;
        sala = null;
        mudar({ status: 'pareado' });
        s.leave(true).catch(() => {});
        o.aoParear(m.reserva).finally(() => mudar({ ...INICIAL, opcoes: estado.opcoes }));
      });
      s.onLeave((code) => {
        if (sala !== s) return;
        sala = null;
        mudar({ ...INICIAL, opcoes: estado.opcoes, erro: code === SAIDA_FILA_SUBSTITUIDA ? 'Você entrou na fila em outra aba.' : 'Você saiu da fila.' });
      });
      if (estado.status === 'entrando') mudar({ status: 'na-fila' });
    },

    async cancelar(): Promise<void> {
      const s = sala;
      sala = null;
      mudar({ ...INICIAL, opcoes: estado.opcoes });
      if (s) await s.leave(true).catch(() => 0);
    },
  };
}

export type LojaFila = ReturnType<typeof criarLojaFila>;
```

`apps/web/src/telas/Fila.tsx`
```tsx
import type { Formato } from '@truco/api';
import type { Variante } from '@truco/engine';
import { type FormEvent, useState } from 'react';
import { formatarEspera } from '../logica/conta';
import type { EstadoFila, OpcoesFila } from '../rede/fila';

interface Props {
  estado: EstadoFila;
  aoEntrar: (o: OpcoesFila) => void;
  aoCancelar: () => void;
}

const REGRAS_FIXAS: Record<Variante, string> = {
  paulista: 'vira, 1 · 3 · 6 · 9 · 12, mão de 11, sem família',
  mineiro: 'manilhas fixas, 2 · 4 · 8 · 10 · 12, mão de 10, família fechada',
};

export function TelaFila({ estado, aoEntrar, aoCancelar }: Props) {
  const [variante, setVariante] = useState<Variante>(estado.opcoes?.variante ?? 'paulista');
  const [formato, setFormato] = useState<Formato>(estado.opcoes?.formato ?? '1x1');
  const [codigo, setCodigo] = useState(estado.opcoes?.codigoDupla ?? '');

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const c = codigo.trim();
    aoEntrar({ variante, formato, ...(formato === '2x2' && c ? { codigoDupla: c } : {}) });
  };

  return (
    <main className="tela-conta">
      <h1>Ranqueada</h1>
      {estado.status === 'fora' ? (
        <form className="formulario" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="fila-variante">Variante</label>
            <select id="fila-variante" value={variante} onChange={(e) => setVariante(e.target.value as Variante)}>
              <option value="paulista">Paulista</option>
              <option value="mineiro">Mineiro</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fila-formato">Formato</label>
            <select id="fila-formato" value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
              <option value="1x1">1 contra 1 (cada um com um bot parceiro)</option>
              <option value="2x2">2 contra 2</option>
            </select>
          </div>
          {formato === '2x2' && (
            <div className="campo">
              <label htmlFor="fila-codigo">Código da dupla (opcional)</label>
              <input id="fila-codigo" type="text" maxLength={12} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              <p className="nota">Para jogar com um amigo, combinem um código (4 a 12 letras ou números) e os dois digitam o mesmo.</p>
            </div>
          )}
          <p className="nota">Regras fixas: {REGRAS_FIXAS[variante]}. Sair no meio conta como derrota e bloqueia a fila por 5 minutos.</p>
          <button type="submit" className="botao-principal">
            Entrar na fila
          </button>
        </form>
      ) : (
        <div className="status-fila" role="status">
          <p>
            {estado.status === 'pareado'
              ? 'Adversário encontrado! Abrindo a mesa…'
              : estado.info?.aguardandoParceiro
                ? 'Esperando seu parceiro entrar com o mesmo código…'
                : 'Procurando adversário…'}
          </p>
          {estado.info && (
            <p>
              {formatarEspera(estado.info.esperaS)} · faixa ±{estado.info.faixa} · {estado.info.naFila} na fila
            </p>
          )}
          {estado.status !== 'pareado' && (
            <button type="button" onClick={aoCancelar}>
              Cancelar
            </button>
          )}
        </div>
      )}
      {estado.erro && (
        <p className="erro-form" role="alert">
          {estado.erro}
        </p>
      )}
    </main>
  );
}
```

`apps/web/src/rede/hooks.ts` — acrescente `import type { EstadoFila, LojaFila } from './fila';` e:
```ts
export const useFila = (f: LojaFila): EstadoFila => useSyncExternalStore(f.subscribe, f.getSnapshot);
```

`apps/web/src/rede/instancia.ts` — acrescente:
```ts
import { abrirFila, entrarComReserva } from './conexao';
import { criarLojaFila, type SalaFilaLike } from './fila';

export const lojaFila = criarLojaFila({
  abrir: async (o) => (await abrirFila(o)) as SalaFilaLike,
  aoParear: (reserva) => entrarComReserva(loja, reserva),
});
```
(junte o import de `./conexao` com o `gravarToken` que já existe.)

`apps/web/src/App.tsx`:
- imports `useFila` (de `./rede/hooks`), `lojaFila` (de `./rede/instancia`), `TelaFila`.
- no componente: `const fila = useFila(lojaFila);`
- no `switch`, antes do `default`:
```tsx
      case 'fila':
        conteudo =
          ses.pronta && !ses.usuario ? (
            <main className="tela-conta">
              <h1>Ranqueada</h1>
              <p>
                Para jogar ranqueada, <a href="#/entrar">entre na sua conta</a>.
              </p>
            </main>
          ) : (
            <TelaFila estado={fila} aoEntrar={(o) => void lojaFila.entrar(o)} aoCancelar={() => void lojaFila.cancelar()} />
          );
        break;
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/web test` → PASS (todos).
Run: `pnpm typecheck` → sem erros.

Teste manual (dev, dois navegadores ou uma janela anônima):
1. `pnpm dev:server` e `pnpm dev:web`.
2. Em cada navegador: `http://localhost:5173/#/entrar`, pedir link com e-mails diferentes; o link aparece no console do server (`[e-mail para ...]`); abra-o no **mesmo** navegador.
3. Nos dois: Início → Ranqueada → Paulista, 1 contra 1 → Entrar na fila. Em ~1 s a mesa abre nos dois, com um bot parceiro cada.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/web
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(web): fila ranqueada 1x1/2x2 com código de dupla; botão Ranqueada habilitado" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 23: E2E — login por link mágico, fila 1x1 com dois navegadores e abandono que grava Elo

**Files:**
- Modify: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/ranqueada.spec.ts`

**Step 1: Configuração**

`apps/web/playwright.config.ts`:
- no `webServer` do server, `env` passa a:
```ts
      env: {
        PORT: String(PORTA_SERVIDOR),
        TRUCO_TEMPOS: 'rapido',
        // banco descartável e caixa de saída de teste (GET /api/teste/emails)
        TRUCO_PGLITE: 'memoria',
        TRUCO_EMAIL_TESTE: '1',
        TRUCO_URL_PUBLICA: `http://127.0.0.1:${PORTA_WEB}`,
      },
```
- no `webServer` do web, `env` passa a:
```ts
      env: { VITE_SERVIDOR: `ws://127.0.0.1:${PORTA_SERVIDOR}`, TRUCO_PROXY_API: `http://127.0.0.1:${PORTA_SERVIDOR}` },
```
O cookie é gravado em `127.0.0.1` (resposta do proxy do Vite em :5180) e vai junto no matchmaking/WebSocket para `127.0.0.1:2570` (cookie não depende de porta; mesmo host = *same-site*).

**Step 2: O teste (falha até tudo estar ligado)**

`apps/web/e2e/ranqueada.spec.ts`
```ts
import { type Browser, devices, expect, type Page, test } from '@playwright/test';

const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';

/** Novo contexto (cookies próprios), login por link mágico lido da caixa de saída de teste. */
async function entrar(browser: Browser, email: string): Promise<Page> {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], baseURL: WEB });
  const page = await contexto.newPage();
  await page.goto('/#/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText(/Enviamos um link/)).toBeVisible();
  const { emails } = await (await page.request.get(`${API}/api/teste/emails`)).json();
  const link = emails.filter((e: { para: string }) => e.para === email).at(-1).link as string;
  expect(link.startsWith(`${WEB}/#/entrar?token=`)).toBe(true);
  await page.goto(link);
  await expect(page.getByTestId('usuario-logado')).toBeVisible({ timeout: 15_000 });
  return page;
}

async function entrarNaFila(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ranqueada' }).click();
  await page.getByLabel('Variante').selectOption('paulista');
  await page.getByLabel('Formato').selectOption('1x1');
  await page.getByRole('button', { name: 'Entrar na fila' }).click();
}

test('link mágico, fila 1x1 com dois jogadores e abandono que custa Elo e bloqueia a fila', async ({ browser }) => {
  const ana = await entrar(browser, 'ana.e2e@teste.dev');
  await expect(ana.getByTestId('usuario-logado')).toHaveText('anae2e');
  const bia = await entrar(browser, 'bia.e2e@teste.dev');

  await entrarNaFila(ana);
  await expect(ana.getByRole('status')).toContainText(/Procurando adversário|Adversário encontrado/);
  await entrarNaFila(bia);

  await expect(ana.getByTestId('minha-mao')).toBeVisible({ timeout: 30_000 });
  await expect(bia.getByTestId('minha-mao')).toBeVisible({ timeout: 30_000 });

  // Ana abandona: confirma a saída
  await ana.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(ana.getByRole('alertdialog')).toContainText('conta como derrota');
  await ana.getByRole('button', { name: 'Sair da mesa' }).click();
  await expect(ana.getByRole('heading', { name: 'Ranqueada' })).toBeVisible();

  // O abandono vale como derrota contra Elo igual: 1000 → 984 (K = 32)
  await expect
    .poll(async () => (await (await ana.request.get(`${WEB}/api/perfil`)).json()).variantes.paulista.elo, { timeout: 10_000 })
    .toBe(984);
  await ana.goto('/#/perfil');
  await expect(ana.getByTestId('elo-paulista')).toHaveText('984');
  await expect(ana.getByTestId('pontos-paulista')).toHaveText('0');

  // E a fila fica bloqueada por 5 minutos
  await ana.goto('/#/fila');
  await ana.getByRole('button', { name: 'Entrar na fila' }).click();
  await expect(ana.getByRole('alert')).toContainText('Fila bloqueada até');

  await ana.context().close();
  await bia.context().close();
});
```

**Step 3: Rodar**

Run: `pnpm test:e2e`
Expected: os três specs passam (`partida.spec.ts`, o de 2 humanos do revisor e `ranqueada.spec.ts`), por exemplo:
```
  ✓  1 [celular] › e2e/partida.spec.ts:3:1 › 1 humano + 3 bots fáceis jogam até o fim da partida
  ...
  ✓  3 [celular] › e2e/ranqueada.spec.ts:...:1 › link mágico, fila 1x1 com dois jogadores e abandono que custa Elo e bloqueia a fila
  3 passed
```
Se falhar, rode com `pnpm --filter @truco/web exec playwright test ranqueada --trace on` e abra o trace (`pnpm --filter @truco/web exec playwright show-trace test-results/.../trace.zip`). Causas prováveis: proxy do Vite sem `TRUCO_PROXY_API` (o `/api` dá 404/ECONNREFUSED), cookie não chega ao matchmaking (confira que a página está em `127.0.0.1`, não `localhost`), ou a fila não roda (`FilaRoom.intervaloMs` padrão 1 s — normal).

**Step 4: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add apps/web/playwright.config.ts apps/web/e2e/ranqueada.spec.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "test(web): E2E de login por link mágico, fila ranqueada 1x1 e abandono que grava Elo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 24: Deploy no Railway — Dockerfile, `railway.json`, guia, teste do build e verificação final

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `railway.json`, `docs/deploy-railway.md`

**Step 1: Dockerfile e ignores**

`Dockerfile`
```dockerfile
# syntax=docker/dockerfile:1
# Monorepo pnpm (node-linker=hoisted). O server roda TypeScript com tsx; o web é build estático
# servido pelo próprio server (mesma origem). Se a imagem node:26 não existir, use
# `--build-arg NODE_VERSION=24` (Node 24 LTS).
ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-slim AS base
# Node 25+ não traz mais o corepack: instala o pnpm do packageManager direto do npm.
RUN npm install -g pnpm@9.12.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @truco/web build

FROM base AS producao
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
RUN pnpm install --frozen-lockfile --prod
COPY tsconfig.base.json ./
COPY packages/engine/src packages/engine/src
COPY apps/server/tsconfig.json apps/server/
COPY apps/server/src apps/server/src
COPY apps/server/drizzle apps/server/drizzle
COPY --from=build /app/apps/web/dist apps/web/dist
# Só usado sem DATABASE_URL (PGlite em disco); com Postgres fica vazio.
RUN mkdir -p apps/server/.dados && chown node:node apps/server/.dados
USER node
WORKDIR /app/apps/server
EXPOSE 8080
# node direto (sem pnpm no meio) para o SIGTERM do Railway chegar ao Colyseus (desligamento gracioso).
# O tsx resolve os aliases (@truco/engine) pelo tsconfig desta pasta.
CMD ["node", "--import", "tsx", "src/main.ts"]
```

`.dockerignore`
```
**/node_modules
**/dist
**/.dados
.git
test-results
playwright-report
coverage
*.log
.env
```

`railway.json`
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/saude",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```
(`numReplicas: 1`: salas, fila e matchmaking do Colyseus vivem na memória do processo; mais de uma réplica exigiria Redis — fora deste plano.)

**Step 2: Guia para o usuário**

`docs/deploy-railway.md`
````markdown
# Deploy no Railway

O serviço único (`server`) roda o Colyseus, a API HTTP e entrega o build do web na mesma origem.
O banco é o Postgres gerenciado do Railway. As migrações rodam sozinhas no boot.

## 0. Antes de começar

- O código precisa estar num repositório do GitHub (faça o push você mesmo).
- Conta no [Railway](https://railway.com). Opcional: conta no [Resend](https://resend.com) (e-mail) e um projeto no [Google Cloud](https://console.cloud.google.com) (login Google).
- Teste local do build de produção: `pnpm build` e depois
  `NODE_ENV=production TRUCO_PGLITE=memoria PORT=2580 pnpm start`; em outro terminal
  `TRUCO_URL_FUMACA=http://127.0.0.1:2580 pnpm --filter @truco/server fumaca`.

## 1. Criar o projeto

1. Railway → **New Project** → **Deploy from GitHub repo** → escolha o repositório.
2. O Railway lê o `railway.json`: build pelo `Dockerfile`, health check em `/saude`, 1 réplica.
   Não precisa configurar comando de build/start.

## 2. Adicionar o Postgres

1. No projeto: **+ New** → **Database** → **Add PostgreSQL**.
2. No serviço do app → **Variables** → **New Variable** → `DATABASE_URL` com o valor
   `${{Postgres.DATABASE_URL}}` (referência; o Railway resolve). Use a URL interna (padrão), sem SSL.

## 3. Variáveis do serviço

| Variável | Obrigatória? | Valor |
|---|---|---|
| `DATABASE_URL` | sim | `${{Postgres.DATABASE_URL}}` |
| `RESEND_API_KEY` | para e-mail real | chave do Resend (passo 6). Sem ela, o link mágico só aparece nos logs. |
| `TRUCO_EMAIL_REMETENTE` | com Resend | ex. `Truco <entrar@seu-dominio.com>` |
| `GOOGLE_CLIENT_ID` | para login Google | client ID (passo 5). Sem ela, o botão do Google não aparece. |
| `TRUCO_URL_PUBLICA` | com domínio próprio | `https://truco.seu-dominio.com` (sem barra no fim). Sem ela, usa `https://$RAILWAY_PUBLIC_DOMAIN`. |
| `TRUCO_ORIGENS` | raro | outras origens aceitas no CORS, separadas por vírgula |
| `TRUCO_K_ELO` | não | K do Elo (padrão 32) |

**Não** defina `PORT` (o Railway injeta) nem `NODE_ENV` (o Dockerfile já põe `production`).
**Nunca** defina `TRUCO_EMAIL_TESTE` em produção (é ignorada, mas não tem por quê).

## 4. Domínio

- Serviço → **Settings** → **Networking** → **Generate Domain**: gera `algo.up.railway.app`
  (a variável `RAILWAY_PUBLIC_DOMAIN` passa a existir e os links mágicos usam esse domínio).
- Domínio próprio: **Custom Domain** → crie o `CNAME` que o Railway mostrar no seu DNS → espere o
  certificado → defina `TRUCO_URL_PUBLICA=https://seu.dominio`.

## 5. Login com Google (opcional)

1. Google Cloud Console → **APIs & Services** → **OAuth consent screen**: tipo *External*, nome do app,
   e-mail de suporte; escopos `openid`, `email`, `profile`. Publique (ou adicione testadores).
2. **Credentials** → **Create credentials** → **OAuth client ID** → *Web application*.
3. **Authorized JavaScript origins**: `https://seu.dominio` (e/ou `https://algo.up.railway.app`);
   para desenvolver localmente, também `http://localhost` e `http://localhost:5173`.
4. **Authorized redirect URIs**: não precisa (o Google Identity Services devolve o ID token para a
   página, que manda para `POST /api/auth/google`).
5. Copie o **Client ID** para `GOOGLE_CLIENT_ID` no Railway (e, se quiser em dev, exporte a mesma
   variável antes de `pnpm dev:server`).

## 6. E-mail com Resend (opcional, recomendado)

1. Resend → **Domains** → **Add Domain** → crie os registros DNS (SPF/DKIM) e espere verificar.
   Sem domínio verificado, o remetente `onboarding@resend.dev` só entrega para o e-mail da sua conta
   Resend (serve para testar).
2. **API Keys** → **Create API Key** (permissão *Sending access*) → `RESEND_API_KEY`.
3. `TRUCO_EMAIL_REMETENTE` com um endereço do domínio verificado.

## 7. Conferir o deploy

- **Deployments** → logs: `truco: servidor ouvindo na porta ... (banco: postgres; web: build servido)`.
  Avisos `truco: aviso: ...` dizem o que falta configurar.
- `https://seu.dominio/saude` → `{"ok":true}`.
- Do seu computador: `TRUCO_URL_FUMACA=https://seu.dominio pnpm --filter @truco/server fumaca`.
- Entre com o link mágico, jogue uma partida e veja o histórico.

## 8. Dia a dia

- **Migrações:** mudou `apps/server/src/banco/schema.ts` → `pnpm --filter @truco/server db:gerar --name <o-que-mudou>`
  → commit da pasta `apps/server/drizzle` → push. O boot aplica as pendentes. Não edite migrações já publicadas.
- **Backups:** ative no Postgres do Railway (aba **Backups**).
- **Escala:** mantenha 1 réplica (salas e fila ficam na memória). Para mais, seria preciso Redis
  (presence/driver do Colyseus) — não implementado.
- **Problemas comuns:** health check falhando → veja se o `DATABASE_URL` resolve (logs de migração);
  link mágico com domínio errado → `TRUCO_URL_PUBLICA`; botão do Google some → `GOOGLE_CLIENT_ID`
  ausente ou origem não autorizada no Google Cloud (o console do navegador mostra o erro do GIS).
````

**Step 3: Testar o build da imagem (só se o Docker estiver rodando)**

Run: `docker info --format "{{.ServerVersion}}"`
- Se responder uma versão:
  - Run: `docker build -t truco:local .`
    Expected: as quatro etapas terminam; última linha `naming to docker.io/library/truco:local`. (Se `node:26-slim` não existir: `docker build --build-arg NODE_VERSION=24 -t truco:local .`)
  - Run: `docker run --rm -d --name truco-local -p 2581:8080 -e PORT=8080 -e TRUCO_PGLITE=memoria truco:local`
  - Run: `docker logs truco-local` → `truco: servidor ouvindo na porta 8080 (banco: pglite em memória; web: build servido)`
  - Run: `TRUCO_URL_FUMACA=http://127.0.0.1:2581 pnpm --filter @truco/server fumaca` → `fumaça: tudo certo`
  - Run: `docker stop truco-local`
- Se o Docker não estiver rodando: pule (a Tarefa 16 já validou `pnpm build` + `pnpm start` em produção). Anote no commit/PR que a imagem não foi construída localmente.

**Step 4: Verificação final**

Run: `pnpm test`
Expected: engine, server e web verdes (o server inclui `banco`, `elo`, `resultado`, `repo-*`, `auth-util`, `servicos`, `http-*`, `mesa-plano4`, `registro-mesa`, `fila` e `integracao`).

Run: `pnpm typecheck` → sem erros.

Run: `pnpm test:e2e` → todos os specs passam.

Run: `pnpm build` e o teste de fumaça da Tarefa 16 → `fumaça: tudo certo`.

Checklist manual (celular 375 px e desktop): login por link mágico (link no console do server); perfil mostra patente/pontos/Elo das duas variantes; ranking abre nas duas abas; mesa privada: criar, copiar link, abrir em janela anônima, conversar no chat, começar; lista de salas mostra uma mesa casual de 2 humanos esperando; ranqueada 1x1 com dois navegadores; sair no meio mostra o aviso e depois a fila recusa por 5 min.

**Step 5: Commit**
```
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add Dockerfile .dockerignore railway.json docs/deploy-railway.md
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "chore: deploy no Railway (Dockerfile multi-stage, railway.json, health check) e guia passo a passo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
**Não** faça push nem crie recursos no Railway: isso fica com o usuário, seguindo `docs/deploy-railway.md`.

---

## Pronto quando

- `pnpm test`, `pnpm typecheck` e `pnpm test:e2e` verdes; `pnpm build` + `NODE_ENV=production pnpm start` passa no teste de fumaça (e a imagem Docker, se o Docker estava disponível).
- Convidado joga Clássica/Desafio como antes; logado entra por link mágico (ou Google, se configurado), tem perfil com patente/pontos/Elo e estatísticas por variante, histórico e aparece no ranking.
- Ranqueada 1x1 e 2x2 (com código de dupla) pareia por Elo com faixa que alarga; Elo/pontos gravados no fim; abandono custa Elo e bloqueia a fila por 5 min; partida terminada só por bots não conta.
- Mesa privada por link com chat; lista de mesas abertas.
- Nenhum segredo necessário para testes e dev; `docs/deploy-railway.md` explica o que o usuário precisa criar.

## Fora deste plano

- Amigos/lista de amigos e convites in-app (a dupla usa código combinado).
- Recuperar/mesclar contas, excluir conta, LGPD (exportar dados), moderação do chat.
- Mais de uma réplica (Redis para presence/driver do Colyseus), filas entre processos.
- Temporadas/reset de patentes, decaimento por inatividade, Elo provisório (K maior nas primeiras partidas).
- Espectadores, replays, framer-motion e sons.
