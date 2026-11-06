# Truco Online — Design

Data: 2026-11-05
Referência: https://bisca.live (Bisca Capixaba online, duplas 2x2, bots, mesas casual/desafio/ranqueada com Elo)

Objetivo: clone completo no estilo do bisca.live para **Truco Paulista** e **Truco Mineiro** — multiplayer em tempo real, bots nos lugares vagos, contas, ranking Elo com patentes.

---

## 1. Regras (engine)

### Base comum
- 4 jogadores, duplas 2x2 (parceiro à frente). 3 cartas por jogador, melhor de 3 rodadas.
- Baralho limpo: 40 cartas (sem 8, 9, 10). Força das comuns: `4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3`.
- Empate de rodada ("cangou"): quem ganhou a 1ª leva. Se a 1ª empatou, leva quem ganhar a seguinte. Todas empatadas: ninguém pontua.
- Pedidos: truco → aceitar / correr / aumentar. Só a dupla que **não** fez o último pedido pode aumentar. Correr dá à outra dupla o valor vigente antes do pedido.
- Carta coberta (virada) permitida a partir da 2ª rodada; vale como a carta mais fraca.
- Partida até 12 pontos.

### Variantes de manilha
- **Paulista**: vira. A manilha é a carta seguinte à vira (após o 3 volta pro 4). Ordem de naipe entre manilhas: ♣ > ♥ > ♠ > ♦.
- **Mineiro**: manilhas fixas, sem vira: Zap 4♣ > 7♥ > Espadilha A♠ > 7♦.

### Opções de mesa (`RegrasMesa`)
| Opção | Valores |
|---|---|
| `variante` | `paulista` \| `mineiro` |
| `pontuacao` | `1-3-6-9-12` \| `2-4-8-10-12` (independente da variante) |
| `maoDe10` | on/off |
| `maoDe11` | on/off (`qualquerDupla` \| `onzeAOnze`) |
| `familia` | `off` \| `aberta` \| `fechada` |
| `sinaisInterceptaveis` | chance (0–1) de adversário ver o sinal |

Presets de pontuação:

| Preset | Mão | Truco | Seis | Nove | Doze |
|---|---|---|---|---|---|
| 1-3-6-9-12 | 1 | 3 | 6 | 9 | 12 |
| 2-4-8-10-12 | 2 | 4 | 8 | 10 | 12 |

### Mão de 10
A dupla com 10 pontos vê as cartas do parceiro e decide **jogar** (vale o valor de truco do preset) ou **correr** (adversário ganha o valor base da mão). Não há pedido de truco nessa mão.

### Mão de 11 (mão de ferro)
Ativa quando uma dupla chega a 11 (padrão: qualquer dupla). Todos recebem as cartas viradas, ninguém olha; cada jogador tira uma carta do próprio monte às cegas e joga. Sem truco.

### Família
Mão com 3 cartas só de {Q, J, K, A}, qualquer combinação — inclusive com o A♠ (espadilha no mineiro), se o jogador quiser abrir mão dele.
Detalhes em `2026-11-05-ritual-da-mao-design.md`. Não há mais redistribuição: quem pede deixa as 3 cartas na mesa e recebe 3 do topo do monte (sem 3 cartas no monte, não pode pedir).
- **Fechada**: as 3 ficam viradas e pode ser **blefe**. A dupla adversária pode conferir: família real → a dupla de quem pediu ganha o valor base; blefe → a adversária ganha; ninguém conferiu → ninguém pontua.
- **Aberta**: mostra as 3 cartas, precisa ser família real e não pontua.
- Limite: até 3 fechadas por mão, contando o "abrir 3" do corte; depois disso a família da mesa fechada sai aberta.
- Janela: antes da 1ª carta da mão, em mão normal (bloqueada na mão de 10 e na de ferro). Pontos de família podem encerrar a partida.

---

## 2. Arquitetura

Monorepo TypeScript (pnpm workspaces):

- **`packages/engine`** — regras puras, sem I/O. Máquina de estados `reduce(estado, acao) → estado`. Ações: `monte` (só do servidor: o monte inicial), `embaralhar`, `passarCorte`, `cortar`, `abrir3`, `dar3`, `devolver`, `distribuir{modo}`, `conferir`, `jogarCarta`, `jogarCoberta`, `pedirTruco`, `aceitar`, `correr`, `aumentar`, `pedirFamilia`, `decidirMao10`. Inclui os bots. Função `visaoDoJogador(estado, cadeira)` gera o estado filtrado (sem cartas alheias).
- **`apps/server`** — Node + Colyseus. Servidor autoritativo: sorteia o monte inicial e a sorte de cada riffle e corte (CSPRNG), valida ações e envia a cada cliente só a própria visão. Bots ocupam cadeiras vagas e cadeiras de quem caiu. Postgres + Drizzle (contas, partidas, Elo). Auth: link mágico por e-mail + Google.
- **`apps/web`** — React + Vite, mesa em DOM/CSS + Framer Motion. Mobile-first.

