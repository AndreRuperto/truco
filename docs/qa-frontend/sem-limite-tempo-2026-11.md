# Mesa privada sem limite de tempo — 2026-11-16

Pedido do André: em mesa privada, onde a turma conversa, poder tirar o tempo de cada jogada.

## Como o tempo funcionava antes desta mudança

- **Onde**: só no servidor (`apps/server/src/mesa/Mesa.ts`, `TEMPOS_PADRAO`). O engine não tem relógio.
  A tela só mostra o `prazo` que o servidor manda (`MsgEstado.prazo`: quem age e até quando)
  em `Cronometro.tsx` (barra + segundos), no assento de quem está na vez e no anel da vista 3D.
- **Quanto**: 20 s por jogada (carta, responder truco, mão de 10/11, cangada); 12 s por etapa do
  ritual (embaralhar, cortar, escolher como dar); 6 s para conferir família; 20/25/30 s de
  janela para pedir família (essa já era escolhível nas regras).
- **Ao acabar** (`jogadaAutomatica`): não é derrota. O servidor faz a ação padrão — joga a carta
  mais fraca, corre do truco e da mão de 10, não confere família, no ritual passa/corta/dá por
  cima, na cangada empilha a mais forte. Se o parceiro for bot, o bot decide pela dupla.
- **Configuração**: não existia opção para o tempo por jogada (só o da família).

## Decisão (Designer Sênior)

- **Onde**: nas Regras da mesa do lobby, campo "Tempo por jogada" (20 segundos | Sem limite),
  visível só com "Mesa privada" marcada. Padrão: 20 segundos. Não fica salvo nas preferências
  (como o cacife, é escolha de cada mesa).
- **Mostrado a todos**: "Sem limite de tempo por jogada" nas Regras da casa da sala de espera
  (vem do servidor em `MsgEstado.semLimiteDeTempo`); na mesa, a vez aparece sem segundos.
- **Salas públicas, desafio e ranqueada**: o servidor ignora a opção (`opcoesDaSala`).
- **Janela de família** continua com o tempo dela (20/25/30 s): sem relógio, toda mão ficaria
  parada até cada humano tocar "sem família".

## Jogador ausente ou desconectado (não travar a mesa)

- Sem limite vale para quem está **conectado**. Quem **cai** (rede, troca de app) volta a ter
  o prazo normal e a ação padrão, como antes; se voltar dentro do prazo, a vez segue sem limite.
- A cadeira continua guardada pelos 300 s de reconexão; depois disso um bot assume (inalterado).
- Quem está conectado e simplesmente não joga segura a mesa: é o comportamento pedido. A mesa
  privada já tem pausa (admin) e qualquer um pode sair.

## Protocolo e compatibilidade

- Opção de criação nova `semLimiteDeTempo` (opcional) e campo `MsgEstado.semLimiteDeTempo`
  (opcional). Com sem limite, `prazo` vem `null` na vez de quem está conectado — formato que o
  cliente já conhecia (bot na vez). Cliente antigo numa mesa sem limite só perde o aviso de vez
  na aba; nada quebra. `chaveRegras` não mudou (mesa privada não entra por matchmaking).
- Reconexão: a chave do turno inclui "caiu/conectado" quando a mesa é sem limite, para o prazo
  aparecer ao cair e sumir ao voltar.

## Frontend Sênior — arquivos

- Servidor: `protocolo.ts` (opção e campo), `Mesa.ts` (`temPrazo`, `atualizar`, cangada, chave),
  `MesaRoom.ts` (repasse).
- Web: `logica/lobby.ts`, `telas/Lobby.tsx` (campo), `logica/textos.ts` + `telas/SalaEspera.tsx`
  (regra), `logica/prazo.ts` (`vezEhMinha`), `telas/Mesa.tsx` e `som/useSons.ts` (aviso na aba e
  sino continuam sem prazo), `componentes/Manual.tsx` (texto).
- Testes: `apps/server/test/mesa-sem-limite.test.ts`, `protocolo.test.ts`; web `prazo.test.ts`,
  `lobby.test.tsx`, `sala-espera.test.tsx`; E2E `apps/web/e2e/sem-limite.spec.ts`.
- Rollback: reverter o commit; sem migração de banco.

## QA Visual e UX

Ver o PR para resultados e capturas. Revisão feita pelo mesmo modelo que implementou: não
equivale a validação independente.
