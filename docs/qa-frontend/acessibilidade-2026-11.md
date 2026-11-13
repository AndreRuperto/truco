# Acessibilidade (F6.1) — 2026-11-13

Branch `claude/mvp-f6-lancamento`. Medido em Chromium (Playwright, perfil Pixel 7), 390×844, temas claro e escuro
emulados por `prefers-color-scheme`. Revisão feita pelo mesmo modelo que corrigiu: **não** é validação independente.

## 1. Teclado — `apps/web/e2e/teclado.spec.ts`

Só Tab, Enter e digitação, nos dois temas. Em cada parada o teste confere que o foco está no elemento esperado e que
o anel de foco existe, tem ≥ 2 px e ≥ 3:1 de contraste contra o fundo que está atrás dele.

| Caminho | Claro | Escuro |
|---|---|---|
| início → Apelido → Jogar agora → carta da mão → Truco! → Sair → Sair da mesa | ok | ok |
| início → Loja → aba Mesa → Equipar (Feltro, grátis) | ok | ok |

Achados e correções (antes → depois):

| Onde | Problema | Correção |
|---|---|---|
| Botões e links fora da mesa no tema claro | anel amarelo fixo (`--pol-foco`) no papel: **1,7:1** | `polimento-v2.css` passa a usar o `--foco` do contexto (tinta no papel, giz na lousa) |
| Ícones do menu da mesa | anel por fora, sobre o azulejo bege (**1,3:1**), e cortado em cima e embaixo pela barra que rola | anel por dentro do ícone (`outline-offset: -6px`), sobre o verde escuro |
| Carta da mão, tema escuro | anel cor de tinta sobre o fundo escuro: **1,1:1** | anel com o `--foco` da página |
| Botões dos cartões da loja, tema escuro | anel de giz no cartão de papel: **1,8:1** | cartão de papel define `--foco: tinta` nos dois temas |

A carta da mão tem nome para o leitor de tela (ex.: "Três de paus"); o teste confere com `toHaveAccessibleName`.

## 2. Contraste — `apps/web/e2e/contraste.spec.ts`

Telas: início, salas, como jogar, entrar, ranking, loja (visitante e logado), privacidade, termos, perfil, histórico,
fila e admin (resumo, usuários, auditoria). Texto normal ≥ 4,5:1; texto grande (≥ 24 px, ou ≥ 18,66 px em negrito) ≥ 3:1;
borda (ou fundo) de campo de formulário ≥ 3:1. Camadas semitransparentes são compostas até um fundo opaco.

| Tela | Medidos (claro / escuro) | Sem medida | Abaixo do mínimo |
|---|---|---|---|
| início | 40 / 40 | 1 | 0 |
| salas | 20 / 20 | 16 (cartões das mesas sobre imagem) | 0 |
| como jogar | 274 / 274 | 0 | 0 |
| entrar | 13 / 13 | 1 | 0 |
| ranking | 13 / 13 | 1 | 0 |
| loja (visitante / logado) | 29 e 37 / 29 e 37 | 0 | 0 |
| privacidade · termos | 51 · 33 | 0 | 0 |
| perfil | 93 / 91 | 1 | 0 |
| histórico · fila | 10 · 12 | 1 | 0 |
| admin (resumo, usuários, auditoria) | 46, 22, 14 | 0 | 0 |

Achados corrigidos:

| Onde | Antes | Correção |
|---|---|---|
| Bordas dos campos (início, entrar, perfil, fila, chat da sala, busca do admin) | 1,4:1 (claro) e 1,6 a 2,0:1 (escuro) | tokens `--campo-borda-papel` (4,0:1) e `--campo-borda-lousa` (3,9:1) em `estilos.css` |
| "Privada · por convite" (salas, tema claro) | 2,9:1 (tinta na pílula de lousa) | texto de giz na pílula |
| Créditos do extrato da loja (tema claro) | 2,9:1 (verde puro no azulejo) | verde mais fundo, ≥ 4,5:1 |

**Sem medida** = texto sobre imagem ou degradê (o cálculo por cor computada não vale ali). Os 16 das salas são os
cartões ilustrados das mesas; precisam de medida por captura (amostrando pixels), que não foi feita.

## 3. Leitor de tela (o que foi verificado no código e em testes)

- Nomes: o mesmo E2E de contraste confere que todo botão, link e campo visível tem nome acessível e toda `img` tem
  `alt`, nas 15 telas e nos dois temas: nenhuma falha.
- Cartas com nome (`rotuloCarta`) e "carta virada" no verso; ícones do menu da mesa com `aria-label`.
- Uma região só para vez e truco na mesa (`anuncio-mesa`). O balão do assento ("TRUCO!") deixou de ser região viva:
  antes o leitor falava o pedido duas vezes. Teste em `test/tela-mesa.test.tsx`.
- Continuam como `status` separados, por serem outro assunto: resultado da rodada (`etapa`), resumo da mão (placar),
  sinal recebido e o aviso da mesa quebrada.

## 4. Não testado

- **Leitor de tela real** (TalkBack, VoiceOver, NVDA): NAO_EXECUTADO. Os testes conferem papéis e nomes, não a fala.
- Tema escolhido na própria tela (se houver troca manual além do `prefers-color-scheme`): não coberto.
- Zoom de 200% e texto ampliado do sistema: NAO_EXECUTADO.
- Contraste dentro da mesa (só o anel de foco e o placar/ícones de `e2e/temas.spec.ts`).
- Mesa 3D com teclado: NAO_EXECUTADO.
