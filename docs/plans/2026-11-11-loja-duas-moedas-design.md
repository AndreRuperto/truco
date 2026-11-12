# Loja com duas moedas (Fichas e Pila) — design

**Data:** 11/11/2026 · **Base legal:** [`docs/legal/modo-apostado-2026-11.md`](../legal/modo-apostado-2026-11.md)
**Estado:** design para aprovação; nada implementado.

## 1. Objetivo e regra de ouro

Dar ao jogador:
- **recompensa e emoção na partida**, com Fichas apostadas em mesas com cacife;
- **personalização paga**, com Pila comprado em reais e usado em itens de visual.

O dinheiro real **nunca** entra na partida.

| | **Fichas** (moeda do jogo) | **Pila** (moeda comprada) |
|---|---|---|
| Como se ganha | Bônus de cadastro, bônus diário, resgate quando o saldo zera, vencer mesa com cacife | Só comprando pacote na InfinitePay |
| Uso | Cacife de mesas (casual, privada, ranqueada); itens "de Fichas" que não estão à venda | Só itens da loja |
| Pode apostar | Sim | **Não** |
| Vendida | **Nunca** (nem de brinde em compra) | Pela plataforma |
| Transferência entre jogadores | Só pelo resultado da partida | **Não** |
| Saque ou conversão | **Não** | **Não** |
| Troca Fichas ↔ Pila | **Não existe** | **Não existe** |

Invariantes que o código e os testes garantem:
1. Nenhuma função credita Fichas a partir de Pila, nem o contrário.
2. Pila só aumenta por um pedido pago e confirmado na InfinitePay (ou por ajuste manual de admin, registrado no extrato).
3. Todo movimento de saldo gera uma linha no extrato (`lancamentos`). O saldo é o cache dessa soma, e os dois nunca ficam negativos (`CHECK >= 0`).
4. Mesa com cacife só tem humanos logados. Um bot nunca recebe nem paga Fichas.

## 2. Valores iniciais (constantes em `apps/server/src/loja/regras.ts`)

**Fichas**
- Cadastro: **1.000**, uma única vez, inclusive para contas que já existem, no primeiro acesso depois do deploy.
- Bônus diário: **+100** no primeiro acesso do dia (fuso America/Sao_Paulo).
- Resgate: se o saldo estiver **abaixo de 100** no bônus diário, o saldo vai para **500** em vez de somar 100. Uma vez por dia.
- Cacife de mesa casual ou privada: o dono escolhe **0 (sem cacife), 50, 100, 250, 500 ou 1.000**.
- Cacife da ranqueada, por patente (a do jogador com patente mais alta na mesa):

| Bronze | Prata | Ouro | Diamante | Mestre | Grão-Mestre |
|---|---|---|---|---|---|
| 50 | 100 | 200 | 400 | 800 | 1.500 |

- **Cacife efetivo** = menor valor entre o cacife pedido e o **menor saldo** dos humanos da partida, calculado na transação que inicia a partida. Assim, todo mundo arrisca o mesmo valor, a fila da ranqueada não trava quem está sem saldo e o cacife não falha se o saldo mudar entre a entrada na mesa e o início.

**Pila** (pacotes; preço em centavos para a API da InfinitePay)

| Pacote | Preço | Pila |
|---|---|---|
| Punhado | R$ 4,90 | 100 |
| Bolso | R$ 9,90 | 220 |
| Carteira | R$ 24,90 | 600 |
| Cofre | R$ 49,90 | 1.300 |

Itens de Pila custam de 80 a 400. Itens de Fichas custam de 3.000 a 10.000.

## 3. Pote, abandono e casos de borda

| Situação | O que acontece com as Fichas |
|---|---|
| Início da partida | Cada humano é debitado do cacife efetivo (`motivo = cacife`) e a partida guarda `cacife` e `pote`. |
| Fim normal | O pote é dividido entre os humanos da dupla vencedora que ficaram até o fim (`premio`). Em 2×2, cada um leva metade; o resto da divisão, se houver, vai para a cadeira mais baixa. |
| Abandono | Quem sai perde o cacife, que fica no pote. Ninguém é reembolsado. |
| Dupla vencedora toda saiu (sobraram só bots) | Partida `abandonada`: o pote **some** (sai da economia) e ninguém recebe. |
| Partida órfã (servidor caiu, `encerrarOrfas`) | **Reembolso** integral de todos (`estorno_partida`). |
| Cacife efetivo 0 (alguém com saldo 0) | A partida segue sem cacife, e a tela avisa. |

