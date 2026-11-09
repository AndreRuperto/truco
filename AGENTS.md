# Truco — instruções para agentes de Design, Frontend e QA

Este repositório usa um piloto do Guia de Design & Frontend para IA v2.0.
Antes de modificar a UI, leia [o protocolo do piloto](docs/qa-frontend/PILOTO.md) e os testes existentes.

## Contexto real do projeto

- Monorepo pnpm: interface React/TypeScript/Vite em apps/web; servidor Colyseus em apps/server; regras em packages/engine.
- Preserve a identidade de boteco (madeira, feltro, lousa, giz), os tokens existentes em apps/web/src/estilos.css e as visualizações personagens, cadeiras e 3D.
- O comportamento de partidas e reconexão depende do servidor: não refatore protocolo/regras ao corrigir somente CSS.
- Consulte apps/web/src/mesa-mobile.css e apps/web/e2e antes de mudar dimensões de mesa ou responsividade.
- Não introduza framework CSS, design system ou dependências novas sem justificar necessidade, manutenção e regressão.

## Passagem obrigatória por três papéis

**Designer Sênior:** identifique público, hierarquia, identidade visual, rotas, variações e estados. Registre o problema atual, hipóteses de solução e critérios mensuráveis; não apresente gosto pessoal como evidência objetiva.

**Desenvolvedor Frontend Sênior:** aplique a menor mudança coerente com os componentes e tokens existentes. Preserve acessibilidade, teclado, toque, responsividade e regras de negócio. Crie/atualize testes de regressão para o comportamento alterado.

**QA Visual e UX:** examine a mudança novamente, usando viewport e altura (não só largura), modos de visualização, teclado, zoom e temas quando disponíveis. Compare antes/depois por capturas reais; registre resultado, limitações e regressões. Uma revisão pelo mesmo modelo não equivale a validação independente feita por outra pessoa/agente.

**Orquestrador:** bloqueie aprovação de P0/P1 sem evidência; diferencie observação, hipótese e teste não executado. Faça handoff explícito entre papéis, com arquivos alterados e rollback.

## Gate de entrega

1. Inventário do que mudou e por quê.
2. Evidências de execução de testes e screenshots quando possíveis; nunca invente aprovação.
3. Checagem de responsividade em 320x568, 360x640, 360x740, 390x844 e 430x932, além de desktop.
4. Verificação das vistas personagens/cadeiras e, onde possível, 3D; comportamento de sala/partida permanece intacto.
5. Registro de acessibilidade, erros visíveis, falhas de carregamento e pendências.
6. Nenhum rótulo "10/10", "sem bugs" ou "acessível" sem benchmark e dados reais.

Comandos a executar em ambiente com dependências instaladas:
- pnpm --filter @truco/web typecheck
- pnpm --filter @truco/web test
- pnpm --filter @truco/web exec playwright test e2e/layout-mobile.spec.ts e2e/qa-visual-mesa.spec.ts
- pnpm test:e2e

Se a infraestrutura de execução não estiver disponível, marque como NAO_EXECUTADO.
