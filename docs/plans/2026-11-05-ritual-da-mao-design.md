# Ritual da mão — Design

> Embaralhar, cortar, distribuir e pedir família como numa mesa de boteco de verdade: o monte é físico e persiste entre as mãos, cada etapa tem dono, prazo e animação, e o servidor continua sendo a única fonte de aleatoriedade.

Fonte da verdade das regras: as 8 regras aprovadas pelo usuário (reproduzidas na seção 1). Onde elas deixavam espaço, a decisão tomada está marcada com **Decisão**.

Plano de implementação: `docs/plans/2026-11-05-plano-5-ritual.md`.

---

## 0. Como é hoje (código real)

- `packages/engine/src/estado.ts`: `Fase = 'aguardandoDistribuicao' | 'decisaoMao10' | 'jogando' | 'respondendoTruco' | 'fimPartida'`; `EstadoPartida { regras, placar, pe, fase, mao, ultimaMao, ultimaFamilia, vencedor }`; ação de servidor `{ tipo: 'distribuir'; baralho: Carta[] }`.
- `reducer.ts › distribuir`: dá 1 carta por vez, 3 voltas, começando em `(pe + 1) % 4`; vira (paulista) = `baralho[12]`; `vez = proximaCadeira(pe)`. O jogo anda `c → c + 1`, que na tela (`apps/web/src/logica/posicoes.ts`) é eu → **direita** → cima → esquerda (anti-horário).
- `finalizarMao`: soma pontos, guarda `ultimaMao`, `pe = proximaCadeira(pe)`, fase `aguardandoDistribuicao`. Cada mão nova recebe um baralho novo e sorteado (`Mesa.distribuir` → `embaralhar(baralhoDaMesa(regras), rand)`).
- `pedirFamilia`: só em `'jogando'`, mão `normal` (bloqueada na mão de 10 e na de ferro), antes da 1ª carta e com `nivel === 0`; exige família real (`ehFamilia`: 3 cartas só de Q/J/K/A); **anula a mão** (`mao = null`, mesmo pé) e o servidor redistribui. `ultimaFamilia` guarda quem pediu (cartas só na aberta).
- `Mesa` (`apps/server/src/mesa/Mesa.ts`): `aguardandoDistribuicao` → pausa `pausaMaoMs` → distribui; humanos têm prazo `jogadaMs`; bots agem após `botMs`; tempo esgotado → `jogadaAutomatica`. `rand` padrão = `Math.random`.
- Web: `TelaMesa` mostra o resumo de fim de mão enquanto `!mao && fase === 'aguardandoDistribuicao'`; `CentroMesa` só tem `data-testid="centro"` quando há mão ou `ultimaMao`.

## 1. Regras aprovadas

1. **Monte físico persistente** entre mãos. O estado guarda o baralho ordenado. No fim de cada mão as cartas são recolhidas em ordem determinística e postas **sobre** o resto do monte. Na primeira mão da partida o monte vem do servidor já sorteado (CSPRNG).
2. **Embaralhar** = um riffle Gilbert–Shannon–Reeds cujo aleatório vem do servidor dentro da ação. Quem embaralha e dá as cartas é o `pe`; embaralha quantas vezes quiser (limite técnico 20) e passa pra cortar.
3. **Cortar**: quem está à esquerda do embaralhador, `(pe + 3) % 4`. Tem 3 movimentos; cada riffle ou corte gasta 1. **Abrir 3** e **dar 3** gastam os 3 de uma vez. Pode devolver antes; acabando os movimentos, devolve sozinho.
4. **Distribuir**: o embaralhador escolhe **por cima**, **por baixo** ou **subindo alternado**. Ordem: de `(pe + 1) % 4` seguindo `c + 1`, pulando quem recebeu "dar 3". Paulista: a vira é a próxima carta na mesma direção do modo.
5. **Família** (se `regras.familia !== 'off'`), antes da 1ª carta: **fechada** (3 cartas viradas na mesa, recebe 3 do topo; a dupla adversária pode conferir; real → dupla de quem pediu ganha o valor base; blefe → adversária ganha; ninguém conferiu → ninguém pontua; máximo 3 fechadas por mão contando o "abrir 3") e **aberta** (mostra, precisa ser real, ninguém pontua). Sem 3 cartas no monte, não pode pedir. Continua bloqueada na mão de 10 e na de ferro. Pontos de família podem encerrar a partida.
6. Bots fazem todas as etapas; tempo esgotado → embaralha até 3 vezes e passa; corta normal; distribui por cima; não confere.
7. Ninguém vê a ordem do monte; todos veem tamanho, quem está com ele, contagens, abertas no corte, famílias (abertas, conferidas e o resultado) e as fechadas como 3 versos na frente de quem pediu.
8. Vale em todos os modos (inclusive ranqueada), com mão limpa (29 cartas) e coringa.

