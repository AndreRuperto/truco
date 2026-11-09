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
2. **[Validar com o dono do produto] Truco somente após a primeira rodada**: o motor bloqueia pedidos na primeira rodada (`pedirTruco`), e o manual explica essa restrição. Não alterar sem decidir se é uma regra deliberada.
3. **[Validar com o dono do produto] Mão de onze**: a regra de 3 pontos e cartas às cegas é uma escolha deste produto; não deve ser apresentada como universal para todo Truco Paulista.
4. **[Testar] Pontos de família no meio da mão**: `pontuarFamilia` pode mudar o placar, e `tipoPeloPlacar` é consultado novamente para restringir truco/família. Adicionar casos com placares 9/10/11, vitórias imediatas e famílias consecutivas.
5. **[Testar] Empates**: cobrir todas as combinações de três rodadas, inclusive empates nas duas primeiras e vitória na terceira, e a cangada após o primeiro empate.
6. **[Testar] Limites de aposta**: verificar o resultado de correr em cada nível, aumentos alternados e bloqueio de pedidos em mãos especiais.
7. **[Testar] Mão de onze em escada mineira customizada**: confirmar 4 pontos e encerramento em placar 10×11, além de `onzeAOnze`.
8. **[Executar] Suíte de testes e E2E**: auditoria estática não comprova funcionamento em produção; conferir CI e partidas reais.

## Decisões pendentes

- O modo padrão deve seguir regras regionais tradicionais ou preservar as variações atuais?
- Permitir truco na primeira rodada?
- A mão de onze deve continuar obrigatoriamente valendo 3/4 pontos, inclusive no modo ranqueado?
- Família, mão limpa, cangada e ritual de corte devem ser opcionais ou padronizados por variante?

## Critério de conclusão

Executar typecheck, testes de engine, integração do servidor e E2E. Para cada regra configurável, acrescentar testes de transição de placar, permissões de ação e finalização; revisar o manual junto com qualquer alteração no motor.
