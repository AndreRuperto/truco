# Animações da mesa: inventário, movimento reduzido e desempenho

Fase 3 do plano MVP ([`docs/plans/2026-11-12-plano-mvp.md`](../plans/2026-11-12-plano-mvp.md)), 2026-11-16.

## F3.1 Inventário

Fontes: constantes de `apps/web/src/componentes/animacaoMesa.ts`, `CentroMesa.tsx`, `logica/eventos.ts` e `--dur` em `estilos.css`. As durações "medidas" vêm de `document.getAnimations()` numa partida real, sem movimento reduzido (sonda de `e2e/movimento-reduzido.spec.ts` com `no-preference`, 390×844).

| Evento | Como anima | Duração | Bloqueia a ação de quem está na vez? | Movimento reduzido |
|---|---|---|---|---|
| Embaralhar | fantasma do riffle (Web Animations) | `DUR_RIFFLE` 560 ms (medido 560) | Não: camada `.camada-voo` com `pointer-events: none`; o botão continua ativo | Não anima (`useAnimacaoRitual` sai se `movimentoReduzido()`) |
| Cortar | fantasma do corte | `DUR_CORTE` 480 ms (medido 480) | Não | Não anima |
| Dar as cartas | pacotes voando do monte; mão do pé | `DUR_DADA` 820 ms por pacote, `PASSO_DADA` 540 / `PASSO_DADA_UMA` 340 entre pacotes; mão do pé até ~3 s (medido 2980) | Não: as cartas da mão ficam habilitadas pela regra (`jogaveis`), não pela animação | Não anima |
| Jogar carta (e coberta) | voo da mão até a cruz | `DUR_VOO` 360 ms (medido 360); carta esmaecida 360 | Não: a vez do próximo chega pelo servidor; o voo é só no cliente | Não anima (troca instantânea) |
| Recuo / recolher rodada | recuo e deslize para a pilha | `DUR_RECUO` 150, `DUR_RECOLHER` 300, `DUR_DESLIZE` 380 (monte medido 380) | Não | Não anima (`deslizarDe` sai cedo) |
| Cangada (lateral) | revelação carta a carta | 4 × 250 ms; lateral fica `MOSTRA_RODADA_MS` 1.400 ms | Não | As 4 abertas de uma vez |
| Truco pedido / resposta | balão de grito (CSS `grito`) e balão comum (`aparecer`) | grito 420 ms; balão `--dur` 160 ms; balão fica `DURACAO_BALAO_MS` 2.500 ms | Não (balões sem clique) | Regras `prefers-reduced-motion` em `estilos.css` |
| Fim de mão | sobreposição leve (`aparecer`) | `--dur` 160 ms | Não: `.overlay.leve` com `pointer-events: none` | Coberto |
| Fim de partida | diálogo modal (`aparecer`) | `--dur` 160 ms | É o fim: o diálogo é a próxima ação ("Jogar de novo") | Coberto |
| Família revelada | carta virando (`carta-revelada`) | 320 ms por carta, 3 cartas | Não | Coberto |

**Regra "nenhuma animação impede quem está na vez de agir":** atendida. Nada desabilita carta ou botão por causa de animação; as camadas animadas não recebem clique. Coberto em E2E pelo teste de toque duplo (F3.4) e pelos testes de partida.

## F3.2 Movimento reduzido

`e2e/movimento-reduzido.spec.ts`: com `reducedMotion: 'reduce'`, joga uma mão contra 3 bots nas vistas personagens e cadeiras e amostra `document.getAnimations()` (CSS, transições e Web Animations). Resultado: **nenhuma animação acima de 200 ms, e a mão termina** (2/2). Sem movimento reduzido, a mesma sonda acha 15 animações acima de 200 ms (prova de que o teste enxerga). `mesa-mobile.css` e `visualizacao-mesa.css` não têm `animation` nem `transition`, por isso não precisam de regra própria.

Vista 3D: a cena recebe `{ reduzido }` em `criarCena3D`; não medida por este teste (canvas WebGL não aparece em `getAnimations`).

## F3.3 Vez, truco e resultado (texto, não só cor)