## 2. Engine

### 2.1 Estado

```ts
type Fase = 'aguardandoMonte' | 'embaralhando' | 'cortando' | 'escolhendoDistribuicao'
          | 'decisaoMao10' | 'jogando' | 'respondendoTruco' | 'conferindoFamilia' | 'fimPartida';
type ModoDistribuicao = 'porCima' | 'porBaixo' | 'subindo';

interface EstadoRitual {
  embaralhador: Cadeira;          // = pe
  cortador: Cadeira;              // (pe + 3) % 4
  embaralhadas: number;           // riffles do embaralhador (≤ 20)
  movimentos: number;             // gastos pelo cortador (0..3)
  abertas: Carta[];               // "abrir 3"
  dadas: { cadeira: Cadeira; cartas: Carta[] } | null; // "dar 3"
}

interface FamiliaPedida {
  cadeira: Cadeira;
  tipo: 'fechada' | 'aberta';
  cartas: Carta[];                                   // as 3 que foram para a mesa
  conferida: { por: Cadeira; real: boolean } | null;
}

EstadoPartida += { monte: Carta[] /* índice 0 = topo */, ritual: EstadoRitual | null }   // − ultimaFamilia
EstadoMao     += { modo, pulada: Cadeira | null, abertasNoCorte: Carta[], familias: FamiliaPedida[], familiaPendente: number | null }
ResultadoMao.motivo += 'familia'
```

`novaPartida` começa em `'aguardandoMonte'` com `monte: []`. **Decisão:** `aguardandoDistribuicao` deixa de existir (estados antigos não são migrados: a partida vive só na memória da sala).

### 2.2 Ações

| Ação | Quem | Fase | Efeito |
|---|---|---|---|
| `{ tipo: 'monte', baralho }` (**servidor**) | — | `aguardandoMonte` | valida contra `baralhoDaMesa(regras)`; cria o ritual; → `embaralhando` |
| `{ tipo: 'embaralhar', cadeira, bits? }` | embaralhador / cortador | `embaralhando` / `cortando` | riffle; no corte gasta 1 movimento |
| `{ tipo: 'passarCorte', cadeira }` | embaralhador | `embaralhando` | → `cortando` (0 riffles é permitido) |
| `{ tipo: 'cortar', cadeira, ponto? }` | cortador | `cortando` | `monte = [...monte.slice(p), ...monte.slice(0, p)]`; gasta 1 |
| `{ tipo: 'abrir3', cadeira }` | cortador | `cortando`, 0 movimentos | 3 do topo viradas para todos, fora desta mão; gasta 3 |
| `{ tipo: 'dar3', cadeira }` | cortador | `cortando`, 0 movimentos | 3 do topo = mão fechada de `(pe + 1) % 4`; gasta 3 |
| `{ tipo: 'devolver', cadeira }` | cortador | `cortando` | → `escolhendoDistribuicao` |
| `{ tipo: 'distribuir', cadeira, modo }` | embaralhador | `escolhendoDistribuicao` | dá as cartas, cria a `mao` → `jogando`/`decisaoMao10` |
| `{ tipo: 'familia', cadeira }` | qualquer um | janela de família | fechada → `conferindoFamilia`; aberta → continua |
| `{ tipo: 'conferir', cadeira, conferir }` | dupla adversária | `conferindoFamilia` | pontua ou não; → `jogando` |

