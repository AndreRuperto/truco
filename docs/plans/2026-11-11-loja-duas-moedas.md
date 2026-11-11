# Loja com duas moedas — plano de implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fichas (moeda ganha jogando, apostável como cacife) e Pila (comprado em reais pela InfinitePay, só para itens de visual), com loja, inventário, itens equipados visíveis na mesa e cacife em mesas casuais, privadas e ranqueadas.

**Architecture:** Toda regra fica no servidor. Saldos ficam em `carteiras`, com extrato em `lancamentos`, e tudo passa por uma única função, `movimentar`, dentro de transações. O cacife é debitado e pago nas mesmas transações que já gravam a partida (`repo/partidas.ts`). O pagamento é um link do Checkout Integrado da InfinitePay. A confirmação sempre passa pelo `payment_check`, porque o webhook não tem assinatura. A web ganha a tela `#/loja` e passa a usar o `visual` que o servidor manda para cada cadeira.

**Tech Stack:** Express 5, Colyseus 0.18, Drizzle 0.45 (Postgres/PGlite), Vitest, React 18 + Vite, Playwright.

**Design:** [`2026-11-11-loja-duas-moedas-design.md`](2026-11-11-loja-duas-moedas-design.md) · **Branch:** `claude/loja` (worktree `C:\projetos\truco-loja`)

**Verificação global (no fim de cada tarefa):** `pnpm -r typecheck` e o teste da tarefa. No fim do plano: `pnpm -r test`, `pnpm --filter @truco/web build`, `pnpm test:e2e`.

---

### Task 1: Regras puras e catálogo

**Files:**
- Create: `apps/server/src/loja/regras.ts`, `apps/server/src/loja/catalogo.ts`
- Test: `apps/server/test/loja-regras.test.ts`

`regras.ts` exporta:
- `FICHAS_CADASTRO = 1000`, `FICHAS_DIARIO = 100`, `PISO_RESGATE = 100`, `RESGATE_ATE = 500`
- `CACIFES_MESA = [0, 50, 100, 250, 500, 1000]`
- `CACIFE_PATENTE: Record<Patente, number>` (50, 100, 200, 400, 800, 1500)
- `LIMITE_PREMIO_MESMOS = 5`
- `diaSP(d: Date): string` (AAAA-MM-DD em America/Sao_Paulo, via `Intl.DateTimeFormat('en-CA', { timeZone })`)
- `bonusDoDia(saldo, ultimoDia, hoje): { delta, motivo: 'diario' | 'resgate' } | null`
- `cacifeEfetivo(pedido, saldos: number[]): number` (`min(pedido, ...saldos)`, 0 se não houver saldos)
- `cacifeDaRanqueada(pontosPorJogador: number[]): number` (patente do maior valor)
- `dividirPote(pote, cadeirasVencedoras: number[]): Map<number, number>` (cadeiras em ordem crescente; o resto vai para a primeira)
- `cacifeValido(x): number` (valor da lista ou 0)

`catalogo.ts` exporta:
- `SLOTS = ['verso', 'roupa', 'moldura', 'avatar', 'tampo']`
- `ItemLoja { id, slot, nome, preco: { moeda: 'pila' | 'fichas', valor } | null, visual }`
- `ITENS` (16 itens do design; grátis com `preco: null`)
- `PACOTES` (`punhado` 490/100, `bolso` 990/220, `carteira` 2490/600, `cofre` 4990/1300)
- `itemPorId`, `pacotePorId`, `gratisDoSlot(slot)`

**Testes:** diário soma 100; resgate leva o saldo de 40 para 500 (delta 460); nada no mesmo dia; a virada é medida no fuso de SP (02:59Z ainda é o dia anterior); cacife efetivo com saldo baixo; ranqueada Grão-Mestre = 1500; pote 300 em 2 cadeiras = 150/150; pote 301 = 151/150; todos os ids únicos; todo item tem slot válido; nenhum item grátis tem preço; pacotes com preço ≥ 100 centavos.

