# Próximos passos — Truco

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

## Em andamento: loja com duas moedas (brainstorming, 2026-11-10)

Análise legal em `docs/legal/modo-apostado-2026-11.md` (modo apostado com dinheiro real: **não pode**).
Decisões já tomadas com o dono:
- Duas moedas **sem ponte entre elas**: **Ouro** (comprada em reais, só para a loja, nunca apostada, nunca transferida, sem saque) e **Fichas** (só ganhas jogando, nunca vendidas nem de brinde em compra).
- Cobrança já na primeira entrega pela **InfinitePay Checkout Integrado**: `POST https://api.checkout.infinitepay.io/links` (handle ou `X-Api-Key`, items em centavos, `order_nsu`, `redirect_url`, `webhook_url`). O webhook **não tem assinatura**, então é preciso confirmar com `POST /payment_check` (handle, order_nsu, transaction_nsu, slug). Não há sandbox (teste real de R$ 1,00 e estorno pelo app). Estorno não existe na API. Mínimo de R$ 1,00. Docs: https://www.infinitepay.io/checkout-documentacao
- Catálogo v1: verso do baralho, roupa do personagem, avatar e moldura, tampo da mesa (só visual, sem vantagem).
- Fichas apostáveis em **mesas casuais/privadas e na ranqueada** (cacife). Atenção ao conluio (SEC-03) e à regra de mesa com bot.

- [ ] Continuar o brainstorming: ganho de Fichas (vitória, diária, piso quando zerar), cacife por mesa/patente, anticonluio, preços dos pacotes de Ouro.
- [ ] Apresentar o design em seções, gravar em `docs/plans/2026-11-1x-loja-duas-moedas-design.md` e escrever o plano (superpowers:writing-plans).
- [ ] Implementar: tabelas (saldos, inventário, pedidos, lançamentos/ledger), rotas da API, webhook + payment_check idempotente, loja na web, cacife no servidor da mesa, testes.
- [ ] Antes de ligar a cobrança: advogado + confirmação por escrito da InfinitePay; termos de uso e política de reembolso (CDC art. 49).

## Comandos úteis

```bash
pnpm install --frozen-lockfile
pnpm -r typecheck && pnpm -r test
pnpm --filter @truco/web build && pnpm test:e2e
TRUCO_AUDITORIA=1 pnpm --filter @truco/web exec playwright test e2e/auditoria-mesa.spec.ts
```