**Aleatoriedade.** `bits` (um 0/1 por carta do monte) e `ponto` são opcionais no *formato* (bots e clientes mandam a intenção sem eles), mas o `reduce` **recusa** `embaralhar`/`cortar` sem eles. Quem completa é `completarSorte(acao, estado, rand)` (pura; `rand` é parâmetro). A `Mesa` sempre faz `completarSorte(semSorte(acao), estado, this.rand)` — o que o cliente mandar em `bits`/`ponto` é descartado. **Decisão:** em vez de semente, os próprios bits vão na ação: o reducer fica trivialmente determinístico e testável.

**Riffle GSR exato.** Com `n` bits uniformes: `k` = quantidade de zeros; pacote esquerdo = `k` cartas de cima, direito = o resto; a posição `i` do resultado tira do pacote esquerdo se `bits[i] === 0`, senão do direito. Cada uma das `2^n` sequências tem a mesma chance e corresponde a um par (corte, intercalação) — é exatamente a distribuição GSR (corte binomial, intercalação uniforme dado o corte).

**Corte.** `ponto ∈ [max(1, ⌈0,3·n⌉), min(n − 1, ⌊0,7·n⌋)]` (`limitesCorte`); 40 cartas → 12..28, 29 → 9..20.

**Decisão:** abrir 3 e dar 3 só como **primeiro** movimento (é o único momento em que "os 3" estão disponíveis). Abrir 3 é permitido com família desligada (é um jeito de cortar); só conta no limite quando a mesa é `fechada`.

**Decisão:** o cortador pode usar `embaralhar` (riffle) — a mesma ação do embaralhador; o reducer decide pelo `fase`.

### 2.3 Distribuição

`ordemDistribuicao(pe, pulada)` = `[(pe+1), (pe+2), (pe+3), pe] % 4` sem `pulada`.

- **por cima**: para cada cadeira da ordem, 3 cartas de uma vez do topo (`shift` ×3); vira = próxima do topo.
- **por baixo**: para cada cadeira, 3 de uma vez do fundo (`pop` ×3, a de baixo primeiro); vira = próxima do fundo.
- **subindo alternado**: do fundo, 1 por vez, 3 voltas na ordem; vira = próxima do fundo.

Quem recebeu "dar 3" fica com aquelas cartas e é pulado. A mão de 10 e a de ferro são decididas por `tipoDaMao` na distribuição, como hoje; a visão continua escondendo a própria mão na de ferro.

### 2.4 Recolhimento

`recolher(mao)` devolve, nesta ordem: cartas jogadas por rodada na ordem em que saíram (inclusive a rodada interrompida por "correr"), mãos não jogadas na ordem das cadeiras 0..3, abertas no corte, cartas das famílias na ordem dos pedidos, vira. `finalizarMao` faz `monte = [...recolher(m), ...monte]` — **a primeira carta recolhida fica no topo** (**Decisão**: a regra pede ordem determinística; esta é a mais simples de conferir). Depois: `pe = proximaCadeira(pe)`, `ritual = novoRitual(pe)`, fase `embaralhando`. Também recolhe quando a partida termina, para manter o invariante.

**Invariante** (testado por propriedade): `cartasDaPartida(s)` = monte + abertas/dadas do ritual + `recolher(mao)` é sempre uma permutação de `baralhoDaMesa(regras)` depois do `monte` inicial.

### 2.5 Família