Run: `pnpm --filter @truco/server exec vitest run test/loja-regras.test.ts`. Primeiro falha (módulo inexistente); depois passa. Commit: `feat(loja): regras de fichas, cacife e catálogo`.

### Task 2: Schema e migração

**Files:**
- Modify: `apps/server/src/banco/schema.ts`; `apps/server/test/banco-helpers.ts` (TRUNCATE inclui as novas tabelas)
- Create: `apps/server/drizzle/0005_loja.sql` (via `pnpm --filter @truco/server db:gerar`, depois renomear o arquivo e o `tag` no `_journal.json` para `0005_loja`)

Tabelas:
- `carteiras`: `usuario_id` PK→usuarios cascade, `fichas` int default 0, `pila` int default 0, `bonus_cadastro` bool default false, `ultimo_diario` text null; `check (fichas >= 0)` e `check (pila >= 0)`.
- `lancamentos`: id serial, `usuario_id` cascade, `moeda` text enum, `delta` int, `saldo_depois` int, `motivo` text enum, `ref` text null, `criado_em`; índice (usuario_id, criado_em).
- `inventario`: (usuario_id, item_id) PK, `adquirido_em`.
- `pedidos`: `id` text PK (uuid), `usuario_id` cascade, `pacote_id`, `valor_centavos`, `pila`, `status` enum (`criado`, `pago`, `estornado`), `checkout_url` null, `slug` null, `transaction_nsu` unique null, `capture_method` null, `pago_em` null, `criado_em`; índice (usuario_id, criado_em).
- `usuarios.equipados` jsonb null.
- `partidas.cacife` int default 0 not null; `partidas.pote` int default 0 not null.

Teste: `banco.test.ts` já sobe as migrações. Acrescentar um caso que insere uma carteira com fichas -1 e espera erro de check. Commit: `feat(loja): tabelas de carteira, extrato, inventário e pedidos`.

### Task 3: Carteira (`movimentar`, cadastro, diário, extrato)

**Files:** Create `apps/server/src/repo/carteira.ts`; Test `apps/server/test/repo-carteira.test.ts`

- `type Exec` igual ao de `repo/partidas.ts`; exportar `Exec` dali, ou repetir.
- `class SaldoInsuficiente extends Error`.
- `movimentar(tx, usuarioId, moeda, delta, motivo, ref?)`: faz `insert … on conflict do nothing` da carteira; depois `update carteiras set <moeda> = <moeda> + delta where usuario_id = $ and <moeda> + delta >= 0 returning <moeda>`. Sem linha, lança `SaldoInsuficiente`. Senão, insere o lançamento com `saldo_depois`. Com delta 0, não faz nada.
- `carteiraDe(db, usuarioId, agora)`: numa transação, aplica o cadastro (se `bonus_cadastro` for false, credita 1000 e marca) e o `bonusDoDia`, travando a linha com `for update`. Devolve `{ fichas, pila, bonusAplicado: { motivo, delta }[] }`.
- `extrato(db, usuarioId, limite = 30)`.

**Testes:**
- carteira nova recebe 1000 uma vez só;
- diário no dia seguinte;
- resgate;
- débito maior que o saldo lança erro e não grava lançamento;
- dois débitos concorrentes de 600 com saldo 1000 (`Promise.allSettled`): exatamente um passa;
- `saldo_depois` correto;
- soma dos lançamentos = saldo (invariante).

Commit: `feat(loja): carteira com extrato e bônus`.

### Task 4: Comprar e equipar itens

**Files:** Create `apps/server/src/repo/loja.ts`; Test `apps/server/test/repo-loja.test.ts`

- `comprarItem(db, usuarioId, itemId)` → `'ok' | 'inexistente' | 'gratis' | 'ja-tem' | 'saldo'`. Numa transação: insere no inventário (conflito = `ja-tem`) e chama `movimentar(moeda do item, -valor, 'compra_item', itemId)`. `SaldoInsuficiente` vira `'saldo'` e desfaz a transação.
- `inventarioDe(db, usuarioId): string[]`.
- `equipar(db, usuarioId, slot, itemId | null)` → `'ok' | 'invalido' | 'nao-tem'`. Valida o slot e o item do slot (grátis ou no inventário). `null` volta para o grátis. Slot `avatar`: grava em `usuarios.avatar` como `loja:<id>`. Os outros slots vão em `equipados`.
- `visualDe(db, usuarioIds[]): Map<id, VisualJogador>` com `{ verso, roupa, moldura }` (ids de item; padrão = grátis).

