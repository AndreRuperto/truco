# Provocações com a moldura — design

Data: 2026-11-13. Pedido do André; decisões tomadas com ele no brainstorm desta data.

## Ideia

Na mesa, você toca na foto de outro jogador e a **sua moldura** age nele por ~1,5 s, e todos veem:

| Moldura equipada | Efeito |
|---|---|
| Sem moldura (grátis) ou convidado | bolinha de guardanapo que bate e cai |
| Corda | laço que aperta em volta da foto |
| Madeira Entalhada | farpa que voa e espeta |
| Neon de Bar | clarão rosa que ofusca a foto |
| Giz de Lousa | nuvem de pó de giz |

É só diversão: não muda carta, vez, tempo nem placar. "Especiais que atrapalham o jogo" ficam para um modo futuro, fora deste design.

## Regras

- Regra da mesa **"Provocações"** (liga/desliga em "Regras da mesa"), padrão ligada. Na **ranqueada** sempre desligada e o
  controle não aparece.
- Entra na `chaveRegras` só quando desligada (`prov:0`): as chaves das mesas de hoje não mudam e o PWA antigo continua
  encontrando sala.
- Alvo: qualquer outra cadeira ocupada (humano ou bot), na sala de espera e na partida. Nunca a própria.
- Limites no servidor: 1 provocação a cada 8 s por jogador; no máximo 3 por minuto no mesmo alvo vindas da mesma pessoa.
  Fora do limite: `erro` "calma: espere um pouco".
- O efeito vem da moldura do assento (`ocupantes[c].visual.moldura`, preenchida pelo servidor a partir da conta): ninguém
  usa moldura que não tem.

## Fluxo

1. Toque (ou Enter) na foto de outro jogador → abre o botão "Provocar" ao lado (fecha com Esc ou toque fora). Toque direto
   não provoca, para não disparar sem querer ao jogar carta.
2. Cliente manda `provocar { alvo }`.
3. `Mesa.provocar` valida e manda aos humanos `provocacao { id, de, para, efeito }`.
4. `rede/loja.ts` guarda as últimas em `snap.provocacoes`; `componentes/Provocacao.tsx` desenha o efeito sobre a foto do
   alvo (CSS e SVG, sem dependência nova) e some sozinho.
5. Leitor de tela: a região única da mesa anuncia só quando o alvo é você ("Ana te laçou!").
6. Movimento reduzido: sem animação; ícone fixo e texto curto ("laçado!") por 1,5 s. Vista 3D: o mesmo selo curto.

## Testes

- `protocolo.test.ts`: `provocacoes` em `opcoesDaSala` (padrão true, ranqueada false) e `prov:0` na chave.
- `mesa-*.test.ts`: regra desligada, ranqueada, alvo inválido, própria cadeira, limite de 8 s, 3 por minuto, efeito por
  moldura e convidado com guardanapo.
- `integracao.test.ts`: dois clientes; um provoca, os dois recebem.
- Testing Library: botão abre/fecha, envia o alvo, animação aparece e some, movimento reduzido.
- E2E 390×844 e desktop, vistas personagens e cadeiras: provocar um bot.