**Contra conluio:** as Fichas não têm valor em dinheiro, então o risco é só de "fazenda" de Fichas para itens de Fichas e de inflar o próprio saldo. A mitigação na v1 tem duas regras:
1. Na ranqueada, o prêmio de Fichas entre os **mesmos dois usuários** (ou as mesmas duplas) para de valer depois da 5ª partida em 24h: o pote volta para cada um.
2. A decisão SEC-03 do relatório de segurança continua valendo para o Elo.

## 4. Catálogo v1 (16 itens, dados em `apps/server/src/loja/catalogo.ts`)

| Categoria (slot) | Onde aparece | Quem vê | Itens |
|---|---|---|---|
| `verso` (verso do baralho) | Cartas viradas, monte, 2D e 3D | **Todos**: o baralho da mão é o de **quem dá as cartas** | Clássico (grátis), Vermelho Boteco (Pila 120), Azulejo (Pila 200), Chita (Pila 300), Cartola de Ouro (Fichas 6.000) |
| `roupa` (camisa, estampa, chapéu do personagem) | Visões personagens e 3D, na sua cadeira | Todos | Padrão da cadeira (grátis), Camisa do Time (Pila 150), Caipira de Festa (Pila 250), Terno de Domingo (Pila 400), Chapéu do Campeão (Fichas 10.000) |
| `moldura` (em volta do avatar) | Lobby, assento, placar, ranking, perfil | Todos | Nenhuma (grátis), Corda (Pila 80), Madeira Entalhada (Pila 150), Neon de Bar (Pila 250), Giz de Lousa (Fichas 3.000) |
| `avatar` | Junto com os avatares prontos | Todos | 2 avatares exclusivos (Pila 120 cada) |
| `tampo` (mesa) | Sua tela | **Só você** (como hoje) | Madeira, Feltro, Plástico (grátis, como hoje); Mármore de Bar (Pila 200), Fórmica Anos 70 (Pila 150) |

Cada item tem `id` estável, `slot`, `nome`, `preco: { moeda, valor }` e `visual` (parâmetros que os componentes existentes já usam: cores do verso, paleta do `Personagem`, cor e estilo da moldura, textura do tampo). Item grátis vem de série e não precisa estar no inventário.

## 5. Arquitetura

### 5.1 Banco (migração `0005_loja.sql`, Drizzle)

- `carteiras(usuario_id PK→usuarios, fichas int ≥0, pila int ≥0, bonus_cadastro bool, ultimo_diario date)`
- `lancamentos(id serial, usuario_id, moeda 'fichas'|'pila', delta int, saldo_depois int, motivo enum, ref text, criado_em)`
  - `motivo`: `cadastro`, `diario`, `resgate`, `cacife`, `premio`, `estorno_partida`, `compra_item`, `compra_pila`, `estorno_pila`, `ajuste_admin`
  - índice (usuario_id, criado_em)
- `inventario(usuario_id, item_id, adquirido_em)`, PK (usuario_id, item_id)
- `usuarios.equipados jsonb` (`{ verso?, roupa?, moldura?, tampo? }`); o avatar continua em `usuarios.avatar`
- `pedidos(id uuid PK = order_nsu, usuario_id, pacote_id, valor_centavos, pila, status 'criado'|'pago'|'estornado'|'expirado', checkout_url, slug, transaction_nsu UNIQUE, capture_method, pago_em, criado_em)`
- `partidas` ganha `cacife int default 0` e `pote int default 0`

Todo débito e crédito passa por uma única função, `movimentar(tx, usuarioId, moeda, delta, motivo, ref)`. Ela faz `UPDATE carteiras … WHERE saldo + delta >= 0 RETURNING` e grava o lançamento. Se o saldo não cobrir, lança `SaldoInsuficiente`. Não existe outra escrita em `carteiras`.

### 5.2 API (Express, `apps/server/src/http/loja.ts`)