**Testes:**
- comprar com Fichas e com Pila;
- saldo insuficiente não põe no inventário;
- comprar duas vezes;
- equipar sem ter;
- equipar e ler o visual;
- `null` volta ao grátis;
- **invariante:** comprar um item de Fichas nunca mexe no Pila, e vice-versa.

Commit: `feat(loja): comprar e equipar itens`.

### Task 5: Cacife na gravação da partida

**Files:**
- Modify: `apps/server/src/repo/partidas.ts` (`InicioPartida.cacife`; `iniciarPartida`, `terminarPartida`, `encerrarAbandonada(db, id, agora, { reembolsar })`, `encerrarOrfas` reembolsa); `apps/server/src/registroMesa.ts` (`InfoRegistro.cacife`, `desligar` reembolsa, `iniciou` devolve o cacife efetivo por callback `aoCacife(cacife, pote)` para a mesa mostrar)
- Test: `apps/server/test/loja-partidas.test.ts`

Regras dentro das transações já existentes:
- **Início:** humanos com conta são os pagantes. Se alguma dupla não tiver pagante, ou o pedido for 0, o efetivo é 0. Senão, lê os saldos (`carteiraDe` dentro do `tx`), calcula o efetivo, faz `movimentar(-efetivo, 'cacife', partidaId)` para cada um e grava `cacife` e `pote`.
- **Fim:** se `pote > 0`, vencedora não nula e não abandonada, os vencedores são os pagantes da dupla vencedora que não abandonaram. Ranqueada e anti-fazenda: conta as partidas ranqueadas terminadas nas últimas 24h com o mesmo conjunto de usuários (participações). Se forem `>= 5`, reembolsa cada pagante que ficou (`estorno_partida`). Senão, `dividirPote` → `movimentar(+, 'premio', partidaId)`. Sem vencedores presentes, o pote some (fica registrado como `pote` na partida).
- **`encerrarAbandonada` com `reembolsar: true`** (desligamento) e **`encerrarOrfas`:** devolve o cacife a todos os pagantes, inclusive a quem abandonou, já que foi culpa do servidor. Sem `reembolsar` (todos saíram), o pote some.

**Testes (PGlite):**
- 1×1 com cacife 100: o vencedor fica com +100 líquido e o perdedor com −100;
- 2×2: cada vencedor +100;
- saldo baixo limita o efetivo;
- um lado só com bots dá efetivo 0;
- quem abandona perde e o parceiro que ficou recebe o pote inteiro da dupla;
- todos saíram: o pote some;
- órfã reembolsa;
- a 6ª ranqueada seguida entre os mesmos jogadores reembolsa;
- terminar duas vezes não paga duas vezes.

Commit: `feat(loja): cacife debitado no início e pote pago no fim da partida`.

### Task 6: Cacife e visual na mesa (protocolo, Mesa, MesaRoom, FilaRoom)

**Files:**
- Modify: `apps/server/src/mesa/protocolo.ts`:
  - `OpcoesSala.cacife` e `FiltroSala.cacife`;
  - `InfoCadeira.visual?: VisualJogador`;
  - `MsgEstado.cacife?: { pedido, efetivo, pote } | null` e `MsgEstado.baralhoDe?: Cadeira | null` (quem dá as cartas: `visao` já traz o pé; usar o pé da mão);
  - ranqueada aceita o cacife vindo da fila.
