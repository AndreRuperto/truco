# Próximos passos — Truco

## 2026-11-12 (tarde) · branch `claude/mvp-f2-visual` — Fase 2 EM ANDAMENTO (wip, não testado por completo)

Fases 0 e 1 do plano MVP (`docs/plans/2026-11-12-plano-mvp.md`) concluídas e em produção (PRs #18, #21, #22, #23).
A branch `claude/mvp-f0-checklist` (checklist da F0 + plano versionado) ainda não tem PR.

Feito na F2 (commit wip desta branch):
- F2.1 etiqueta de família: z-index (etiqueta acima do balão, cartas abaixo da cruz), topo ancorado pela direita, laterais fora da faixa do meio, estreitas em ≤ 380px. E2E: 15/15 em --repeat-each 3.
- F2.4 janela de família em UMA linha no rodapé (mesa-mobile.css). Provado: sem a correção 2/2 falham (rodapé 144px), com ela 10/10 passam.
- F2.3 desktop: layout de notebook até 959px de altura (sem rolagem em 1440x900); dica em 146px só em telas > 520px de altura.
- F2.6 no máximo 2 balões em ≤ 340px (`baloesAtivos(..., maximo)`, teste unitário).
- Testes novos em `apps/web/e2e/qa-visual-mesa.spec.ts` (seção "Fase 2").

Estado / pendente:
- [ ] Última rodada: falhas a investigar — "dica não cobre placar... 430x932" (dica não encontrada, provável timing) e "desktop... 1280x800" (não chegou à vez a tempo). Rodar de novo isolado; podem ser instabilidade.
- [ ] F2.2 em 320x568: a dica (~94px) não cabe sem cobrir o centro (sobra 55px). Decidir: marcar `test.fail` com justificativa P3 ou redesenhar a dica.
- [ ] F2.5 (nome de cima x monte) e A3 (zoom 200%) não reproduzidos: registrar.
- [ ] F2.6: rodar o teste de balões com --repeat-each 30 em 320px.
- [ ] F2.7 temas, F2.8 telas fora da mesa, F2.9 itens da loja no 3D, F2.10 QA independente (subagente).
- [ ] Gate completo, capturas depois (antes estão no scratchpad da sessão, não versionadas), PR.

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
