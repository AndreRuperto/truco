# Roadmap de evolução do Truco — visual, jogabilidade e lançamento

> Estado: planejamento proposto, ainda não executado. Atualizar as caixas e evidências somente após a conclusão verificável.
>
> Base validada: `master`, commit `48a01e19ebcb538167f509150fd2670fe4a821f4`. CI aprovado: https://github.com/AndreRuperto/truco/actions/runs/42712854930
>
> Escopo: frontend web/PWA, responsividade, personalização da mesa, multiplayer, progressão e qualidade de lançamento.

## Objetivos e princípios

1. Priorizar uma arena utilizável e visualmente equilibrada em telas pequenas, sem perder controles.
2. Não sacrificar estabilidade, acessibilidade ou responsividade para obter apenas capturas mais bonitas.
3. Preservar modos de visualização existentes, mesas, embaralhamento, multiplayer e reconexão.
4. Trabalhar em alterações pequenas, com evidências de testes e comparação visual.
5. Evitar reduzir cobertura, remover asserts ou mascarar overflow apenas para fazer o CI passar.

## Situação inicial e riscos conhecidos

- O commit `6e26711d56420212a92d97be896f7f29464ca46c` corrigiu contenção horizontal; CI aprovado.
- O commit `48a01e19ebcb538167f509150fd2670fe4a821f4` ampliou a altura-alvo da arena para 64dvh em telas verticais e estendeu regras a tablets até 820px; CI aprovado.
- A aprovação automatizada não comprova, por si só, qualidade estética, ausência de sobreposição em todos os estados, nem comportamento real em navegadores móveis.
- Atenção à cascata: `apps/web/src/main.tsx` importa `estilos.css`, `refinamento-visual.css`, `vitrine-mesas.css`, `mesa-partida-feltro.css`, `visualizacao-mesa.css`, `mesa-mobile.css`, `polimento-v2.css` e `tema-perfil.css`. Validar a especificidade e a ordem antes de editar.
- Aumentar `--altura-mesa-mobile` sem redimensionar cartas, mão, assentos e centro pode criar uma arena grande, porém vazia.
- A faixa de tablet exige atenção a regras conflitantes que ainda usam `max-width: 700px`.

## Definição de pronto (aplicável a cada ciclo)

- [ ] Alterações revisadas em código e estilos computados.
- [ ] Sem overflow horizontal ou elementos interativos cortados nos cenários cobertos.
- [ ] Teclado, toque e foco visível continuam utilizáveis.
- [ ] `pnpm -r typecheck`, `pnpm -r test`, `pnpm --filter @truco/web build` e `pnpm test:e2e` aprovados, quando aplicáveis.
- [ ] Evidências visuais antes/depois ou justificativa de ausência de mudança visual.
- [ ] Commit identificável na `master`, com link da execução CI.
- [ ] Roadmap atualizado com data, commit, resultados e pendências.

## Ciclo 1 — Mesa responsiva e hierarquia visual (P0, estimativa 2–4 dias)

**Problema:** a arena pode ocupar pouca altura percebida; cartas e assentos não necessariamente escalam com o tampo. Alterações de largura e altura não podem criar rolagem horizontal.

**Tarefas**
- [ ] Inventariar a estrutura JSX/DOM da mesa, cabeçalho, barra, arena, mão e ações.
- [ ] Inspecionar `mesa-mobile.css`, `polimento-v2.css`, `visualizacao-mesa.css` e estilos-base; documentar a regra vencedora para altura/largura/overflow.
- [ ] Medir dimensões reais do tampo, área útil, mão e controles em 320×568, 360×640, 360×740, 390×844 e 430×932.
- [ ] Validar iPhone 12 Pro (390×844), Galaxy S25 FE (360×780), Galaxy S21 (360×800), tablet 768×1024 e desktop 1440×900.
- [ ] Ajustar altura por viewport e espaço disponível, considerando safe areas, cabeçalhos, avisos, teclado e barras do navegador.
- [ ] Escalar cartas, jogadores/cadeiras, placar, monte e centro da mesa de forma proporcional, sem sobreposições.
- [ ] Garantir que mão, cronômetro e ações sejam visíveis ou alcançáveis por rolagem vertical previsível; evitar controles encobertos por rodapé fixo.
- [ ] Verificar modos personagens, cadeiras, mesa de madeira, feltro e visualização 3D, quando disponíveis.
- [ ] Adicionar asserts de bounding boxes, elementos clicáveis, scrollWidth e screenshots por breakpoint/estado.
- [ ] Corrigir regressões e publicar evidências.

**Aceite:** arena visualmente dominante sem excesso de espaço vazio; todos os controles utilizáveis; nenhuma rolagem horizontal indevida; testes aprovados.

## Ciclo 2 — Temas, mesas e modos de visualização (P1, 2–3 dias)

- [ ] Padronizar tokens de cor, tipografia, bordas, sombras, espaçamentos e estados hover/focus/active.
- [ ] Revisar mesas de madeira, feltro e demais variantes, inclusive regras de acesso/seleção.
- [ ] Refinar vista superior com cadeiras e personagens sem deslocamento para fora da viewport.
- [ ] Verificar consistência de menus e seleção de tema dentro do perfil.
- [ ] Cobrir alternância de tema/modo com testes de regressão visual e persistência da preferência.

