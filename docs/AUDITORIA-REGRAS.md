# Auditoria das regras do Truco — 09/11/2026

> Revisão estática de `packages/engine/src/{regras,estado,reducer,mao,forca,cartas,familia,visao}.ts`, `apps/server/src/mesa/protocolo.ts`, `apps/web/src/componentes/Manual.tsx` e testes de mãos especiais. **Não equivale à execução da suíte.** Regras de truco variam por região; os itens abaixo separam a implementação de convenções regionais.

## Regras verificadas no código

| Área | Implementação atual | Situação |
| --- | --- | --- |
| Vitória | Primeiro a alcançar **12 ou mais** pontos encerra a partida | Coerente |
| Pontuação paulista | 1 → 3 → 6 → 9 → 12 | Coerente com a configuração escolhida |
| Pontuação mineira | 2 → 4 → 8 → 10 → 12 | Configuração específica; pode variar regionalmente |
| Baralho | 40 cartas, sem 8, 9, 10 | Coerente |
| Manilhas paulistas | Próximo valor da vira; naipes paus > copas > espadas > ouros | Coerente |
| Manilhas mineiras | 4♣ > 7♥ > A♠ > 7♦ | Coerente |
| Cartas comuns | 3 > 2 > A > K > J > Q > 7 > 6 > 5 > 4 | Coerente |
| Distribuição | Três cartas por pessoa, até três rodadas | Coerente |
| Rodada empatada | Regras de desempate pela primeira rodada vencedora; três empates sem pontos | Coerente com a variante adotada |
| Truco | Só permitido a partir da segunda rodada; aceitar, correr ou aumentar | **Regra personalizada**: em muitas mesas reais é possível pedir na primeira rodada |
| Carta coberta | Permitida da segunda rodada em diante; força zero | **Regra personalizada**: confirmar com a referência desejada |
| Mão de dez | Dupla com 10 escolhe jogar valendo truco ou correr cedendo pontos base | Coerente com implementação; sem pedido adicional |
| Mão de onze | Conforme configuração: qualquer dupla com 11 ou apenas 11×11; cartas ocultas, sem pedido e valendo primeiro nível de truco | **Correção aplicada** no motor; manual atualizado nesta auditoria |
| Família | Aberta/fechada, janela antes da primeira carta, regras de conferência e pontuação | Implementação customizada; exige testes adicionais |
| Mão limpa | Mineiro: 29 cartas incluindo três manilhas baixas e dois coringas | Variante personalizada |
| Embaralhar/cortar | Ritual com até 20 embaralhadas e até três movimentos no corte | Variante personalizada |
| Cangada | Empilhamento após empate da primeira rodada | Variante personalizada |

## Problemas e riscos identificados

1. **[Corrigido] Manual contradizia o motor na mão de onze**: informava 1/2 pontos, mas a mão passa a valer 3/4. Alterado em `Manual.tsx`.
2. **[Decidido: D2, manter] Truco somente após a primeira rodada**: o motor bloqueia pedidos na primeira rodada (`pedirTruco`). Regra da casa; o manual diz isso explicitamente desde 2026-11-12 (`apps/web/test/manual.test.tsx`).
3. **[Decidido: D3, manter] Mão de onze**: às cegas e valendo o 1º nível de truco (3/4), inclusive na ranqueada. O manual a apresenta como regra desta casa, não como universal.
4. **[Testado em 2026-11-12] Pontos de família no meio da mão**: `packages/engine/test/familia-placar.test.ts` (11 casos): placar 9, 10 e 11 nas duas escadas; família que leva a 10/11 no meio da mão não muda o tipo da mão (fecha só truco e família); duas famílias somam; 8 → 10 → 12 e 11 + base encerram a partida na hora. O motor já se comportava assim: nenhuma linha de `packages/engine/src` mudou.
5. **[Testado em 2026-11-12] Empates**: `packages/engine/test/empates.test.ts` (18 casos): E,V; E,E,V; E,E,E; V,E; V,D,E; E,D; D,E jogados pelo reducer no paulista e no mineiro, conferindo quem leva, pontos, próximo pé, cangada depois do 1º empate e ausência de cangada depois de uma rodada vencida. A tabela pura continua em `mao.test.ts`.
6. **[Testado em 2026-11-12] Limites de aposta**: `truco.test.ts`: correr em cada nível (1 a 4) nas duas escadas e doze aceito sem novo pedido. Bloqueio na mão de 10 e na de ferro e bloqueio de quem fez o último aumento já estavam em `maos-especiais.test.ts`, `truco.test.ts` e `extras.test.ts`.
7. **[Testado em 2026-11-12] Mão de onze na escada 2-4-8-10-12**: `maos-especiais.test.ts`: vale 4; no 10 a 11 tem precedência sobre a mão de 10 e a vitória de quem tem 10 encerra a partida; `onzeAOnze` só no 11 a 11.
8. **[Executado em 2026-11-12] Suíte de testes e E2E**: ver o gate no PR da fase 1 e em `docs/release/checklist-mvp.md`. Os testes novos foram conferidos com 4 mutações no motor (família sem fim em 12, V,E invertido, correr pagando o nível pedido, mão de ferro valendo a base): todas derrubaram testes.

## Decisões (plano MVP, `docs/plans/2026-11-12-plano-mvp.md`, seção 4)

- **D2:** truco na 1ª rodada continua bloqueado (regra da casa, explicada no manual).
- **D3:** mão de onze valendo 3/4 e às cegas continua, inclusive na ranqueada.
- **D4:** família, mão limpa, cangada e ritual continuam como opções por variante, como estão.
- O modo padrão preserva as variações atuais (consequência de D2 a D4).

Lacunas do manual encontradas na revisão de 2026-11-12 e corrigidas: na mão de ferro não há cangada; no 10 a 11 vale a mão de 11; pontos de família no meio da mão podem encerrar a partida e fecham truco e família quando levam a 10/11.

## Critério de conclusão

Executar typecheck, testes de engine, integração do servidor e E2E. Para cada regra configurável, acrescentar testes de transição de placar, permissões de ação e finalização; revisar o manual junto com qualquer alteração no motor.
