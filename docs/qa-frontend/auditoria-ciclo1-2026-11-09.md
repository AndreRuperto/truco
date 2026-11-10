# Auditoria do Ciclo 1 — mesa responsiva (2026-11-09)

Base: `master` @ `2dd80b2`. Ferramenta: `apps/web/e2e/auditoria-mesa.spec.ts` (sob demanda, `TRUCO_AUDITORIA=1`),
que grava JSON de bounding boxes + screenshots em `apps/web/test-results/auditoria-mesa/` (não versionado).

## Baseline executado

| Comando | Resultado |
| --- | --- |
| `pnpm -r typecheck` | aprovado |
| `pnpm --filter @truco/web test` | 59 arquivos / 390 testes aprovados |
| `playwright test e2e/layout-mobile.spec.ts e2e/qa-visual-mesa.spec.ts` | 7/7 aprovados |
| `pnpm test:e2e` (suíte completa) | NAO_EXECUTADO |

Os testes aprovam, mas as capturas mostram problemas que eles não cobrem (ver O2, O3).

## Medidas (vista personagens; a vista cadeiras usa a mesma grade e mediu igual)

| Viewport | Tampo (L×A) | Tampo/altura | Centro/área do tampo | Carta da mão | Doc. rola em Y? | Sobra sob o rodapé |
| --- | --- | --- | --- | --- | --- | --- |
| 320×568 | 310×301 | 0,53 | 0,28 | 67×96 | sim (+45px) | 0 |
| 360×640 | 350×339 | 0,53 | 0,25 | 67×96 | sim (+11px) | 3px |
| 360×740 | 350×474 | 0,64 | 0,21 | 81×115 | sim (+63px) | 0 |
| 360×780 | 350×499 | 0,64 | 0,20 | 81×115 | sim (+48px) | 0 |
| 360×800 | 350×512 | 0,64 | 0,20 | 81×115 | não | 31px |
| 390×844 | 380×540 | 0,64 | 0,20 | 88×124 | não | 37px |
| 430×932 | 420×596 | 0,64 | 0,20 | 95×133 | não | 60px |
| 768×1024 | 758×655 | 0,64 | 0,19 | 95×133 | não | 101px |
| 1440×900 | 868×512 | 0,57 | 0,47 | 111×155 | não | 8px |

`scrollWidth` = largura da viewport em todos os casos.

## Achados (observação → hipótese)

| ID | Sev. | Observação (evidência) | Hipótese / correção proposta |
| --- | --- | --- | --- |
| O1 | P0 — **corrigido (ver abaixo)** | 320×568: o rodapé de ações (sticky) cobre a metade de baixo das cartas da mão durante "Conferir / Deixar passar" (`320x568-personagens-full.png`). Documento 45px mais alto que a tela. | Em telas baixas, a soma placar + tampo (53dvh, piso de 300px) + mão + rodapé passa de 100dvh. Reduzir o piso do tampo ou reservar a altura do rodapé no cálculo da arena; testar mão × rodapé sem interseção. |
| O2 | P1 — **corrigido** | Balões e nomes laterais são **cortados** nas bordas ("Pode dar.", "Família fecha…", "Bot Zé") em 320–390 (`*-personagens.png`). `overflow-x: clip` esconde, e o assert de `scrollWidth` passa. | Limitar balões e assentos laterais a `max-width` dentro da coluna ou ancorar para dentro da mesa; novo assert: nenhum `.balao`/`.assento-nome` com `left < 0` ou `right > innerWidth`. |
| O3 | P1 — **corrigido** | Arena grande e vazia: o centro ocupa ~20% da área do tampo de 360 a 768 de largura; cartas jogadas com ~40px em um tampo de 474–655px de altura. | É o risco já previsto no roadmap. Escalar `--carta-c` e `--cruz-h` com a altura da arena (não só com `vw`) e aproximar os assentos do centro. |
| O4 | P1 — **corrigido** | Dica da partida (`.dica-mesa`) cobre o placar e o topo do tampo; o botão "Ordem" fica coberto em todos os mobiles (detecção por `elementFromPoint`). | Posicionar a dica sem cobrir o placar (ex.: acima do rodapé) ou reduzir a largura dela. Confirmar se o "Ordem" coberto vem só da dica. |
| O5 | P2 — parcial (rótulo da vez) | Rótulo "Sua vez · 19s" do centro fica embaixo das cartas jogadas (vista cadeiras, 390×844); o nome "Bot Tião" fica atrás do monte ou da carta de cima. | Ajustar `z-index` ou a posição da `.etapa` no centro; aplicar um respiro ao nome do assento de cima. |
| O6 | P2 | Em 390×844 e acima, aparece uma barra escura de 16px **vazia** quando não há ações, com 37–101px de piso livre abaixo. | Esconder `.barra-acoes` sem botões; redistribuir a sobra para a arena (ou para as cartas). |

