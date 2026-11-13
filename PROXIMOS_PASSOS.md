# Próximos passos — Truco

## 2026-11-13 · branch `claude/mvp-f4-competitivo` · Fase 4 pronta para o gate

Fases 0 a 3 estão em produção. Fase 4 (competitivo, integridade e segurança) com F4.1 a F4.9 feitos e testados:
- [x] F4.1 Elo congelado no mesmo grupo em 24 h (0006) · [x] F4.2 e-mail canônico (0007) · [x] F4.3 integridade
- [x] F4.4 avatar fora do estado (240 kB → < 8 kB) · [x] F4.5 limites por IP · [x] F4.6 auditoria (0008)
- [x] F4.7 admin da loja na interface · [x] F4.8 estorno de Pila · [x] F4.9 histórico com a marca
- [x] Migrações 0006–0008 testadas sobre um banco com dados · [x] relatório de segurança: SEC-03 e SEC-09 corrigidos
- [ ] Gate completo (E2E) e PR; merge só com o "pode" (aplica 3 migrações em produção).

Numeração das migrações diferente do plano: 0006 Elo congelado, 0007 e-mail canônico, 0008 auditoria.

## 2026-11-13 · branch `claude/mvp-f3-animacoes` · Fase 3 pronta para revisão

Fases 0, 1 e 2 estão em produção. A Fase 3 (animações e sensação de jogo) está com o gate local verde e um PR aberto esperando o "pode" (o merge dispara o deploy). Detalhes e números: `docs/qa-frontend/animacoes-2026-11.md`.

Pendências registradas:
- [ ] Desempenho 2D com a CPU 4x mais lenta: de 3 a 5 quadros acima de 100 ms por mão (meta: nenhum). Falta um perfil de CPU com atribuição das tarefas longas.
- [ ] Desempenho 3D: 12,3 FPS no headless com WebGL em software (meta: 30). Medir em aparelho real (Fase 7).
- [ ] QA independente da Fase 3 (não feito).
- [ ] Pendências da Fase 2: dica sobre o centro em 320/360×640 (P3), painel "Ordem" sobre o placar no desktop (P2), balões 3D laterais fora do quadro (P2).
- [ ] PR da branch `claude/mvp-f0-checklist`.

Próximo: Fase 4 (competitivo, integridade e segurança restante), branch `claude/mvp-f4-competitivo`.

## 2026-11-16 · branch `claude/mvp-f2-visual` · Fase 2 pronta para revisão

Fases 0 e 1 estão em produção. Fase 2 (acabamento visual e temas) concluída, com o gate local verde e um PR aberto esperando o "pode" do André (o merge dispara o deploy). Critérios, resultado do QA independente e resposta a cada achado: `docs/qa-frontend/qa-fase2-2026-11.md`.

Pendências registradas (não bloqueiam a fase):
- [ ] P3: em 320×568 e 360×640, a dica de 3 linhas cobre o centro da mesa. Precisa redesenho (por exemplo, recolher quando houver carta na mesa). O teste está como `test.fail`.
- [ ] P2: no desktop, o painel "Ordem" aberto cobre "Nós" e o placar (A3, anterior à branch).
- [ ] P2: na vista 3D, os balões das cadeiras laterais saem do quadro (A5, anterior à branch).
- [ ] P3: no desktop, a dica cobre o nome de cima; em 320×568, o botão "Ordem" encosta na etiqueta de cima (A4, A10).
- [ ] Reteste pelo QA independente depois das correções (não foi feito).
- [ ] PR da branch `claude/mvp-f0-checklist` (checklist da F0).

Próximo: Fase 3 (animações e sensação de jogo), na branch `claude/mvp-f3-animacoes`, depois do merge da F2.

---

Atualizado em 2026-11-10.

## Branches e PRs em aberto

| Branch | PR | O que é | Estado |
|---|---|---|---|
| `claude/ciclo1-fechamento` | #18 | Fecha o Ciclo 1 (paisagem/zoom sem rolagem horizontal; foco visível no "Truco!" e nas cartas) | verificação local verde; aguardando merge |
| `claude/ciclo4-reconexao` | #19 | Ciclo 4: prazo para quem cai, mesa visível na queda, aviso na volta, sala encerrada, aba aberta no deploy | verificação local verde (40 E2E); aguardando merge |
| `claude/seguranca` | (abrir) | Auditoria de segurança e correções | ver `docs/seguranca/auditoria-2026-11-10/relatorio.md` |

O CI do GitHub Actions está sem minutos até virar o ciclo de cobrança: o gate é a verificação local (`pnpm -r typecheck`, `pnpm -r test`, `pnpm --filter @truco/web build`, `pnpm test:e2e`).

## O que foi feito nesta sessão

