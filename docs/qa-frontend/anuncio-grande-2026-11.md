# Anúncio grande do pedido (TRUCO!, SEIS!…, FAMÍLIA FECHADA!) — 2026-11-16

Pedido do André: "uma animação mais dinâmica para certas palavras. Tipo o truco ser bem grande na tela. O mesmo quando desafia família real fechada."

## Designer

- **Problema atual (observado):** o pedido de truco aparecia só no balão do assento (`.balao.grito`, ~2 rem) e numa linha do placar ("Pediram Truco! Vale 3"). A família fechada aparecia só no balão e na linha da etapa. No celular, quando três balões aparecem juntos, o pedido não se destaca dos outros ("Boa!", "Vixe!").
- **Proposta:** uma plaquinha de lousa com moldura de madeira, girada -4°, com a palavra em giz (Caveat Brush). Ela entra grande e "bate" no meio da mesa, fica parada um instante e some, em 1,6 s no total. TRUCO!/SEIS!/NOVE!/DOZE! em `--grito` (amarelo); FAMÍLIA FECHADA! em `--giz`, menor, para caber em 320 px. Em cima, quem pediu ("Você", "Bot Zé").
- **Tokens usados:** `--lousa`, `--madeira-funda`, `--madeira-veio`, `--grito`, `--giz`, `--giz-suave`, `--sombra`, `--fonte-giz`, `--fonte-ui`, `--raio-painel`, espaços `--e*`. Nenhuma cor nova. Contrastes já medidos em `estilos.css`: grito/lousa 7,5 e giz/lousa 12,2.
- **Fica de fora:** a fala "TRUCO!" do painel de falas é provocação, não pedido; continua só no balão. Também ficam de fora família aberta, aceitar, correr e as etapas do ritual.
- **Critérios:**
  1. A placa aparece ao pedir truco ou aumentar e ao pedir família fechada.
  2. Não sai da largura da tela.
  3. Não cobre o rodapé de ações.
  4. Não pega clique.
  5. Nada fica por cima dela.
  6. Some sozinha.
  7. Com movimento reduzido, não tem animação.
  8. O leitor de tela não ouve o mesmo pedido duas vezes.

## Frontend

- `apps/web/src/logica/eventos.ts`: novas `anuncioGrande(eventos, agora)` e `DURACAO_ANUNCIO_MS`. Elas leem os eventos `acao` que já chegam do servidor (sem mudar protocolo nem regras).
- `apps/web/src/componentes/AnuncioGrande.tsx`: a placa, com `aria-hidden`. O pedido já é lido pela região `anuncio-mesa` ("Pediram Truco! Vale 3.") e a família pela linha `etapa` ("Ana pediu família fechada. Conferir?").
- `apps/web/src/telas/Mesa.tsx`: renderiza a placa fora do tampo, então vale para personagens, cadeiras e 3D. Ela não aparece com janela modal na tela (resumo da mão, fim da partida, manual, confirmar saída, mesa pausada): se alguém corre na hora, o resumo é o que importa.
- `apps/web/src/estilos.css`: bloco `.anuncio-grande`, em `position: fixed`, `z-index: 45` (acima da dica da mesa, que usa 40 e no celular fica no meio da tela; abaixo dos painéis abertos, que usam 50) e `pointer-events: none`. Com `prefers-reduced-motion`, `animation: none`.
- **Rollback:** reverter o commit. Não há dado salvo nem mudança de servidor.

## QA

- Testes de unidade (`apps/web/test/anuncio-grande.test.tsx`): o gatilho (truco/aumentos/família fechada sim; fala, família aberta e respostas não; duração), o componente (aria-hidden) e a TelaMesa (região viva preservada, botões de resposta presentes, sem placa com o resumo da mão).
- E2E (`apps/web/e2e/anuncio-grande.spec.ts`), com servidor real e bots:
  - **Truco:** 320x568, 360x640, 360x740, 390x844, 430x932 e 1440x900 em personagens; 390x844 e 1440x900 em cadeiras; 390x844 em 3D.
  - **Família fechada:** 320x568 e 390x844.
  - **Movimento reduzido:** 390x844.
  - Em cada caso, o teste mede os critérios 2 a 6 e tira uma captura.
- **Como mede:** com os bots acelerados do E2E, a placa (1,6 s) corria contra as idas e voltas do Playwright e contra as respostas dos bots (SEIS! logo em seguida, gente correndo).
  - Um `MutationObserver` dentro da página mede cada placa 450 ms depois de ela entrar.
  - O teste confere esse registro, e não o DOM depois.
  - Se a placa sai antes disso porque o resumo da mão entrou, o teste tenta outro truco.
  - O spec ganhou um `pedirTruco` próprio, que aceita quando um bot pede truco; o `ateMinhaVezComAcao` compartilhado travava nesse caso.
  - Rodado 2 vezes seguidas: 12/12 em ambas.
- **Limitação das capturas:** a captura da cena 3D (WebGL) leva ~0,8 s. Para a foto, o observador congela a animação da placa e o `Date.now` da página só até a captura. As medidas são feitas antes disso, com o tempo real.
- **Capturas:** `docs/qa-frontend/capturas/anuncio-grande/`.
  - Antes: 390x844 com truco e com família fechada, onde só aparece o balão pequeno.
  - Depois: todas as viewports e vistas.
- **Achados e correções:**
  - Quando o bot corre logo depois do truco, o resumo "Nós levamos!" (z 40) cobria metade da placa (320x568). Agora a placa não aparece junto com janelas modais.
  - A caixa de dica (`.dica-mesa`, z 40) cobria o meio da placa em 320x568. A placa subiu para z 45.
  - Ambos foram pegos pela checagem de sobreposição (`elementFromPoint` no meio da placa) do E2E.
- **Depois das correções:** `layout-mobile`, `qa-visual-mesa` e `movimento-reduzido` passaram. Em `qa-visual-mesa`, "dica não cobre o centro da mesa - 320x568" é uma falha esperada (`test.fail`, P3 conhecida) e foi contada como ok.
- **Suíte completa:** `pnpm test:e2e` rodou uma vez antes dessas correções: 145 ok, 2 falhas e 20 pulados.
  - Uma das falhas era esta placa coberta, já corrigida.
  - A outra foi `qa-visual-mesa` "janela de família fechou antes da medição". Esse teste já existia, não foi alterado e é sensível ao tempo: falhou em 1857x912 numa execução e em 430x932 na seguinte, e passou na terceira.
- **NAO_EXECUTADO:** leitor de tela real (NVDA/TalkBack), zoom 200%, celular físico, tema claro/escuro manual. Também não houve revisão independente por outra pessoa: a revisão foi feita pelo mesmo modelo que implementou.