## Limitações desta rodada

- O estado capturado varia por temporização: em algumas viewports a captura pegou o ritual ("Por cima!"/"Cortei."), em outras a janela de família. A contagem de cartas no DOM não garante que a mão estava visível. Próxima versão da auditoria: esperar "Sua vez", cartas visíveis e dica fechada (estado determinístico).
- 3D, mesa de feltro/plástico, landscape, teclado e zoom 200%: NAO_EXECUTADO.
- Galaxy S25 FE/S21 foram aproximados por viewport (360×780 / 360×800) no Chromium (perfil Pixel 7), não em aparelho real.
- Revisão feita pelo mesmo agente que vai implementar: não equivale a QA independente.

## Correção do O1 (P0) — 2026-11-10

**Reprodução (teste novo, antes da correção):** com cartas jogáveis e "Truco!" no rodapé, a mão ficou
coberta em 320×568 (15px) e 360×740 (34px), e a página rolava 45–48px em 360×640 e 430×932.
Corrigido só o tamanho da arena, o botão "Jogar coberta" ainda ficava sob o rodapé (+23px), porque ocupa
uma linha inteira (~46px) abaixo das cartas.

**Causa:** `--altura-mesa-mobile` era uma fração fixa da tela (53dvh/64dvh, com piso de 300/350px)
que não descontava placar, cronômetro, mão e rodapé.

**Mudança (`apps/web/src/mesa-mobile.css`, só CSS):**
- `--reserva-mesa` soma o resto da partida no pior caso comum (barra 41 + placar 69 + cronômetro 14 +
  carta × 1,66 + rodapé 62 + gaps + padding + safe areas); a arena = `clamp(220px, 100dvh − reserva, 690px)`.
  Isso vale para todo retrato ≤ 820px; as regras de altura baixa/alta deixam de fixar a arena.
- No celular, o botão "Jogar coberta" fica **ao lado** das cartas (largura de 76px), e não embaixo.
  Ele só aparece a partir da 2ª vaza, com no máximo 2 cartas na mão, então cabe em 320px.

**Teste de regressão:** `qa-visual-mesa.spec.ts` › "rodapé fixo não cobre a mão" em 6 viewports. Com
mão + ação no rodapé, sem rolar: fundo das cartas/"Jogar coberta" ≤ topo do rodapé e `scrollHeight − innerHeight` ≤ 1.
Passou em 12/12 execuções (`--repeat-each 2`).

**Antes → depois (altura do tampo, mesmo estado "sua vez + Truco")**

| Viewport | Antes | Depois | Mão coberta antes | Depois |
| --- | --- | --- | --- | --- |
| 320×568 | 301px | 248px | 15px | 0 |
| 360×640 | 339px | 320px | rola 45px | 0 |
| 360×740 | 474px | 399px | 34px | 0 |
| 360×780 | 499px | 439px | — | 0 |
| 390×844 | 540px | 494px | — | 0 |
| 430×932 | 596px | 572px | rola 48px | 0 |

