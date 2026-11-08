# Truco Online — plano de qualidade 10/10

Este documento é um plano de execução, não uma declaração de funcionalidades concluídas.

## Critérios para considerar o produto pronto

- Interface utilizável em 320, 360, 390, 430 px e desktop, sem rolagem horizontal indesejada.
- Navegação por teclado, foco visível, rótulos acessíveis e suporte a movimento reduzido.
- Partidas completas em todas as variantes com regras cobertas por testes.
- Queda de rede, recarga e reconexão com estado consistente e mensagens compreensíveis.
- Salas públicas, privadas e ranqueadas testadas com dois ou mais clientes reais.
- Nenhuma ação de jogo duplicada por toque duplo ou reconexão.
- Testes unitários, integração e E2E executados no CI.
- Logs de erros e métricas sem registrar tokens ou dados sensíveis.
- Política clara de privacidade e retenção de dados antes do lançamento.
- Teste com jogadores reais, bugs críticos corrigidos e desempenho medido em celular.

## Etapa 1 — Estabilidade e polimento mobile (P0)

- [ ] Auditar telas de início, salas, perfil, ranking, espera e mesa em 320–430 px.
- [ ] Corrigir overflow, alvos de toque e áreas seguras do PWA.
- [ ] Adicionar testes Playwright de responsividade e navegação.
- [ ] Auditar todos os fluxos de saída de veículo/mesa, refresh e retomada.
- [ ] Testar reconexão Colyseus com perda de conexão e token expirado.
- [ ] Verificar regras e sincronização entre servidor e clientes.

## Etapa 2 — Sensação de jogo (P1)

- [ ] Aprimorar animações de embaralhar, distribuir, jogar e recolher cartas.
- [ ] Garantir consistência entre visão superior, cadeiras e temas.
- [ ] Ajustar duração das animações e permitir movimento reduzido.
- [ ] Adicionar feedback visual e sonoro configurável sem atrasar ações.
- [ ] Testar desempenho em aparelhos móveis de entrada.

## Etapa 3 — Competitivo e retenção saudável (P1)

- [ ] Definir regras transparentes de temporadas e ranking.
- [ ] Estatísticas de partidas, vitórias, variantes e histórico.
- [ ] Conquistas e itens cosméticos sem vantagem competitiva.
- [ ] Prevenção de abandono abusivo e resultados inconsistentes.
- [ ] Moderação e segurança de interações entre jogadores.

## Etapa 4 — Operação e lançamento (P0)

- [ ] CI: lint, typecheck, testes, build e E2E.
- [ ] Alertas de falhas, latência e disponibilidade.
- [ ] Revisão de dependências e vulnerabilidades.
- [ ] Rate limits e validação de entradas no servidor.
- [ ] Backup, restauração e migrações do banco testados.
- [ ] Política de privacidade e acessibilidade revisadas.
- [ ] Beta com jogadores reais e checklist de regressão.

## Ordem de trabalho

1. Corrigir bugs reproduzíveis e adicionar teste de regressão.
2. Fechar critérios P0 antes de recursos cosméticos.
3. Entregar P1 em mudanças pequenas e verificáveis.
4. Medir resultados reais antes de atribuir nota 10/10.