| Rota | Quem | O que faz |
|---|---|---|
| `GET /api/loja/catalogo` | Público | Itens e pacotes. Inclui `pagamentoAtivo: boolean`. |
| `GET /api/loja/eu` | Logado | Saldos, inventário, equipados e últimos 30 lançamentos. Aplica cadastro, diário e resgate pendentes. |
| `POST /api/loja/comprar-item` `{itemId}` | Logado | Debita a moeda do item e põe no inventário, numa transação. Item repetido devolve 409. |
| `PUT /api/loja/equipar` `{slot, itemId \| null}` | Logado | Só item grátis ou do inventário. |
| `POST /api/loja/pedidos` `{pacoteId}` | Logado + pagamento ativo | Cria o pedido, chama `POST https://api.checkout.infinitepay.io/links` (com `order_nsu`, `redirect_url`, webhook e e-mail ou apelido do cliente) e devolve a `url`. Limite: 5 pedidos por hora por usuário. |
| `POST /api/loja/pedidos/:id/confirmar` `{slug, transaction_nsu}` | Dono do pedido | Usado na volta do redirect. Verifica pelo `payment_check`. |
| `POST /api/loja/webhook/infinitepay` | InfinitePay | Lê `order_nsu`, `invoice_slug` e `transaction_nsu` e verifica pelo `payment_check`. Responde 200 rápido (400 se o corpo for inválido). |
| `GET /api/admin/pedidos`, `POST /api/admin/usuarios/:id/ajuste` | Admin | Lista os pedidos; ajuste manual com motivo (para estorno feito no app da InfinitePay). |

**Confirmação do pagamento (o mesmo caminho para webhook e redirect):**
1. Carrega o pedido pelo `order_nsu`. Se não existir, ou se já estiver `pago`, devolve 200 sem fazer nada (idempotente).
2. Chama `POST /payment_check` com `{handle, order_nsu, transaction_nsu, slug}`. O webhook não tem assinatura, por isso **o corpo do webhook nunca é tomado como verdade**.
3. Se `paid === true` e `amount >= valor_centavos`, faz numa transação: `UPDATE pedidos SET status='pago' … WHERE id=$1 AND status='criado' RETURNING` e, se essa linha voltar, credita o Pila (`compra_pila`, ref = id do pedido). O `UNIQUE(transaction_nsu)` impede crédito duplo.
4. Cliente HTTP da InfinitePay atrás de uma interface (`GatewayPagamento`), com dublê nos testes, timeout de 5 s e sem log de chave nem de dados do cliente.

**Configuração (variáveis no Railway):**
- `LOJA_PAGAMENTO=on` liga a compra de Pila. Sem ela, os pacotes aparecem como "em breve" e `POST /pedidos` devolve 503.
- `INFINITEPAY_HANDLE`, `INFINITEPAY_API_KEY` (opcional, `X-Api-Key`) e `URL_PUBLICA` (já existe), usada para montar `redirect_url` e `webhook_url`.
- A CSP não muda: o checkout abre na página da InfinitePay (navegação, não iframe).

### 5.3 Mesa e fila (servidor Colyseus)

- `MesaRoom.onCreate`: opção nova `cacife`, validada contra a lista. Se o cacife for maior que 0, a mesa **exige conta** de todos, **não aceita bot** (`humanos` precisa encher a mesa) e mostra o cacife na lista de salas e no lobby.
- Entrar numa mesa com cacife exige saldo maior ou igual ao cacife. Senão, o erro é: "Você precisa de N Fichas para esta mesa".
- `FilaRoom` / ranqueada: na formação da partida, o cacife vem da patente mais alta. A fila não filtra por saldo (vale o cacife efetivo).
- `RegistroMesa` / `repo/partidas.ts`:
  - `iniciarPartida` calcula o cacife efetivo e debita, na mesma transação;
  - `terminarPartida` paga o prêmio;
  - `registrarAbandono` não reembolsa;
  - `encerrarAbandonada` faz o pote sumir;
  - `encerrarOrfas` reembolsa.
