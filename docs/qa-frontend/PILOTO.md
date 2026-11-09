# Piloto do Guia Design & Frontend IA v2 — Truco Online

**Status:** implementação inicial de processo e regressão de mesa; sem benchmark executado nesta branch.
**Objetivo:** aplicar Designer → Frontend → QA às telas reais e avaliar qualidade visual, usabilidade, acessibilidade e estabilidade, sem reescrever a identidade do Truco.

## Baseline (revisão de código, não de renderização)

- Interface React/Vite/TS, regras em engine e partida em Colyseus.
- Tokens de marca centralizados em apps/web/src/estilos.css; CSS responsivo de mesa em apps/web/src/mesa-mobile.css.
- O CSS para retrato alto (altura >= 651px) define a altura da arena como clamp(350px, 57dvh, 690px). Para 360x740, isso equivale a aproximadamente 422px.
- O teste preexistente apps/web/e2e/layout-mobile.spec.ts exigia arena <= 290px para 360x740. É uma **contradição objetiva de expectativa de teste com o CSS atual**, não prova de defeito visual no navegador.
- Esta branch ajusta tal expectativa e adiciona testes que medem uso do eixo Y e overflow em cinco formatos. **Os testes não foram executados durante esta revisão.**
- Histórico reportado pelo usuário: mesa visualmente pequena/espaço ocioso e conexão instável quando troca de aplicativo/aba. São relatos a reproduzir; **nenhum está marcado como corrigido** nesta branch.

## Papéis e handoff

| Papel | Entrada | Saída exigida |
|---|---|---|
| Designer | problemas relatados, telas e estados | diagnóstico, proposta, tokens/componentes preservados, critérios |
| Frontend | proposta aprovada, código e testes | diff mínimo, testes de regressão, riscos e rollback |
| QA Visual/UX | baseline, diff, matriz de casos | capturas, resultado por cenário, bugs com reprodução, pendências |
| Orquestrador | entregas anteriores | decisão de aceite baseada em evidência e registro de escopo |

## Matriz inicial

| ID | Cenário | Critério de aceite | Evidência requerida | Estado |
|---|---|---|---|---|
| TV-01 | mesa em 320x568 | arena proporcional e sem overflow horizontal | Playwright + screenshot | NAO_EXECUTADO |
| TV-02 | mesa em 360x640 | arena proporcional e ações alcançáveis | Playwright + screenshot | NAO_EXECUTADO |
| TV-03 | mesa em 360x740 | arena útil no eixo Y e sem overflow | Playwright + screenshot | NAO_EXECUTADO |
| TV-04 | mesa em 390x844 e 430x932 | proporção legível e controles presentes | Playwright + screenshots | NAO_EXECUTADO |
| TV-05 | vista superior com cadeiras | troca de vista preserva área e ações | Playwright + screenshots | NAO_EXECUTADO |
| TV-06 | mesa 3D | fallback, WebGL, controles e altura | navegador real | NAO_EXECUTADO |
| TV-07 | modo claro/escuro, foco e contraste | legibilidade e navegação funcional | screenshots + teste teclado/manual | NAO_EXECUTADO |
| TV-08 | home, salas, perfil, ranking, espera | sem overflow e hierarquia consistente | screenshots por rota | NAO_EXECUTADO |
| TV-09 | alternância de app/aba na partida | retomada ou reconexão com feedback | 2 clientes reais + logs sanitizados | NAO_EXECUTADO |
| TV-10 | desktop e zoom 200% | reflow, escala e controles acessíveis | navegador desktop | NAO_EXECUTADO |

## Procedimento para a primeira rodada

1. Configurar uma instalação de desenvolvimento ou staging autorizada, com contas e dados de teste.
2. Rodar testes de tipo, testes existentes e apps/web/e2e/qa-visual-mesa.spec.ts.
3. Guardar os resultados e screenshots do Playwright, além dos logs relevantes com dados mascarados.
4. Fazer inspeção manual em 2D personagens, cadeiras e 3D; incluir teclado, orientação landscape e zoom.
5. Registrar achados com: arquivo/rota, viewport, estado, comportamento esperado, observado, evidência, confiança, impacto e correção proposta.
6. Corrigir problemas reproduzidos em branches pequenas, sem trocar regras do motor de jogo.
7. Retestar e comparar screenshots; só atualizar estado para APROVADO após execução real.

## Nota do produto e benchmark

A pontuação do kit (avaliação editorial) não é a nota desta aplicação. Para medir impacto, comparar uma rodada com o guia contra baseline em cenários equivalentes: bloqueadores P0/P1, bugs de responsividade por cenário, conclusão de tarefas, tempo, regressões e avaliação visual cega. Não atribuir 10/10 a partir de contagem de arquivos ou testes escritos.

## Limitações neste PR

A revisão foi feita a partir do repositório e histórico de problemas; não há screenshots atuais da aplicação renderizada nem resultado de execução local/CI. Não é possível afirmar que a mesa está visualmente corrigida ou que a reconexão foi resolvida.
