# Relatório — auditoria de segurança do Truco (2026-11-10)

Escopo e autorização: [escopo.md](escopo.md). Matriz por controle: [matriz.csv](matriz.csv).

**Modalidade:** C (código), com confirmação no ambiente local (B, contas sintéticas). A produção **não** foi testada. **Base:** `master` @ `a77830b`; as correções estão no branch `claude/seguranca`. A revisão do código foi feita em três frentes paralelas, cada uma por um subagente de leitura (identidade/sessão/admin, API e front-end, salas/ranking/segredos/dependências). Todo achado foi conferido depois no código e, quando possível, com teste que falha antes da correção.

## Cobertura (`resumir_cobertura.py`)

| Controles catalogados | Aplicáveis | Executados | Com evidência conclusiva | Confirmados | Potenciais | Não testados |
|---|---|---|---|---|---|---|
| 44 | 31 | 28 (90,3%) | 26 (83,9%) | 6 | 2 | 3 |

O indicador vale só para o catálogo da skill e **não** mede conformidade com o ASVS inteiro. Os 13 controles não aplicáveis estão justificados na matriz (sem IA/agentes, sem organizações, sem BaaS, sem GraphQL, sem webhooks, sem operações em lote, sem SSRF).

## Achados, do mais grave para o menos grave

| ID | Severidade | Situação | Achado | Correção |
|---|---|---|---|---|
| SEC-01 (WEB-05) | média | confirmado (prova estática) e corrigido | Banir apagava as sessões HTTP, mas os WebSockets já abertos continuavam. O `reconnect` do Colyseus não passa pelo `onAuth`, e a cadeira ficava guardada por 300 s. O banido terminava a partida (inclusive ranqueada) e reconectava a cada queda. | `a1d7962`: o ban derruba a conta de toda mesa e fila viva com o código 4021, sem guardar cadeira (vira abandono), e recusa a reconexão pendente. O cliente vai ao início com "Sua conta foi suspensa." |
| SEC-02 (ID-01) | média (depende da configuração) | confirmado e corrigido | Em produção sem `RESEND_API_KEY`, o link mágico, com o token de login, era impresso no log do servidor. Quem lesse o log entraria em qualquer conta, inclusive a de admin. | `c6ec0f9`: em produção o envio pelo console registra só o destinatário e o assunto. **Efeito:** sem a chave, o login por e-mail não funciona em produção. |
| SEC-03 (ranking) | média | **corrigido em 2026-11-13 (decisão D1 do plano MVP)** | Conluio na ranqueada: o pareamento só separa a mesma conta (`fila/fila.ts:250-255`). Aliases `+tag` de e-mail viravam contas novas. Uma pessoa com duas contas e duas abas conseguia se enfrentar e inflar o topo do ranking. | **D1a** (`11d7a6c`): a partir da 6ª ranqueada com o mesmo conjunto de contas em 24 h, a partida vale mas o Elo e os pontos não mudam (`ranking/mesmoGrupo.ts`, migração `0006_elo_congelado`); a tela de fim e o histórico avisam. **D1b** (`93ac908`): conta nova não pode repetir o e-mail canônico de outra (sem `+tag`), por link mágico ou Google; contas antigas continuam entrando (migração `0007_email_canonico`). Ficam fora do MVP: mínimo de adversários distintos e o piso 0 dos pontos (mantido). Testes: `repo-partidas`, `repo-usuarios`, `http-auth`, `registro-mesa`. |
| SEC-04 (WEB-07) | baixa | confirmado e corrigido | Nenhum cabeçalho de segurança: sem CSP, sem proteção contra enquadramento, sem nosniff, Referrer-Policy ou HSTS. | `f9db0af`, aplicado à página, aos estáticos e à API: CSP estrita (scripts só do site, do Google e dos inline pelo hash; sem `unsafe-eval`; `object-src`/`base-uri` `'none'`; `frame-ancestors 'none'`), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP e HSTS em produção. Validado no navegador contra o build com 0 violações. |
| SEC-05 (ID-04) | baixa | confirmado e corrigido | `/auth/link/confirmar` e `/auth/google` não tinham limite de pedidos. | `390ad59`: 30 por IP a cada 15 min; o Google não é chamado depois do limite. |
| SEC-06 (COD-04) | baixa | confirmado (reproduzido) e corrigido | Sem URL pública (só fora de produção), o Host do pedido entrava cru no `og:image` do `index.html` e injetava HTML. | `390ad59`: escapado. |
| SEC-07 (INF-04) | baixa | confirmado e corrigido | `.gitignore`/`.dockerignore` ignoravam só `.env`, então `.env.local` ou `.env.production` seriam versionados. Nenhum segredo encontrado no código nem nos 497 commits. | `390ad59`: `.env*` com `!.env.example`. |
| SEC-08 | baixa | confirmado e corrigido | `TRUCO_TEMPOS=rapido` valia em produção, por erro de configuração (prazos de 3 s). | `390ad59`: ignorado com `NODE_ENV=production`. |
| SEC-09 (API-04/API-07) | baixa | **corrigido em 2026-11-13** | O avatar de convidado (até 60 kB) era repetido em cada `estado` para cada jogador. Não havia limite de salas criadas por IP nem limite em `/api/perfil/:id`. | Avatar (`8f200f2`): o `estado` leva só `avatarId`; a foto vai uma vez na mensagem `avatares` (mesa com 4 fotos: de 240 kB para menos de 8 kB por `estado`). Limites (`9dca12b`): 120 leituras por IP por minuto somando perfil, ranking, salas e catálogo; 20 criações de mesa por IP a cada 10 min no `onAuth`. Testes: `mesa-avatares`, `http-dados`, `mesaroom-auth`. Não testado sob carga. |