| Estado | Visível | Anunciado | Teste |
|---|---|---|---|
| De quem é a vez | "Sua vez · 18s" / "Vez de Bia" na linha do centro, rótulo "vez" no assento, "Sua vez" no placar | "Sua vez." numa região `so-leitor` única (`anuncio-mesa`), sem os segundos (a linha com segundos fica `aria-live="off"`) | `tela-mesa.test.tsx` (F3.3) |
| Pedido de truco | "Pediram Truco! Vale 3" no placar (rótulo do grupo inclui o pedido) | "Pediram Truco! Vale 3." na mesma região | idem |
| Fim de rodada | **novo:** "Rodada nossa!" / "Rodada deles." / "Cangou!" na linha do centro enquanto a rodada fechada fica no meio (1,4 s) | `role="status"`, polite | idem |
| Fim de mão | resumo "Nós levamos! +1 ponto — nas rodadas" | `role="status"` (`fim-mao`) | teste existente em `tela-mesa.test.tsx` |

Sem componente novo: `textoResultadoRodada` (puro, `logica/textos.ts`) e a linha de etapa já existente. Regiões vivas ainda em mais de um lugar (balões com `role="status"`, fim de mão): a consolidação em uma região é da F6.1.

## F3.4 Toque duplo e ação duplicada

- Web (`rede/loja.ts`): a mesma ação só sai de novo depois de um `estado` novo, de um `erro` do servidor ou de 1,5 s; ação diferente passa. `test/loja.test.ts` ("toque duplo").
- Servidor: a mesma jogada ou o mesmo "Truco!" repetido é recusado pelo motor, com erro e sem mudar a partida. `apps/server/test/mesa-erros.test.ts` ("ação repetida"). Não precisou de código no servidor.

## F3.5 Som

Já atendido pelo código; agora com teste da síntese de verdade (`test/som-sintese.test.ts`, `AudioContext` falso): antes do primeiro gesto não nasce contexto nem nó de áudio; depois de `destravarAudio` toca; `sintetizar` e `tocarArquivo` voltam na hora mesmo com a rede presa (não atrasam a ação). Desligar e a escolha gravada (`CHAVE_SOM`): teste existente em `som.test.tsx`.

## F3.6 Desempenho

`e2e/auditoria-desempenho.spec.ts` (sob demanda, `TRUCO_AUDITORIA=1`): Pixel 7, CPU 4x mais lenta por CDP, uma mão inteira contra bots (modo rápido do E2E), Chromium headless.

| Vista | FPS médio | Maior quadro | Quadros > 100 ms | Maior tarefa longa | Meta | Resultado |
|---|---|---|---|---|---|---|
| Personagens (2D), 3 execuções (1 sem saída registrada) | 37–43 | 150–167 ms | 3–5 | 117–127 ms | nenhum quadro > 100 ms | **não atingida** |
| 3D, antes | 8,0 | 300 ms | 118 de 144 | 228 ms | média ≥ 30 FPS | **não atingida** |
| 3D, depois de limitar a 1,5 pixel por ponto e sombra PCF simples em tela pequena (`cena.ts`) | 12,3 | 200 ms | 7 de 96 | 119 ms | média ≥ 30 FPS | **não atingida** (+54% de FPS, p95 de 183 para 117 ms) |

Limitações: no headless o WebGL roda em software (SwiftShader), então o 3D aqui é pessimista e não representa um celular com GPU; a medição em aparelho real fica com o André (Fase 7, roteiro). O 2D precisa de um perfil de CPU com atribuição das tarefas longas para achar a causa (provável: renderização da tela inteira a cada mudança de estado durante dar as cartas); fica como pendência.

## Gate da fase (local)

| Etapa | Resultado |
|---|---|
| `pnpm -r typecheck` | ok |
| `pnpm -r test` | server 408, web 442, engine 274: tudo passou |
| `pnpm --filter @truco/web build` | ok |
| `TRUCO_DEPLOY_FORCAR=1 pnpm test:e2e` | 93 passaram, 17 pulados (auditorias sob demanda), 0 falhas inesperadas, saída 0 (19 min). A falha esperada é a P3 da dica em 320×568 (`test.fail`). |

O E2E pegou uma regressão desta fase antes do PR: a região de anúncio, inserida entre a mão e o rodapé, quebrava o seletor `.minha-mao + .rodape-mesa`, e o desktop voltava a rolar. A região foi movida para depois do rodapé (`85e0ec8`).

QA independente desta fase: **não feito** (mesmo modelo implementou e verificou).