- `janelaDeFamilia(s)`: família ligada, fase `jogando`, mão `normal`, nenhuma rodada/carta na mesa, `nivel === 0` (idêntico ao bloqueio de hoje). Funciona com `EstadoPartida` e com `Visao` (tipo estrutural `SituacaoFamilia`).
- `tipoDaProximaFamilia(s)`: `null` fora da janela; mesa `aberta` → `'aberta'`; mesa `fechada` → `'fechada'` enquanto `fechadasUsadas < 3` (fechadas da mão + 1 se houve "abrir 3"), depois `'aberta'`. **Decisão:** a ação continua `{ tipo: 'familia', cadeira }` — o tipo é determinado pela mesa e pela contagem, então não há escolha para o jogador errar.
- Pedido: monte com ≥ 3 cartas; aberta exige `ehFamilia`; **fechada não exige** (blefe é o ponto). As 3 cartas vão para `familias`, o jogador recebe as 3 do topo. Fechada → `familiaPendente` e fase `conferindoFamilia`.
- Conferir: só a dupla adversária, qualquer um dos dois (como responder truco). `conferir: false` → volta a `jogando` sem pontos. `true` → `real = ehFamilia(cartas)`; quem acertou ganha `ESCADAS[pontuacao][0]`; se isso chegar a 12, `finalizarMao(s, dupla, base, 'familia')` encerra a partida.
- A janela reabre depois de cada conferência; vários jogadores (e o mesmo jogador de novo) podem pedir.

### 2.6 Visão, vez e ações válidas

- `Visao` troca `monte` por `qtdMonte: number`; `ritual` vira `VisaoRitual` (igual, mas `dadas: Cadeira | null`, sem as cartas).
- `VisaoMao.familias: FamiliaVisivel[]` com `cartas: Carta[] | null`: visíveis se aberta, conferida ou se o próprio jogador pediu (**Decisão**: o dono já tinha visto aquelas cartas; ele não ganha nada além disso). `abertasNoCorte` é pública.
- `quemDeveAgir`: embaralhando/escolhendo → embaralhador; cortando → cortador; conferindo → as duas cadeiras da dupla adversária de quem pediu.
- `acoesValidas`: candidatas novas (sem sorte); a legalidade é testada com `completarSorte(a, s, () => 0)` (bits zero, menor ponto). O que volta ao cliente nunca tem `bits`/`ponto`.

### 2.7 Atalhos para testes

`atalhos.ts` (exportado): `monteRodaARoda(baralho)` converte um baralho na ordem antiga (roda a roda a partir de `pe + 1`, vira na posição 12) para o monte "por cima" equivalente; `ritualMinimo(s)` (passa, devolve, por cima) e `distribuirSemRitual(s, baralho)` (= `monte` + ritual mínimo). Assim os helpers `distribuida(...)` de engine, servidor e web continuam entregando **as mesmas mãos** de antes e quase nenhum teste muda.

### 2.8 Bots (`bots/ritual.ts`)

| Etapa | Fácil | Difícil |
|---|---|---|
| Embaralhar | 3 riffles e passa | 2 riffles; depois 50% de mais um, até 6 |
| Cortar | corta 1× e devolve | 1º mov.: 5% abrir 3, 5% dar 3, 75% cortar, 15% riffle; depois 30% corta de novo, senão devolve |
| Distribuir | por cima | 60% por cima, 25% por baixo, 15% subindo |
| Pedir família | família real sem manilha | idem + 5% de blefe fechado com mão fraca (sem manilha, 3 ou 2) |
| Conferir | só se impossível (< 3 figuras desconhecidas) ou se a mesma cadeira já pediu fechada nesta mão | idem + chance de família < 3,5% ou 10% de desconfiança |

A chance vem de `chanceDeFamilia(v)`: entre as cartas que o bot não viu, `C(figuras, 3) / C(desconhecidas, 3)`. **Decisão:** "pedir a 2ª fechada na mesma mão" conta como suspeito — torna o comportamento previsível e testável (E2E).

O difícil decide etapas e família por política e tira `familia` das candidatas do Monte Carlo; `amostrarMundo` passa a reconstruir o monte (do tamanho `qtdMonte`) e as famílias escondidas, para o mundo amostrado ser consistente.

## 3. Servidor