- Modify: `apps/server/src/mesa/Mesa.ts`: `sentar(..., visual?)` guarda o visual por cadeira; `definirCacife(efetivo, pote)`; `estadoPara` inclui ambos.
- Modify: `apps/server/src/MesaRoom.ts`:
  - `onJoin` vira `async`;
  - mesa com cacife > 0 exige conta ("entre na sua conta para jogar valendo Fichas") e saldo ≥ cacife ("você precisa de N Fichas");
  - lê o visual com `visualDe`;
  - `RegistroMesa` recebe o cacife e devolve o efetivo para a mesa.
- Modify: `apps/server/src/FilaRoom.ts`: `criarMesa` calcula `cacifeDaRanqueada(pontos)`, lendo `ratingDe` de cada um, e manda `cacife` nas opções internas. O cacife fica fora do `filterBy` da ranqueada, porque ela é criada direto.
- Modify: `apps/server/src/salas.ts`: `SalaAberta.cacife`.
- Test: `apps/server/test/mesa-cacife.test.ts` (padrão de `mesaroom-auth.test.ts` e `integracao.test.ts`): convidado recusado, saldo baixo recusado, estado com `cacife`, visual equipado chega para o outro jogador, `joinOrCreate` não mistura mesas de cacifes diferentes. Atualizar `protocolo.test.ts` (filtro com cacife).

Commit: `feat(loja): mesas com cacife e visual dos jogadores no estado`.

### Task 7: Gateway InfinitePay

**Files:** Create `apps/server/src/pagamento/infinitepay.ts`; Test `apps/server/test/infinitepay.test.ts`

```ts
export interface GatewayPagamento {
  criarLink(p: { orderNsu: string; descricao: string; centavos: number; redirectUrl: string; webhookUrl: string; cliente?: { nome?: string; email?: string } }): Promise<{ url: string }>;
  verificar(p: { orderNsu: string; transactionNsu: string; slug: string }): Promise<{ pago: boolean; centavos: number; metodo: string | null }>;
}
export function gatewayInfinitePay(o: { handle: string; apiKey?: string | null; f?: typeof fetch; timeoutMs?: number }): GatewayPagamento
```

- `POST https://api.checkout.infinitepay.io/links`, com o corpo `{ handle, items: [{ quantity: 1, price, description }], order_nsu, redirect_url, webhook_url, customer? }` e o header `X-Api-Key` se houver. A URL vem de `json.url` (ou `json.link`); se nenhum vier, lança erro com o status.
- `POST https://api.checkout.infinitepay.io/payment_check` com `{ handle, order_nsu, transaction_nsu, slug }` devolve `{ pago: success && paid, centavos: amount, metodo: capture_method }`.
- `AbortSignal.timeout(5000)`. Erros sem dados do cliente.

**Testes** (com `fetch` falso): corpo e headers corretos, sem API key, resposta sem url, `paid:false`, timeout.

Commit: `feat(loja): cliente do checkout da InfinitePay`.

### Task 8: Pedidos e confirmação idempotente

**Files:** Create `apps/server/src/repo/pedidos.ts`; Test `apps/server/test/repo-pedidos.test.ts`

- `criarPedido(db, usuarioId, pacoteId, agora)` → pedido (`id = randomUUID()`), ou `'limite'` se houver 5 ou mais pedidos na última hora.
- `anexarCheckout(db, id, url)`.
- `confirmarPedido(db, gateway, { orderNsu, transactionNsu, slug }, agora)` → `'pago' | 'ja-pago' | 'nao-pago' | 'desconhecido'`:
  1. carrega o pedido; se não existir, `desconhecido`; se já estiver pago, `ja-pago`;
  2. chama `gateway.verificar`; se `!pago` ou `centavos < valor`, `nao-pago`;
  3. em transação: `update pedidos set status='pago', slug, transaction_nsu, capture_method, pago_em where id and status='criado' returning`. Sem linha, `ja-pago`. Senão, `movimentar(+pila, 'compra_pila', id)`. Violação de unique em `transaction_nsu` (outro pedido) vira `nao-pago` e é logada.
- `pedidoDe(db, id, usuarioId)` e `pedidosAdmin(db, limite)`.

**Testes:**
- paga uma vez;
- duas confirmações concorrentes creditam uma vez;
- `paid:false` não credita;
- valor menor não credita;
- pedido inexistente;
- limite de 5 por hora.