### Mesas
| Mesa | Descrição |
|---|---|
| Clássica | casual, bots fáceis, regras livres |
| Desafio | bots difíceis |
| Ranqueada | regras fixas por variante, Elo |
| Privada | link de convite, todas as opções configuráveis, chat de texto |

### Deploy — Railway
- Serviço `server` (Colyseus + entrega do build estático do `web`).
- Postgres gerenciado do Railway.
- Deploy via GitHub, variáveis de ambiente no Railway, domínio próprio apontando pro `server`.

---

## 3. Fluxo da mão, UI e bots

### Fluxo
1. Ritual da mão sobre um **monte físico persistente** (as cartas da mão anterior voltam por cima; só a 1ª mão da partida recebe um monte sorteado pelo servidor): o pé embaralha (riffle com a sorte do servidor) quantas vezes quiser e passa; o da esquerda corta — cortar, embaralhar, abrir 3 ou dar 3 (3 movimentos) — ou devolve; o pé distribui num dos 3 modos — por cima, por baixo ou subindo alternado (a vira, no paulista, sai na mesma direção). Vale em todas as mesas, inclusive a ranqueada.
2. Janela de família (se ligada): fechada (pode ser blefe; a dupla adversária confere) ou aberta, até 3 fechadas por mão.
3. Na vez: jogar aberta, jogar coberta (2ª rodada+) ou pedir truco/aumento.
4. Truco pausa a mão; a dupla adversária responde (vale a 1ª resposta de qualquer um dos dois).
5. Fim da mão: placar animado → checa mão de 10 / mão de 11 / fim de partida.

Timer de 20 s por jogada (e um prazo por etapa do ritual). Estourou: joga a carta mais fraca (ou corre se houver truco pendente); no ritual, embaralha até 3 vezes e passa, corta normal e dá por cima; na família fechada, não confere. Desconexão: bot assume até reconectar.

### UI
- Mesa vista de cima: você embaixo, parceiro à frente, adversários nas laterais.
- Arrastar ou clicar para jogar.
- **Sinais**: piscar = zap, sobrancelha = copas, boca torta = espadilha, etc. Emote visível ao parceiro; adversário pode interceptar (configurável).
- Falas rápidas em balão ("TRUCO!", "Desce!"); chat de texto só em mesa privada.

### Bots
- **Fácil**: heurística simples; aceita truco se tem manilha.
- **Difícil**: estima força por amostragem das mãos possíveis dos adversários; blefe com probabilidade calibrada; usa e lê sinais do parceiro bot.
- Bots mandam falas na mesa.

---

## 4. Contas, ranking e testes

### Contas
- Convidado (apelido): Clássica e Desafio.
- Logado: Ranqueada, histórico, amigos, perfil com patente e estatísticas por variante (vitórias, % truco aceito, corridas).

### Ranqueada
- Regras fixas:
  - Paulista: vira, 1-3-6-9-12, mão de 11 (ferro), sem família.
  - Mineiro: manilhas fixas, 2-4-8-10-12, mão de 10, família fechada.
- Elo separado por variante. Em duplas: média da dupla vs média da dupla; delta igual pros dois.
- Modos: 2x2 (4 humanos) e 1x1 (cada humano com bot parceiro; Elo só entre os humanos). Bot em 2x2 não pontua Elo.
- Patentes: Bronze, Prata (300), Ouro (600), Diamante (900), Mestre (1200), Grão-Mestre (1500).
- Abandono: perde Elo + 5 min de bloqueio de fila.

### Matchmaking
Fila por variante e modo, pareia por Elo, alarga a faixa a cada 15 s. Pode entrar em fila já em dupla com amigo.

### Testes
- **engine** — TDD com Vitest: manilhas (vira e fixas), cangou, sequência de truco nos dois presets, correr, família aberta/fechada, mão de 10, mão de 11. Property-based (fast-check): milhares de partidas aleatórias — nenhum estado inválido, placar final ≥ 12, cartas nunca duplicadas.
- **server** — integração com clientes Colyseus simulados: nenhum cliente recebe cartas alheias, reconexão, timeout.
- **web** — Playwright: partida completa contra bots.