- `Tempos` ganha `ritualMs` (12 s, prazo humano por etapa), `conferirMs` (6 s) e `janelaFamiliaMs` (2,5 s: com família ligada e janela aberta, o bot da vez espera isso antes da 1ª carta, para humanos e outros bots poderem pedir).
- `rand` padrão = `randCripto` (`node:crypto.randomInt`). O monte inicial (`aguardandoMonte` → `pausaMaoMs` → `{ tipo: 'monte' }`), os bits do riffle e o ponto do corte saem dele.
- `aplicar`: completa a sorte; manda `acao` com `msgDaAcao(completa, antes)`; `distribuir` zera dicas e dispara os sinais dos bots (antes era no `distribuir` privado); `familia` apaga a dica do parceiro de quem trocou as cartas.
- Bots fora da vez, na janela de família, são consultados após `botMs` (só uma ação `familia` é aplicada).
- Primeira etapa de cada mão (embaralhando, 0 riffles): o bot espera `pausaMaoMs` — é a pausa que antes ficava em `aguardandoDistribuicao`, para a tela mostrar o resultado da mão.
- Tempo esgotado numa etapa do ritual: `estourouTempo` repete a jogada automática enquanto a mesma cadeira continuar devendo agir no ritual (máx. 8): 3 riffles + passar; cortar + devolver.
- `MsgAcao` ganha `modo`, `ordem` (quem recebe, na ordem), `para` (dar 3), `fracao` (corte, 2 casas), `conferir`, `aberta` (família). Nunca leva `bits` nem `ponto`.
- `RegistroMesa`/`contarAcao`: ações novas caem no "não conta" (coberto por teste).
- `TEMPOS_RAPIDOS` ganha `ritualMs: 3_000` (E2E ranqueada não espera 12 s por etapa).

## 4. Web

- Loja: `movimentos` (últimas 20 `MsgAcao` com id) para as animações; `textoDaAcao` ganha balões ("Corta aí", "Cortei", "Abri 3!", "Toma 3!", "Pode dar", "Por cima"…, "Família fechada!", "Confere!").
- Botões (`agruparAcoes(acoes, visao)`): Embaralhar / Passar pra cortar; Cortar / Embaralhar / Abrir 3 / Dar 3 / Devolver; Por cima / Por baixo / Subindo alternado; Pedir família fechada / Pedir família aberta; Conferir / Deixar passar.
- `logica/ritual.ts`: `donoDoMonte`, `textoEtapa` ("Sua vez de cortar — 2 movimentos"), `passosDistribuicao`, `textoFamilia` ("Bia conferiu: era blefe — +2 pra Nós").
- Componentes: `Monte` (pilha com contagem, encostada no assento de quem está com ele), `FamiliasNaMesa` (abertas no corte; cada família na frente de quem pediu, versos ou faces, com o texto). `CentroMesa` passa a ter sempre `data-testid="centro"` e recebe filhos.
- Resumo de fim de mão: aparece enquanto `fase === 'embaralhando' && embaralhadas === 0`.
- Animações (`animacaoMesa.ts › useAnimacaoRitual`, Web Animations sobre a camada de voo): riffle (duas metades abrem e fecham), monte indo ao cortador e voltando, corte (metade de cima passa para baixo), cartas voando para cada assento na ordem e modo certos (do topo ou do fundo; 3 de uma vez ou 1 por vez), dar 3. Abrir 3, família chegando e conferência revelando são animações CSS de montagem/classe. Com `prefers-reduced-motion` nada voa (a regra global do CSS já zera as animações CSS). O primeiro render (F5) não anima.

## 5. Testes

- Engine: unidades de riffle (inclusive distribuição exata para n = 3), corte, distribuição nos 3 modos, recolhimento, abrir/dar 3, família fechada/aberta/conferir/limites/fim de partida, visão sem vazamento, bots; propriedade: partidas inteiras com ritual aleatório, nenhuma carta duplicada ou perdida em nenhum passo.
- Servidor: `mesa-ritual.test.ts` (sorte do servidor, tempos esgotados, mensagens, família conferida, prazo de conferir); um teste novo em `integracao.test.ts` (porta 2568).
- Web: lógica, componentes, tela; E2E adaptados (clicam a ação padrão de cada etapa) + `ritual-familia.spec.ts` (mineiro, família fechada pedida duas vezes, bot confere, resultado na mesa).

## 6. Fora de escopo

Escolher cadeira na mesa privada; desfazer etapas; persistir o monte no banco (a partida vive na sala); estatísticas de família no perfil.