- Protocolo (`MsgEstado`): cada assento ganha `visual?: { verso, roupa, moldura }`, e a mesa ganha `cacife`, `pote` e `baralhoDe` (cadeira de quem dá as cartas). O `visual` vem do servidor (equipados lidos ao entrar), não do cliente.

### 5.4 Web (React)

- Tela nova **Loja** (rota `/loja`), no estilo de boteco (lousa e giz). Tem saldos no topo, abas por categoria, cartão de item com prévia ao vivo usando os componentes reais (`CartaVisual` virada, `Personagem`, `Avatar` com moldura, `Tampo`) e botões "Comprar por N Pila", "Comprar por N Fichas" e "Equipar".
- **Pacotes de Pila**: o botão abre o checkout da InfinitePay. A página de volta `/loja/obrigado` lê `order_nsu`, `slug` e `transaction_nsu`, chama `confirmar` e mostra o resultado, ou "aguardando confirmação" com nova tentativa.
- Saldo de Fichas e Pila no `Cabecalho`. Aviso do bônus diário com toast.
- Criar mesa: seletor de cacife. O lobby e o placar mostram o pote. No fim da partida: "+N Fichas" ou "−N Fichas".
- Componentes que passam a respeitar o `visual` do assento: verso nas cartas viradas e no monte (2D e `mesa3d/cartas.ts`), roupa no `Personagem` e em `mesa3d/personagens.ts`, moldura no `Avatar`. O tampo continua local (`aparenciaMesa.ts`), mas só lista o que o usuário tem.
- **Termos da loja** (texto visível antes de comprar): Pila não tem valor de resgate nem de troca e não pode ser transferido; não há saque; arrependimento em 7 dias para Pila não usado (CDC, art. 49); contato. Marcado como **rascunho para revisão do advogado**.

## 6. Erros e segurança

- Toda regra roda no servidor: o cliente só pede. Preços vêm do catálogo do servidor, nunca do corpo da requisição.
- Transações com `CHECK` no banco e `UPDATE … WHERE saldo + delta >= 0`, para dois cliques ou duas abas não gastarem duas vezes.
- Webhook: sem confiança no corpo; limite por IP; tamanho máximo de 16 KB; responde 200 em caso de pedido desconhecido (não revela se existe).
- Conta banida: rotas da loja recusadas; Fichas e Pila congelados.
- Logs: id do pedido e estado, sem e-mail, chave ou URL de comprovante.

## 7. Testes

- **Servidor (vitest, com Postgres de teste como hoje):**
  - `movimentar` e saldo nunca negativo; concorrência (duas compras ao mesmo tempo);
  - cadastro, diário e resgate, inclusive na virada do dia;
  - comprar e equipar, item repetido, item de outra moeda;
  - pedido, confirmação idempotente (webhook e redirect juntos, webhook repetido, `paid:false`, valor menor), com `GatewayPagamento` falso;
  - cacife efetivo, prêmio em 1×1 e 2×2, abandono, abandonada, órfã, mesa com cacife recusando bot, convidado e saldo baixo; limite anti-fazenda;
  - **teste de invariante**: nenhuma rota transforma Fichas em Pila nem o contrário.
- **Web (vitest):** lógica da loja e formatação de saldo.
- **E2E (Playwright):** abrir a loja, comprar e equipar um verso com Fichas de teste e ver o verso na mesa; mesa com cacife entre dois humanos (base no `dois-humanos.spec.ts`); responsividade da loja em 320×568 até 430×932 e desktop, conforme o `AGENTS.md`.
- **Real (manual):** uma compra de R$ 4,90 e o estorno pelo app da InfinitePay, com `LOJA_PAGAMENTO=on` só no fim.

## 8. Fora da v1 (YAGNI)

Caixas-surpresa, temporadas e passe, presentear itens, ranking de Fichas, compra pelo app nativo (App Store e Google Play), cupons, cartão salvo.

## 9. Antes de ligar a cobrança

- [ ] Advogado revisa o modelo e os Termos da loja (inclusive Fichas apostadas na ranqueada e a regra das caixas para menores no ECA Digital).
- [ ] InfinitePay confirma por escrito que aceita a venda de moeda virtual de jogo.
- [ ] Contador: emissão de nota e tributos sobre a venda de Pila.
- [ ] Teste real de R$ 4,90 com estorno.