**Aceite:** nenhuma combinação de tema/modo perde legibilidade, alinhamento ou funcionalidade.

## Ciclo 3 — Animações e feedback de partida (P1, 3–5 dias)

- [ ] Revisar distribuição, embaralhamento, descarte e recolhimento de cartas.
- [ ] Destacar jogador da vez, estados de espera, pedidos de Truco e resolução da rodada.
- [ ] Manter animações não bloqueantes e respeitar `prefers-reduced-motion`.
- [ ] Testar cliques/toques rápidos, latência e transições de estado.
- [ ] Medir quedas de FPS e evitar trabalho excessivo em aparelhos modestos.

**Aceite:** feedback inequívoco e animações fluidas sem alterar a lógica das regras.

## Ciclo 4 — Multiplayer, reconexão e PWA (P0/P1, 2–4 dias)

- [ ] Testar alternância de apps, perda/retorno de rede, recarga, suspensão de aba e reabertura do PWA.
- [ ] Verificar preservação de cadeira, sessão e estado da partida quando a reconexão for válida.
- [ ] Cobrir indisponibilidade do servidor, sala encerrada e sessão expirada com mensagens claras.
- [ ] Revisar atualização do service worker e comportamento de cache após deploy.
- [ ] Executar testes end-to-end com dois ou mais clientes e cenários de conexão instável.

**Aceite:** reconexão consistente dentro das regras da sessão e falhas comunicadas sem estado enganoso.

## Ciclo 5 — Competitivo, estatísticas e progressão (P2, 4–7 dias)

- [ ] Auditar ranking e contabilização de resultados, desistências e desconexões.
- [ ] Revisar histórico de partidas e métricas úteis ao jogador.
- [ ] Especificar temporadas, recompensas cosméticas e regras de progressão antes de implementar.
- [ ] Definir salvaguardas contra duplicação de resultados e manipulação de partidas.
- [ ] Criar testes de integridade para resultados e pontuação.

**Aceite:** progressão explicável, dados coerentes e resultados reprodutíveis.

## Ciclo 6 — Auditoria e preparação de lançamento (P1, 3–5 dias)

- [ ] Auditoria de acessibilidade: navegação por teclado, contraste, foco, leitores de tela e movimento reduzido.
- [ ] Medir performance de carregamento, bundle, memória e renderização em mobile.
- [ ] Revisar segurança de autenticação, sessões, validação de entradas e limites de requisição.
- [ ] Validar instalação e atualização PWA nos navegadores suportados.
- [ ] Preparar monitoramento, registro de erros, documentação e instruções de suporte.
- [ ] Realizar teste exploratório com jogadores reais e registrar problemas por severidade.
- [ ] Publicar checklist de release e notas da versão.

**Aceite:** nenhuma falha crítica conhecida, CI verde, fluxo principal validado em dispositivos reais e documentação atualizada.

## Sequenciamento e dependências

| Ordem | Ciclo | Prioridade | Dependência | Estimativa |
| --- | --- | --- | --- | --- |
| 1 | Mesa responsiva | P0 | CI base aprovado | 2–4 dias |
| 2 | Identidade visual | P1 | Ciclo 1 | 2–3 dias |
| 3 | Animações | P1 | Ciclos 1–2 | 3–5 dias |
| 4 | Multiplayer/PWA | P0/P1 | Pode iniciar em paralelo ao 2–3, com QA integrado | 2–4 dias |
| 5 | Competitivo | P2 | Estabilidade do ciclo 4 | 4–7 dias |
| 6 | Lançamento | P1 | Ciclos anteriores | 3–5 dias |

Estimativas indicativas, não compromissos de prazo.

## Ritual de execução e atualização deste documento

Para cada ciclo: (1) investigar; (2) registrar causa e solução; (3) implementar em pequenos commits; (4) testar localmente e no CI; (5) comparar capturas antes/depois; (6) corrigir regressões; (7) atualizar a seção de evidências abaixo.

### Registro de evidências

| Ciclo | Status | Commit(s) | CI | Capturas / observações |
| --- | --- | --- | --- | --- |
| Base de responsividade | Validado automaticamente | [6e26711](https://github.com/AndreRuperto/truco/commit/6e26711d56420212a92d97be896f7f29464ca46c), [48a01e1](https://github.com/AndreRuperto/truco/commit/48a01e19ebcb538167f509150fd2670fe4a821f4) | [Aprovado](https://github.com/AndreRuperto/truco/actions/runs/42712854930) | Inspeção visual final ainda pendente |
| 1 — Mesa | Não iniciado | — | — | — |
| 2 — Temas | Não iniciado | — | — | — |
| 3 — Animações | Não iniciado | — | — | — |
| 4 — Multiplayer/PWA | Não iniciado | — | — | — |
| 5 — Competitivo | Não iniciado | — | — | — |
| 6 — Lançamento | Não iniciado | — | — | — |

## Próxima ação concreta

Iniciar o **ciclo 1** pela auditoria do layout real e dos estilos computados. Não alterar novas alturas no escuro: primeiro medir a mesa e os controles nos breakpoints-alvo, depois aplicar mudanças proporcionais e testar.