Os valores "depois" vêm do diagnóstico do teste antes da última mudança (botão ao lado). Com o botão ao
lado, a reserva não mudou, então a altura do tampo é a mesma. A arena encolhe para caber o resto:
é o custo assumido do P0. Os critérios existentes de uso do eixo Y (≥ 0,42/0,48) continuam passando.

**Riscos e pendências:** um rodapé com duas linhas (janela de família + ações, ou vários botões quebrando
linha) passa da reserva de 62px e pode voltar a cobrir parte da mão. Isso não foi reproduzido nesta rodada.
Os valores em px da reserva acompanham as regras de barra/placar/rodapé: se elas mudarem, o teste novo falha.
Rollback: reverter `mesa-mobile.css` (arena e bloco `.minha-mao`).

## Correção dos P1 (O2, O3, O4) — 2026-11-10

Branch `claude/ciclo1-p1` (empilhada sobre a correção do P0). Só CSS, em `apps/web/src/mesa-mobile.css`, no bloco retrato ≤ 820px.

| ID | Antes (teste novo falhando) | Mudança | Depois |
| --- | --- | --- | --- |
| O2 | "Pode dar." de −10 a 81px (360×740) e passando da borda direita (320×568) | Balão das cadeiras laterais preso na borda interna do assento (`translate: 50% 0` compensa o `translateX(-50%)` dos keyframes de grito); quebra linha com `max-width: min(44vw, 170px)` | "balões das cadeiras cabem na largura": 6/6 |
| O4 | Dica cobria placar e "Ordem" em 320, 360 e 430 | Dica ancorada na metade de baixo da arena (`bottom` calculado a partir da `--altura-mesa-mobile`), mais compacta | "dica não cobre placar, Ordem, mão nem ações": 9/9 |
| O3 | Centro ≈ 20% da área do tampo; cartas jogadas com ~36px | `--carta-c: clamp(30px, min(14.5vw, (altura da arena − 110px) / 4,3), 64px)` | Centro/tampo: 0,36 (320), 0,42 (360×640), 0,36 (360×740), 0,32 (390), 0,30 (430); sem colisão assento×centro, sem rolagem |

O O3 não tem teste novo próprio. A medição está na auditoria (`TRUCO_AUDITORIA=1`), e as regressões de geometria são cobertas pelos testes de mão × rodapé, balões e largura.

**Efeito colateral positivo (O5):** com a cruz maior, o rótulo "Sua vez · 20s" deixa de ficar embaixo das cartas jogadas em 360×740.

**Pendências observadas nesta rodada (sem correção)**
- 320×568: o placar quebra "Preparando a mão" em duas linhas (~78px, acima dos 69px da reserva). A página não rolou na medição, mas sobra pouca folga.
- 320×568: com três balões ao mesmo tempo (cima, esquerda e direita), eles se sobrepõem entre si. Continuam dentro da tela, mas um encobre o outro.
- Em 320×568, a dica ocupa boa parte do tampo (é dispensável com "Entendi"/"Sem dicas").
- O6 (barra de ações vazia de 16px) continua aberto.

**Verificação desta rodada:** typecheck, 390 testes unitários e build aprovados. No `pnpm test:e2e`, 29 passaram, 9 foram pulados (auditoria) e 2 falharam:
- "rodapé fixo não cobre a mão - 360x740": o driver não chegou ao estado medido porque a partida acabou antes. O teste agora recomeça a partida ("Jogar de novo") e passou 18/18 com `--repeat-each 3`.
- "quatro humanos completam partida até o placar final": estourou os 5 min. Isolado, passou em 3,3 min (na rodada do P0, em 4,0 min). A partida é aleatória e o limite interno é de 240 s, então a hipótese é teste no limite do tempo, não efeito do CSS. Isso **não foi comprovado**: acompanhar no CI.

Rollback: reverter os commits `2c8d762` (balões), `e9d413c` (dica) e o commit do O3.
