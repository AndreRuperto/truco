# Diagnóstico do Ciclo 4 — reconexão ao trocar de app/aba (2026-11-10)

Base: `master` @ `a77830b`. Relato do usuário: "conexão instável quando troca de aplicativo/aba". Método: depuração sistemática (reproduzir antes de corrigir). Ferramenta: sonda Playwright `e2e/tmp-reconexao.spec.ts` (Pixel 7, 1 humano + 3 bots), que registra a linha do tempo da tela e dos WebSockets.

## Como a reconexão funciona hoje (código)

| Camada | Comportamento | Onde |
| --- | --- | --- |
| Servidor | Na queda (`onDrop`), marca a cadeira como desconectada e a guarda por **300 s** (`allowReconnection(client, 300)`) | `apps/server/src/MesaRoom.ts:252` |
| Servidor | **Humano desconectado não é "ativo"**: na vez dele, o servidor joga como bot, no ritmo do bot (`botMs` = 900 ms em produção), sem o prazo de 20 s do humano. Só não pede família por ele | `apps/server/src/mesa/Mesa.ts:568-577`, `:706`, `:833` |
| Cliente | `onDrop` → tela "Recuperando sua mesa e sua cadeira…", que substitui a mesa inteira; comandos ficam bloqueados até chegar um `estado` novo | `apps/web/src/rede/loja.ts`, `apps/web/src/App.tsx:131` |
| Cliente | Nova tentativa no `visibilitychange`, no `online` e a cada 5 s; token em `sessionStorage` (vale para F5, não para outra aba) | `apps/web/src/App.tsx:103-120`, `apps/web/src/rede/conexao.ts` |
| Cliente | Erro "expired/not found/invalid" → "A sessão da mesa expirou. Entre novamente para jogar."; outros erros mantêm "reconectando" | `apps/web/src/rede/conexao.ts:78-96` |

Inconsistência: comentários do cliente falam em "60 s" de cadeira guardada; o servidor guarda 300 s.

## Reprodução (medida)

| Cenário | WebSocket | Volta à mesa | Volta a jogar | Observação |
| --- | --- | --- | --- | --- |
| Rede fora 8 s | cai; o SDK tenta 6× | 0,4 s depois da volta | 0,6 s | ok |
| Rede fora 20 s | cai | 0,4 s | — | **a partida inteira terminou enquanto estava fora** (12 × 0) |
| Rede fora 40 s | cai | 0,4 s | — | **partida terminou fora** (5 × 13) |
| Aba congelada 30 s (CDP `frozen`) | **não cai** | imediata | 0,1 s | o navegador responde aos pings sem JS |
| Aba congelada 90 s | **não cai** | imediata | 0,1 s | idem |

Os testes rodam com `TRUCO_TEMPOS=rapido` (bot em 60 ms), por isso a partida acaba em segundos. Com os tempos reais (bot em 900 ms), cada vez sua é jogada pelo bot em ~1 s depois da queda.

## Conclusões

- **Observado:** o mecanismo de reconexão funciona. Nos 4 cenários, a cadeira volta e o estado é sincronizado em menos de 0,5 s depois que a rede volta, sem erro de console novo.
- **Observado (regra):** enquanto o socket está caído, a sua cadeira é jogada pelo bot quase imediatamente, inclusive respondendo a truco. Quem é conectado e fica parado recebe 20 s.
- **Hipótese principal para o relato:** no celular real, a troca de app pode derrubar o socket (sistema economizando bateria, troca de rede, tela apagada). Ao voltar, a mesa "pula" para um estado em que o bot já jogou a sua mão. Isso é percebido como conexão instável. **Não confirmado em aparelho real**: o congelamento emulado não derruba o socket.
- **Secundário:** a tela de reconexão esconde a mesa inteira durante a queda, o que reforça a sensação de instabilidade mesmo em quedas de 1–2 s.

## Decisão pendente (regra de jogo, do dono do produto)

Quanto tempo esperar por um humano desconectado antes de o bot jogar por ele. Opções:

1. **Prazo normal do humano:** o desconectado recebe o mesmo prazo de quem está parado (20 s na jogada, 12 s no ritual, 6 s para conferir). Quando o prazo acaba, o servidor faz a ação padrão por ele, como já faz hoje com quem estoura o tempo.
2. **Tolerância extra na primeira queda** (ex.: 45 s), depois volta ao ritmo atual.
3. **Manter como está** (bot imediato), mudando só a comunicação na volta.

## Correção aplicada (opção 1, escolhida pelo dono do produto em 2026-11-10)

`Mesa.humanoNaVez` (humano sentado, conectado ou não) substitui `humanoAtivo` na programação da vez, no empilhar e na chave do turno, que decide se o prazo reinicia. Cair e voltar não reinicia o relógio. Janela de família, revanche e envio de estado continuam com `humanoAtivo`. A cadeira só vira bot permanente quando os 300 s de reconexão vencem (`onLeave`).

Efeito colateral aceito: enquanto um humano está desconectado, cada vez dele espera até o prazo (20 s na jogada, 12 s por etapa do ritual), e os outros jogadores esperam com ele. Isso dura até ele voltar ou até os 300 s vencerem.

**Testes:** o servidor ganhou "desconectado na vez: espera o prazo normal...", "cair e voltar dentro do prazo..." e "o estado mostra aos outros o prazo da cadeira desconectada". Os testes da regra antiga foram reescritos. O E2E `reconexao.spec.ts` (rede fora 8 s na própria vez) **falha com o `Mesa.ts` antigo** e passa 3/3 com o novo.

**Verificação local (CI sem minutos):** typecheck ✅ · engine 233/233 · servidor 347/347 · web 390/390 · build ✅ · `pnpm test:e2e` 34 aprovados, 9 pulados (auditorias), 0 falhas.

## Próximos passos do ciclo 4

- Aparelho real: trocar de app no Android/iOS com a partida na vez e medir se o socket cai e em quanto tempo volta (o emulado não derruba o socket ao congelar).
- Comunicação na volta: mostrar o que aconteceu enquanto esteve fora (o prazo correu, ação padrão aplicada) em vez de só pular de estado.
- A tela "Recuperando sua mesa" esconde a mesa inteira mesmo em quedas de 1–2 s: avaliar manter a mesa visível, em modo só leitura, com um aviso.
- Servidor reiniciado ou sala encerrada no meio da partida; cadeira expirada (> 300 s); service worker depois de deploy.

## Não testado

Aparelho real (Android/iOS), troca de rede Wi-Fi ↔ 4G, reabertura do PWA, servidor reiniciado no meio da partida, cadeira expirada (> 300 s), service worker depois de deploy.