## Verificação local das correções (CI sem minutos)

`pnpm -r typecheck` ✅ · `pnpm -r test`: engine 233/233, servidor 357/357, web 395/395 ✅ · `pnpm --filter @truco/web build` ✅ · `pnpm audit --prod`: nenhuma vulnerabilidade conhecida ✅ · `pnpm test:e2e`: 35 aprovados, 9 pulados (auditorias sob demanda), 0 falhas ✅. Inclui a ranqueada (link mágico, fila e abandono custando Elo) e as partidas com 2 e 4 humanos.

## O que foi conferido e está ok (amostra)

- **Admin:** só pelo servidor, com o papel vindo de `ADMIN_EMAILS`.
- **Link mágico:** 256 bits, 15 min, uso único atômico, só o hash no banco e o token no fragmento da URL.
- **Cookie de sessão:** `HttpOnly`, `SameSite=Lax`, `Secure` em produção.
- **CSRF:** não-GET exige JSON, o que força o preflight.
- **Sem injeção nem XSS:** sem SQL injection (Drizzle parametrizado), sem XSS (React sem HTML cru) e sem path traversal.
- **Dados de outra conta:** nenhum. O perfil público não tem e-mail.
- **Avatar:** só jpeg, png ou webp, com a assinatura do arquivo conferida.
- **Salas:**
  - o cliente não age pela cadeira de outro nem vê cartas alheias;
  - cada mensagem é validada;
  - flood acima de 20 mensagens por segundo derruba o cliente.
- **Ranking:** vitória e abandono não são registrados duas vezes.
- **Dependências:** `pnpm audit --prod` com 0 vulnerabilidades.
- **Segredos:** nenhum no repositório nem no histórico.

## Não testado e limitações

- **Produção:** TLS, cabeçalhos realmente servidos pelo Railway, valores de `NODE_ENV`, `RESEND_API_KEY`, `ADMIN_EMAILS` e `TRUCO_ORIGENS`, banco, backups e logs. Exigem autorização separada para teste externo.
- **Login com Google sob a nova CSP:** não exercitado, por falta de `GOOGLE_CLIENT_ID` local. As origens seguem o que o Google Identity Services exige. Testar em staging ou produção logo depois do deploy.
- **Trilha de auditoria (INF-03):** não revisada. Hoje há só `console.log` de ban e desban.
- **Busca de segredos:** por padrões, sem gitleaks ou trufflehog. Varreduras automáticas de dependências só cobrem avisos já conhecidos.
- **Revisão independente:** os três revisores e quem corrigiu são o mesmo modelo. Isso não substitui revisão humana nem um teste de intrusão externo.

## Corrigir primeiro (o que sobra)

1. ~~Decidir a regra contra conluio na ranqueada (SEC-03).~~ Decidida (D1) e aplicada em 2026-11-13.
2. **Conferir no Railway:** `RESEND_API_KEY` definida (senão o login por e-mail para de funcionar com SEC-02); `NODE_ENV=production`; `ADMIN_EMAILS` só com e-mails seus.
3. **Depois do deploy:** testar o login com Google sob a CSP e conferir os cabeçalhos (`curl -I https://<site>/`).
