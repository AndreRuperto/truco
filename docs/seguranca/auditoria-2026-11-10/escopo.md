# Auditoria de segurança — Truco (2026-11-10)

## Termo de escopo e autorização

- **Avaliação ID:** truco-seg-2026-11-10
- **Responsável pela organização:** dono do repositório `AndreRuperto/truco` (pedido no chat: "eu quero esse site o mais seguro possível").
- **Evidência e data de autorização:** pedido do dono em 2026-11-10, nesta sessão. Cobre o **código** e o **ambiente local descartável**. **Não** cobre testes ativos contra o site em produção (exigem autorização separada).
- **Objetivo e tipo:** modalidade **C (código)**, com confirmação em runtime **local** (modalidade B, contas sintéticas).
- **Ativos autorizados:** repositório `AndreRuperto/truco`, branch `master` @ `a77830b` (código em produção). O PR #19 (`claude/ciclo4-reconexao`) ainda não está mergeado e não altera autenticação nem API.
- **Ambiente:** desenvolvimento local (`127.0.0.1`), banco PGlite em memória (`TRUCO_PGLITE=memoria`), caixa de e-mail de teste.
- **Fora do escopo:** o site em produção no Railway, o banco de produção, provedores externos (Google OAuth, envio de e-mail), contas reais, outros repositórios.
- **Contas sintéticas:** criadas pelo link mágico na caixa de teste local (`*@teste.local`).
- **Operações permitidas:** leitura de código e histórico git; testes existentes; requisições só a `127.0.0.1`; `pnpm audit` (sem instalar nada).
- **Proibido:** negação de serviço, força bruta, engenharia social, scanners contra URLs, uso de qualquer segredo encontrado, dados reais.
- **Critérios de parada:** segredo de produção válido encontrado (avisar na hora e recomendar rotação), dado real exposto, escopo extrapolado.
- **Limpeza:** o banco local é em memória e some ao fim de cada execução; os testes temporários são apagados.

**Decisão de início:** [x] escopo validado e autorizado para código e ambiente local · [ ] testes ativos em produção bloqueados (pendente de autorização separada)

## Arquitetura e superfície (mapeada no código)

- **Front-end:** React/Vite estático, servido pelo próprio servidor (mesma origem). Service worker em `apps/web/public/sw.js`.
- **Servidor:** Node (Express 5 + Colyseus 0.18) em `apps/server`. Deploy via Docker no Railway (1 réplica).
- **Identidade:** login por link mágico (e-mail) e por Google; sessão por cookie. Visitantes jogam sem conta, só com apelido.
- **API HTTP** (`apps/server/src/http/app.ts`): `/api/auth/*`, `/api/eu*` (perfil, avatar, preferências, Google), `/api/perfil`, `/api/perfil/:id`, `/api/historico`, `/api/ranking/:variante`, `/api/salas`, `/api/admin/*` (usuários, banir, mesas, partidas), `/api/teste/emails` (modo de teste), `/saude`.
- **Tempo real:** salas Colyseus `mesa` (casual, privada, desafio, ranqueada) e `fila` (ranqueada, exige conta). Mensagens: ações de jogo, sinais, falas, chat (mesa privada), batida.
- **Dados sensíveis:** e-mail, sessão, Elo/ranking, histórico de partidas, banimentos.
- **Fronteiras de confiança:** navegador → API (cookie); navegador → WebSocket (cookie/token de reconexão); servidor → banco; servidor → Google e provedor de e-mail.