- **Ciclo 1 (mesa responsiva):** concluído. Auditoria, P0/P1/P2 corrigidos, 2 rodadas de QA independente. O fechamento foi refeito depois da perda do HD externo.
- **Ciclo 4 (reconexão e PWA):** 5 passos no #19.
- **Segurança:** 6 achados confirmados e corrigidos (ban derruba WebSocket, link mágico fora do log, cabeçalhos com CSP, limite no login, Host escapado, `.env*`), 1 decisão pendente (conluio na ranqueada) e 2 potenciais de baixa severidade.

## Próximos passos (em ordem)

- [ ] Mergear #18, #19 e o PR de segurança (independentes; resolver conflito trivial no roadmap se aparecer).
- [ ] **Railway:** conferir `RESEND_API_KEY` (sem ela, o login por e-mail para de funcionar em produção depois do PR de segurança), `NODE_ENV=production` e `ADMIN_EMAILS`.
- [ ] Depois do deploy: testar o login com Google sob a nova CSP; `curl -I https://<site>/` para conferir os cabeçalhos.
- [ ] Decidir a regra contra conluio na ranqueada (proposta no relatório de segurança, SEC-03).
- [ ] Ciclo 4: teste em celular real (trocar de app na própria vez e ver se o socket cai).
- [ ] Ciclo 2 (temas, mesas e modos): pendências P2/P3 do Ciclo 1 (etiqueta de família, layout de paisagem, dica sobre o centro em 320 px, desktop 1440×900 rolando 35 px).
- [ ] Baixa prioridade: limpar o cache de `/assets` entre deploys; avatar repetido em cada estado; limites por IP em `/api/perfil/:id` e na criação de salas; trilha de auditoria.

## Loja com duas moedas — branch `claude/loja` (worktree `C:/projetos/truco-loja`), 2026-11-11

Design: `docs/plans/2026-11-11-loja-duas-moedas-design.md` · Plano: `docs/plans/2026-11-11-loja-duas-moedas.md` · Base legal: `docs/legal/modo-apostado-2026-11.md`.
A branch sai de `claude/seguranca` (inclui os commits de segurança ainda sem merge).

**Feito (tarefas 1–14 do plano):**
- **Fichas** (ganhas: 1.000 no cadastro, +100 por dia, resgate para 500 abaixo de 100; apostadas como cacife) e **Pila** (só comprado pela InfinitePay; só para itens). Não existe conversão entre elas: todo saldo passa por `movimentar` com extrato (`lancamentos`) e `CHECK >= 0`.
- Cacife: casual/privada (dono escolhe 0/50/100/250/500/1000; exige conta e saldo; os humanos sentam como adversários) e ranqueada (pela patente mais alta). O efetivo é o menor saldo, debitado no início; o pote vai para quem ficou na dupla vencedora; abandono perde; desligamento e órfã devolvem; anti-fazenda depois de 5 ranqueadas iguais em 24 h.
- Loja `#/loja` (verso, roupa, moldura, avatar, tampo, pacotes de Pila), retorno `#/loja/obrigado`, saldo no cabeçalho, verso de quem dá as cartas, roupa e moldura na mesa.
- InfinitePay: `LOJA_PAGAMENTO=on` + `INFINITEPAY_HANDLE` (+ `INFINITEPAY_API_KEY` opcional). Webhook e retorno só apontam o pedido; quem confirma é o `payment_check`. **Desligado por padrão.**
- Verificação local em 2026-11-11: `pnpm -r typecheck` ok; `pnpm -r test` ok (servidor 406, web 404, engine 233); `pnpm --filter @truco/web build` ok; `pnpm test:e2e` 37 passaram e 9 pulados (os de auditoria, que só rodam com variável própria). `e2e/loja.spec.ts` cobre checkout simulado, compra e equipamento, mesa com cacife e a loja sem rolagem horizontal de 320×568 a 1280×800.

**Pendente:**
- [ ] Revisar e abrir o PR de `claude/loja` (depois do merge do PR de segurança, ou junto com ele).
- [ ] **Antes de `LOJA_PAGAMENTO=on`:** advogado (modelo, Fichas na ranqueada, termos da loja em `TermosLoja`, ECA Digital e caixas para menores), confirmação **por escrito** da InfinitePay sobre vender moeda virtual de jogo, contador (nota e tributos), teste real com R$ 4,90 e estorno.
- [ ] Painel de admin: aba de pedidos e ajuste de saldo na interface (hoje só pela API: `GET /api/admin/pedidos`, `POST /api/admin/usuarios/:id/ajuste`).
- [ ] Vista 3D: verso e roupa equipados ainda não aparecem no 3D (só no 2D personagens/cadeiras).
- [ ] Estorno vindo do webhook (`refunded`) ainda não desconta o Pila sozinho: hoje é pelo ajuste de admin.
- [ ] QA visual independente (outro agente ou pessoa) da loja e da mesa com cacife, como pede o `AGENTS.md`.

## Comandos úteis

```bash
pnpm install --frozen-lockfile
pnpm -r typecheck && pnpm -r test
pnpm --filter @truco/web build && pnpm test:e2e
TRUCO_AUDITORIA=1 pnpm --filter @truco/web exec playwright test e2e/auditoria-mesa.spec.ts
```