Commit: `feat(loja): pedidos de Pila com confirmação idempotente`.

### Task 9: Rotas HTTP da loja, webhook, retorno e admin

**Files:**
- Create: `apps/server/src/http/loja.ts` (`rotasLoja(api, app, s, usuarioDe, admin)`).
- Modify: `apps/server/src/http/app.ts` (montar as rotas; o webhook entra antes do filtro de JSON, porque a InfinitePay manda `application/json`, mas sem preflight); `apps/server/src/servicos.ts` (`pagamento: { gateway: GatewayPagamento; ativo: boolean } | null`; env `LOJA_PAGAMENTO`, `INFINITEPAY_HANDLE`, `INFINITEPAY_API_KEY`; aviso se `on` sem handle); `apps/server/src/api/tipos.ts` (tipos `CatalogoApi`, `CarteiraApi`, `ItemLojaApi`, `PacoteApi`, `PedidoApi`, `LancamentoApi`, `VisualJogador`; `SalaAberta.cacife`).
- Rotas:
  - `GET /api/loja/catalogo`;
  - `GET /api/loja/eu`;
  - `POST /api/loja/comprar-item`;
  - `PUT /api/loja/equipar`;
  - `POST /api/loja/pedidos` (503 se desligado; 429 no limite; 502 se o gateway falhar);
  - `GET /api/loja/pedidos/:id`;
  - `POST /api/loja/webhook/infinitepay` (limite de 60 por minuto por IP; sempre responde 200 para pedido desconhecido; 400 se faltarem campos; 500 se o `payment_check` falhar, para a InfinitePay tentar de novo);
  - `GET /loja/retorno` (fora de `/api`: lê `order_nsu`, `slug` e `transaction_nsu`, chama `confirmarPedido` sem esperar mais que 5 s e redireciona com 302 para `/#/loja/obrigado?pedido=<id>`);
  - `GET /api/admin/pedidos`;
  - `POST /api/admin/usuarios/:id/ajuste` (`{ moeda, delta, motivo }`).
- Conta banida: `usuarioDaSessao` já recusa.
- Test: `apps/server/test/http-loja.test.ts`, com o gateway falso injetado por `servicosDeTeste(db, { pagamento: … })`.

Commit: `feat(loja): rotas da loja, webhook e retorno do checkout`.

### Task 10: Web — cliente da API e lógica da loja

**Files:**
- Modify: `apps/web/src/rede/api.ts` (`loja.catalogo`, `loja.eu`, `loja.comprarItem`, `loja.equipar`, `loja.criarPedido`, `loja.pedido`; `admin.pedidos`, `admin.ajuste`).
- Modify: `apps/web/src/logica/rotas.ts` (`{ tela: 'loja'; aba }`, `{ tela: 'lojaObrigado'; pedido }`).
- Create: `apps/web/src/logica/loja.ts` (`formatarReais`, `formatarSaldo`, `rotuloPreco`, `estadoDoItem(item, inventario, equipados, saldos)` → `'equipado' | 'equipar' | 'comprar' | 'sem-saldo'`).
- Test: `apps/web/src/logica/loja.test.ts` e `rotas.test.ts` (rotas novas, ida e volta).

Commit: `feat(web): API e lógica da loja`.

### Task 11: Web — visuais equipáveis

