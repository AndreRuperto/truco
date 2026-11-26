# Vista 3D: enquadramento, qualidade adaptativa e plano B (2026-11-26)

Branch `claude/mesa-3d-enquadramento`. Base: estudo das cenas 3D do Júri, do Conversa de Boteco e do Vasco 3D
e a prancha-guia "Cena 3D · Guia para montar modelo e cena low-poly" (https://claude.ai/artifact/3fYPVwgGuiVArScxn9LmF6).

## Designer: problema, hipóteses e critérios

**Público:** quem joga no celular em pé (o layout principal) e no computador. A vista 3D ainda só aparece para admin
em produção (localhost libera).

**Problemas observados nas capturas "antes" (Playwright, `e2e/capturas-3d.spec.ts`):**

1. No celular, o centro da mesa (onde caem as cartas) ficava a ~0,59 da altura da caixa 3D, perto do pé, embaixo
   da placa "Bot …", do botão Ordem e da dica de primeira partida.
2. FPS baixo e caindo com o tamanho: 28 → 8 do 320×568 ao 1280×800 (headless, WebGL em software).
3. Balões das cadeiras laterais saíam do quadro (pendência P2 já registrada).
4. Sem tratamento de `webglcontextlost`: se a GPU reinicia no meio da partida, a cena fica preta.

**Rotas avaliadas com esboços na cena real** (`capturas/mesa-3d-enquadramento/esbocos-390x844.jpg`):

| Rota | O que o esboço mostrou | FPS 320×568 (antes 28) | Decisão |
|---|---|---|---|
| A · enquadramento | mesa sobe para o meio; no computador tira a luminária do quadro | 29 | **feita**, só em caixa de celular |
| B · bonecos arredondados | quase não se nota a essa distância (flatShading esconde) | 21 (−27%) | não feita |
| C · câmera "quem trucou" | dá drama, mas a mesa some: só serve como momento curto | 47 | fica para depois |

Decisão sobre os bonecos: manter os modelos atuais. Já fazem o que os outros projetos não fazem (leque, IK do braço,
batida no "Truco!", roupa da loja via `vestir3D`). Trocar por blocos arredondados custa FPS e não aparece.

**Critérios mensuráveis**

- Centro da mesa entre 0,51 e 0,58 da altura da caixa em toda caixa de celular (proporção < 1,5); computador igual a antes.
- Cabeça de quem está de frente dentro do quadro (0,04 a 0,5 da altura).
- Nível inicial igual ao de antes (celular 1,5 pixel por ponto + PCF 512; computador 2 + PCFSoft 1024).
- Contexto perdido volta para a mesa 2D com o aviso que já existia.
- Identidade de boteco preservada: a sombra da luminária continua em todos os níveis.

## Frontend: o que mudou

| Arquivo | Mudança |
|---|---|
| `apps/web/src/componentes/mesa3d/enquadrar.ts` (novo) | `vistaPadrao` saiu de `cena.ts`; `centrarMesa` desloca a imagem (`setViewOffset`) para o centro da mesa cair a 0,54 da altura, no máximo 12% da altura, só com proporção < 1,5 |
| `apps/web/src/componentes/mesa3d/qualidade.ts` (novo) | níveis alta/média/baixa, nível inicial pelo aparelho, `?qualidade=` força, `MedidorFps` (janelas de 4 s, descarta a 1ª, desce abaixo de 24 FPS, nunca sobe) |
| `apps/web/src/componentes/mesa3d/cena.ts` | aplica nível e troca em tempo real; com a mesa parada desenha no máximo a 30 FPS; balões laterais empurrados para dentro da caixa (`translate`, o rabo compensa); `webglcontextlost` chama `aoPerderContexto`; `data-qualidade` no canvas |
| `apps/web/src/componentes/mesa3d/tipos.ts`, `Mesa3D.tsx` | opção `aoPerderContexto` → `aoFalhar('contexto WebGL perdido')` |
| `apps/web/test/mesa3d-enquadrar.test.ts`, `mesa3d-qualidade.test.ts` (novos), `mesa3d.test.tsx` | regressão do enquadramento por caixa, dos níveis e do contexto perdido |
| `apps/web/e2e/capturas-3d.spec.ts` (novo) | capturas antes/depois sob demanda nos cinco tamanhos (`TRUCO_AUDITORIA=1 TRUCO_CAPTURA=<nome>`) |

Sem dependência nova (`RoundedBoxGeometry` só foi usado no esboço B, que saiu). Protocolo, regras e servidor intactos.

**Rollback:** reverter o commit da branch; `cena.ts` volta a ter `vistaPadrao` local e o nível fixo por tamanho de tela.

## QA visual: resultado

Capturas em `capturas/mesa-3d-enquadramento/antes-depois.jpg` (as cinco larguras, antes em cima, depois embaixo).
O estado da partida difere entre as duas rodadas (cartas sorteadas, um "Truco!" no depois): a comparação é de enquadramento e luz.

| Tamanho | Antes: FPS | Depois: FPS | Nível no depois | Observação |
|---|---|---|---|---|
| 320×568 | 28,3 | 25,7 | média | mesa no mesmo lugar (já estava perto do meio nessa caixa larga) |
| 360×640 | 21,4 | 33,2 | baixa | mesa um pouco mais alta |
| 390×844 | 16,8 | 26,6 | baixa | mesa sobe de ~0,59 para ~0,54 da caixa |
| 430×932 | 14,7 | 24,7 | baixa | balão "TRUCO!" da cadeira da direita fica dentro da caixa |
| 1280×800 | 7,6 | 14,6 | baixa | enquadramento igual ao antes (luminária no quadro) |

FPS medido pelo `requestAnimationFrame` da página em 3 s, no Chromium headless com WebGL em software (SwiftShader).
Serve para comparar, não é o número de um celular real. No headless a cena cai para "baixa" depois de ~8 s; num
aparelho com GPU a tendência é ficar em "média". Com a mesa parada o laço desenha a no máximo 30 FPS, então o rAF
sobe sem que a cena desenhe mais.

Primeira tentativa do nível "baixa" foi sem sombra: o piso ficou lavado e a luz de boteco sumiu (visto só na captura).
Corrigido para sombra 256 em vez de nenhuma.

**Gate local** (resultado na descrição do PR): `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`,
`e2e/layout-mobile.spec.ts` + `e2e/qa-visual-mesa.spec.ts`, `pnpm test:e2e`.

**Limitações e pendências**

- Medição em celular real: NAO_EXECUTADO (fica com o André).
- Vista 3D com movimento reduzido nesta branch: coberta só pelos testes existentes (a cena recebe `reduzido`); captura NAO_EXECUTADO.
- Troca de nível em tempo real foi vista no headless (data-qualidade "baixa"), sem medir o tempo do "engasgo" ao recompilar.
- Contexto perdido: testado com o componente simulado; a perda real de GPU NAO_EXECUTADO.
- Revisão independente por outra pessoa: NAO_EXECUTADO (a revisão aqui é do mesmo modelo).
- Rota C (quadro "quem trucou" no grito) fica como próximo passo possível.