**Files:**
- Create: `apps/web/src/logica/visuais.ts`, que traduz o id do item em parâmetros a partir de uma tabela espelho do `visual` do catálogo. O catálogo do servidor manda o `visual`; a web guarda um cache dele ao carregar `/api/loja/catalogo` e usa padrões quando ainda não carregou.
- Modify:
  - `CartaVisual.tsx` e `Monte.tsx`: o verso usa as variáveis CSS `--verso-cor`, `--verso-linha` e `data-estampa`, definidas no contêiner da mesa (`telas/Mesa.tsx`) a partir do `visual.verso` de `baralhoDe`;
  - `estilos.css`: estampas `losango` (atual), `listra`, `azulejo`, `chita`, `cartola`, só com gradientes CSS, sem imagens novas;
  - `Personagem.tsx`: prop `roupa?: Partial<Tipo>` mesclada sobre `TIPOS[tipo]`;
  - `Tampo.tsx`: passa a `roupa` da cadeira;
  - `mesa3d/texturas.ts` e `cena.ts`: cor do verso e da camisa vindas do visual (mesma tabela);
  - `Avatar.tsx`: prop `moldura?: string` com a classe `moldura-<estilo>`, e suporte a `loja:<id>`, com desenhos SVG de 2 avatares exclusivos no mesmo estilo dos prontos;
  - `logica/aparenciaMesa.ts`: tipos `marmore` e `formica`, e `aparenciaPermitida` passa a receber o inventário;
  - `SeletorAparenciaMesa.tsx` mostra só o que o usuário tem; CSS dos tampos novos em `estilos-mesa-fisica.css`.
- Tests: `apps/web/src/logica/visuais.test.ts` e `aparenciaMesa` (teste existente atualizado).

Commit: `feat(web): verso, roupa, moldura, avatar e tampo equipáveis`.

### Task 12: Web — tela da loja, saldo, cacife na mesa

**Files:**
- Create:
  - `apps/web/src/telas/Loja.tsx`: saldos; abas por slot e por "Pila" (pacotes); cartões com prévia usando os componentes reais; termos da loja num `<details>`; estado "em breve" quando `pagamentoAtivo` for false; confirmação antes de gastar;
  - `apps/web/src/telas/LojaObrigado.tsx`: consulta `GET /api/loja/pedidos/:id` a cada 2 s, por até 30 s;
  - `apps/web/src/loja.css`, importado em `main.tsx`.
- Modify:
  - `App.tsx`: rotas e toast do bônus diário;
  - `Cabecalho.tsx`: saldo e link da loja;
  - `telas/Lobby.tsx` ou o formulário de criar mesa: seletor de cacife, só para quem tem conta;
  - `telas/Salas.tsx`: mostra o cacife;
  - `telas/SalaEspera.tsx`, `Placar.tsx` e `Overlays.tsx`: pote e "+N/−N Fichas" no fim;
  - `rede/conexao.ts`: manda `cacife` nas opções.
- Respeitar `AGENTS.md`: tokens de `estilos.css`, identidade de boteco, toque de 44 px, teclado e foco visível.

Commit: `feat(web): loja, saldo no cabeçalho e cacife nas mesas`.

### Task 13: E2E e responsividade

**Files:** Create `apps/web/e2e/loja.spec.ts`; reaproveitar `e2e/apoio.ts` (login de teste).
- O jogador entra, abre `#/loja`, compra "Giz de Lousa" com Fichas (saldo inicial de 1.000 não basta) e vê o botão desabilitado. Ajusta o saldo pelo admin no teste (rota de admin com `ADMIN_EMAILS` do E2E), compra, equipa e vê a moldura no cabeçalho ou no perfil.
- Dois humanos numa mesa privada com cacife 100 jogam até o fim (com os tempos curtos do E2E) e os saldos mudam ±100. Se a partida inteira for lenta demais, usar o atalho de teste que já existe em `dois-humanos.spec.ts`.
- A loja em 320×568, 360×640, 360×740, 390×844, 430×932 e 1280×800, sem rolagem horizontal.

Run: `pnpm --filter @truco/web exec playwright test e2e/loja.spec.ts`, depois `pnpm test:e2e` completo.

Commit: `test(e2e): loja e mesa com cacife`.

### Task 14: Documentação e checkpoint

- `docs/deploy-railway.md`: variáveis `LOJA_PAGAMENTO`, `INFINITEPAY_HANDLE` e `INFINITEPAY_API_KEY`; a URL do webhook é montada a partir de `TRUCO_URL_PUBLICA`.
- `PROXIMOS_PASSOS.md`: estado e pendências (advogado, InfinitePay por escrito, teste real de R$ 4,90).
- Commit: `docs(loja): deploy e próximos passos`.
