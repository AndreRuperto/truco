# Modo apostado com dinheiro real no Truco — análise de viabilidade legal

**Data do levantamento:** 10/11/2026 · **Branch:** `claude/seguranca` · **Situação:** pesquisa, sem código

> **AVISO — ISTO NÃO É PARECER JURÍDICO.** É um levantamento técnico feito por IA a partir de fontes públicas, para orientar uma conversa com advogado. Pode ter erro de leitura, norma desatualizada ou interpretação que um tribunal não aceitaria. O cenário mudou muito em 2026: há uma Medida Provisória em tramitação e um julgamento no STF ainda sem resultado. **A decisão final exige um advogado** (de preferência com experiência em direito penal econômico, regulação de apostas e meios de pagamento), consultado antes de qualquer linha de código, cobrança ou anúncio.

---

## 1. Veredito

**Não pode, no formato proposto** (os jogadores depositam, a plataforma junta o pote, paga o vencedor e fica com uma taxa). Hoje não existe caminho regulado para isso no Brasil, e o modelo junta três riscos de uma vez: penal, regulatório e com o gateway.

**O que é certo na lei (texto expresso):**

1. A única via de licença federal para apostas on-line, a Lei 14.790/2023, **foi fechada**. A MP 1.394, de 25/09/2026, proibiu no país a exploração, a oferta e a intermediação de apostas de quota fixa, inclusive em jogos on-line (art. 1º, §1º). Ela também extinguiu as autorizações em 30 dias (art. 4º), proibiu novas autorizações (art. 6º) e revogou a maior parte da Lei 14.790 (art. 29, II).
2. **Mesmo antes da MP, o truco entre jogadores não cabia nesse regime.** A Portaria SPA/MF 1.207/2024 (art. 2º, parágrafo único) tirou do conceito de "jogo on-line" os jogos de habilidade, os multiapostador e os jogos entre apostadores (P2P), em que o operador só oferece o ambiente e cobra comissão. Essa é exatamente a descrição do modo proposto.
3. Guardar o dinheiro dos jogadores e repassá-lo a outro jogador é atividade de **instituição de pagamento**: aporte e saque em conta de pagamento, gestão de conta, remessa de fundos (Lei 12.865/2013, art. 6º, III). Quem faz isso por conta própria precisa de autorização do Banco Central ou tem de operar inteiramente dentro de uma instituição autorizada, num produto feito para esse fim.
4. Quem capta e intermedeia recursos de terceiros, ou distribui prêmios a partir de apostas, entra nas obrigações de prevenção à lavagem de dinheiro: identificar clientes, registrar operações, comunicar ao COAF (Lei 9.613/1998, art. 9º, I e parágrafo único, VI; arts. 10 e 11).
5. Os termos da InfinitePay proíbem prestar serviços financeiros ou de pagamento sem as autorizações necessárias (Termos de Uso, item 14.1.5). O contrato de afiliação só permite vender produtos e serviços permitidos pela legislação (itens 4.1, 4.3.3 e 15.3). A InfinitePay pode reter valores e encerrar a conta (itens 7.1 e 8.1).

**O que é interpretação ou zona cinzenta:**

- **O truco apostado é "jogo de azar" para a Lei de Contravenções Penais?** A lei define jogo de azar como aquele em que ganhar ou perder depende "exclusiva ou principalmente da sorte" (art. 50, §3º, "a"). O truco tem sorte (a distribuição das cartas) e habilidade (blefe, leitura, quando pedir truco e quando correr). **Não encontrei nenhuma decisão judicial sobre o truco.** Para o poker, a jurisprudência estadual pende para "habilidade", mas não é pacífica: o MP-RS e julgados do TJ-RS entendem o contrário. Não há precedente do STJ consolidando a questão.
- **O art. 50 continua válido?** Isso está em julgamento no STF (RE 966.177, Tema 924). O relator, Luiz Fux, votou pela validade, e o processo está parado por pedido de vista do ministro Flávio Dino desde agosto de 2026.
- **A MP 1.394 vai virar lei?** Ela ainda não foi votada. A comissão mista não estava instalada em 10/11/2026, e o prazo de 60 dias termina em 23/11/2026 (prorrogável). Mesmo que a MP caia, a Portaria 1.207 continua excluindo o P2P do regime de licença. Ou seja, a queda da MP **não** abre caminho para este modelo.

**Em resumo:** se o truco for considerado jogo de azar, o modo apostado é contravenção penal, e a plataforma, que "explora" o jogo e fica com a taxa, é o alvo principal do art. 50. Se for considerado jogo de habilidade, a contravenção sai de cena, mas o modelo continua sem licença possível, continua exigindo uma estrutura de pagamentos regulada que o projeto não tem e continua violando os termos do gateway. **Nas duas hipóteses, a resposta prática é não.**

---

## 2. Análise por tema

### 2.1 Enquadramento do truco apostado (Decreto-Lei 3.688/1941)

| Dispositivo | O que diz (paráfrase) | Efeito para o projeto |
|---|---|---|
| Art. 50, caput | Estabelecer ou explorar jogo de azar em lugar público ou acessível ao público, com ou sem cobrança de entrada. Pena de prisão simples de 3 meses a 1 ano e multa. | Uma plataforma on-line aberta a qualquer cadastrado é tratada, na prática, como acessível ao público. Quem fica com a taxa "explora" o jogo. |
| Art. 50, §1º | A pena aumenta em 1/3 se houver menor de 18 anos entre os participantes. | Exige verificação real de idade. |
| Art. 50, §2º (Lei 13.155/2015) | Multa de R$ 2 mil a R$ 200 mil para quem participa como apostador, **"ainda que pela internet"**. | Os jogadores também ficam expostos. |
| Art. 50, §3º, "a" | Jogo de azar é aquele em que ganhar ou perder depende exclusiva ou principalmente da sorte. | Este é o ponto central e não tem resposta pacífica para o truco. |
| Art. 50, §3º, "c" | Apostas sobre qualquer competição esportiva também são jogo de azar. | Se alguém tratar a partida como "competição" e o dinheiro como "aposta sobre ela", há uma segunda via de enquadramento, menos provável, mas citada em julgados sobre poker. |

**Por que o truco é zona cinzenta, e não "habilidade" garantida:**
- Com baralho de 40 cartas e 3 cartas por mão, a distribuição pesa muito em cada mão. A habilidade aparece no longo prazo e no blefe. Partidas curtas com aposta ampliam o peso da sorte.
- Na esfera penal não vale um laudo pedido pela própria empresa. Quem decide é o juiz de cada caso, e a polícia ou o Ministério Público podem agir antes de qualquer decisão.
- O paralelo mais próximo é o poker. Há decisões de tribunais estaduais que o reconhecem como jogo de habilidade (há registro de rejeição de denúncia por atipicidade), mas também a posição contrária do MP-RS e de julgados do TJ-RS. A própria SPA classificou o poker como "jogo de habilidade" na Portaria 1.207, mas só para tirá-lo do regime de licença, **não** para declará-lo lícito.

**Código Civil, art. 814:** dívidas de jogo ou aposta não podem ser cobradas na Justiça. O §3º abre exceção para prêmios oferecidos ao vencedor de competição esportiva, intelectual ou artística, "desde que os interessados se submetam às prescrições legais e regulamentares". Num pote formado pelo dinheiro dos próprios jogadores, a leitura mais natural é a de aposta, e não a de "prêmio oferecido". Na prática, disputas entre jogadores e a plataforma (por exemplo, o perdedor que contesta a cobrança ou o chargeback) ficariam sem base contratual sólida.

### 2.2 Lei 14.790/2023, portarias da SPA e MP 1.394/2026

**A situação até 24/09/2026 (Lei 14.790):**
- O "jogo on-line" licenciável era uma aposta contra o operador, com **quota fixa** (multiplicador definido pelo operador) e resultado decidido por **gerador randômico** (art. 2º, II e VIII). O truco entre jogadores não tem quota fixa nem resultado gerado por RNG.
- A **Portaria SPA/MF 1.207/2024, art. 2º, parágrafo único**, excluiu expressamente do conceito os jogos de habilidade, os fantasy sports, os jogos multiapostador e os jogos entre apostadores (P2P). Por isso, esses jogos **não podiam** ser oferecidos nem pelas bets autorizadas.
- Para referência, as exigências para quem cabia no regime eram estas: pessoa jurídica com sede e administração no Brasil (art. 7º), sócio brasileiro com pelo menos 20% do capital (art. 7º, §1º, IX), outorga de até R$ 30 milhões por 3 marcas (art. 12, parágrafo único), autorização de até 5 anos (art. 5º, III), certificação técnica (art. 7º, §1º, VII; Portarias 300 e 722/2024), reconhecimento facial e monitoramento do apostador (art. 23), proibição de menores e ludopatas (art. 26), contas transacionais apenas em instituição autorizada pelo BCB (art. 22), prêmios pagos só para conta do próprio apostador (art. 30), além da Portaria 615/2024 (pagamentos) e da Portaria 1.231/2024 (jogo responsável e publicidade).

**A situação desde 25/09/2026 (MP 1.394):**
- Art. 1º: proíbe a exploração, a oferta, a intermediação e a publicidade de apostas de quota fixa, inclusive por agente no exterior que atenda pessoas no Brasil. O §1º inclui os jogos on-line.
- Arts. 4º e 6º: extingue as autorizações existentes e veda novas. Hoje **não há licença a pedir**.
- Art. 14: proíbe instituições financeiras e de pagamento de processar transações de apostas de quota fixa. Art. 15: o BCB deve criar um mecanismo para rejeitar Pix ligado a apostas ilegais.
- A MP **não** cria crime novo e **não** altera o art. 50 da LCP. Ela também não fala de jogos de habilidade nem de P2P: esses jogos simplesmente continuam fora de qualquer regime de autorização.
- Tramitação: em 10/11/2026 ainda não tinha sido votada (comissão mista aguardando instalação). Prazo inicial até 23/11/2026, prorrogável por mais 60 dias.

**O que isso significa:** o truco apostado entre jogadores nunca teve licença federal possível e continua sem ter. Ficar fora da Lei 14.790 **não** é o mesmo que ser permitido. Significa apenas que a atividade é avaliada pelas regras gerais: a LCP, o Código Civil, as regras de pagamentos e as de prevenção à lavagem de dinheiro. E, depois da MP, bancos e instituições de pagamento ficaram muito mais rigorosos com qualquer fluxo que pareça aposta.

### 2.3 Guardar e redistribuir o dinheiro dos jogadores

| Tema | Norma | Consequência |
|---|---|---|
| Conta e saldo do jogador | Lei 12.865/2013, art. 6º, III (aporte e saque em conta de pagamento, gestão de conta, remessa de fundos) e IV (conta de pagamento) | Manter "saldo" de cada jogador e repassá-lo a outro é atividade de instituição de pagamento. |
| Autorização | Lei 12.865, art. 9º, V; Resolução BCB 80/2021 (constituição e funcionamento de IPs; emissor de moeda eletrônica precisa de autorização prévia do BCB) | Uma pessoa física ou um pequeno projeto não consegue isso. A alternativa seria um parceiro autorizado com produto próprio para custódia ou split, o que depende de a atividade-fim ser lícita. |
| Patrimônio separado | Lei 12.865, art. 12 | O dinheiro em conta de pagamento é patrimônio separado. Guardar o pote no caixa da plataforma mistura recursos de terceiros com o próprio. |
| Atividade privativa | Lei 12.865, art. 6º, §2º | Não se pode fazer, nem por IP, o que é privativo de instituição financeira. |
| Lavagem de dinheiro | Lei 9.613/1998, art. 9º, I (captação e intermediação de recursos de terceiros) e parágrafo único, VI (captação de apostas com pagamento de prêmios); arts. 10, 11 e 12 | Obrigações de KYC, registros por 5 anos, política interna, cadastro no regulador ou no COAF e comunicação de operações suspeitas em 24h. Sanções de até o dobro da operação ou R$ 20 milhões. Apostas P2P são um vetor clássico de lavagem: dois jogadores combinados "perdem" um para o outro de propósito. |
| Proibição nova | MP 1.394, arts. 14 e 15 | Instituições de pagamento não podem processar transações de apostas de quota fixa, e o Pix ligado a apostas ilegais será rejeitado. O enquadramento exato do truco P2P é discutível, mas o filtro dos bancos tende a ser amplo. |

**"Split de pagamento"** não resolve o problema. O split divide uma venda entre recebedores (por exemplo, marketplace e lojista). Aqui não há venda: o dinheiro de um jogador vai para outro conforme o resultado de um jogo, o que é aposta com outro nome. Não encontrei produto de split nos termos públicos da InfinitePay.

### 2.4 InfinitePay (documentos lidos em 10/11/2026)

A entidade é a CloudWalk Instituição de Pagamento e Serviços Ltda., CNPJ 18.189.547/0001-42 (preâmbulo dos Termos). Os documentos lidos não informam a data de vigência.

| Documento e item | Conteúdo (paráfrase) | Leitura para o modo apostado |
|---|---|---|
| Termos de Uso, 14.1.1 e 14.1.3 | Proíbem conteúdo ilícito e "atividades ilegais". | Se o truco apostado for considerado jogo de azar, cai aqui. |
| Termos de Uso, **14.1.5** | Proíbe prestar serviços financeiros ou de pagamento sem as autorizações necessárias. | **Juntar o dinheiro de jogadores e repassá-lo ao vencedor é exatamente isso.** É o conflito mais direto. |
| Termos de Uso, 14.2 | Permite impedir ou limitar o acesso de quem age em desacordo. | Risco de bloqueio da conta. |
| Termos de Uso, 7.1 | Em suspeita de fraude, lavagem ou atividade ilícita, permite suspender e **reter valores** até a apuração. | Risco de o dinheiro dos jogadores ficar preso, com a plataforma respondendo a eles. |
| Termos de Uso, 8.1 e 1.2 | Encerramento imediato por descumprimento; aprovação revogável sem justificativa. | Risco de ficar sem meio de pagamento de uma hora para outra. |
| Contrato de afiliação, 4.1, 4.3.3 e 15.3 | Só produtos e serviços permitidos pela legislação; proíbe os proibidos por lei. | Remete de novo à LCP. |
| Contrato de afiliação, 7.5 | As partes atuam como facilitadoras de pagamento **entre lojistas e seus clientes**. | O produto foi feito para venda de bens e serviços, não para pagar prêmios entre usuários. |

**Palavras que não aparecem** nos Termos de Uso (lidos por inteiro): aposta, jogo, azar, loteria, sorteio, prêmio, cassino, split, marketplace, subcredenciamento. **Não há lista pública de "atividades proibidas"** (a página `/legal` retorna 404). Ou seja, não existe vedação expressa a apostas. A vedação vem das cláusulas gerais acima. A parte final do contrato de afiliação (cláusulas 17.7 em diante) só foi lida por resumo e não foi verificada palavra por palavra. **Se o dono quiser uma resposta definitiva, deve perguntar por escrito à InfinitePay** se ela aceita esse modelo de negócio, descrevendo-o com honestidade.

### 2.5 Tabela de requisitos e riscos

| # | Risco / requisito | Tipo | Certeza | Gravidade | Dá para mitigar? |
|---|---|---|---|---|---|
| R1 | Exploração de jogo de azar (LCP art. 50): prisão simples e multa para quem explora; multa para os jogadores (§2º) | Penal | **Zona cinzenta** (depende de o truco ser azar ou habilidade; o STF não decidiu) | Alta | Só um laudo ou parecer reduz o risco, e mesmo assim não o elimina. |
| R2 | Não há licença possível (MP 1.394, arts. 1º, 4º e 6º; Portaria 1.207, art. 2º, par. único) | Regulatório | **Certo** | Alta | Não. |
| R3 | Custódia de recursos de terceiros sem autorização do BCB (Lei 12.865, arts. 6º e 9º; Res. BCB 80/2021) | Regulatório | **Certo**, se a plataforma guardar saldo | Alta | Só com um parceiro autorizado que aceite a atividade, o que é improvável. |
| R4 | Obrigações de PLD/COAF (Lei 9.613, arts. 9º a 12) e uso do P2P para lavagem | Regulatório / penal | **Certo** que as obrigações se aplicam | Alta | Exigiria KYC, monitoramento e uma equipe de compliance. Custo incompatível com o projeto. |
| R5 | Violação dos termos da InfinitePay (14.1.5; afiliação 4.3.3), com retenção de saldo (7.1) e encerramento (8.1) | Gateway | **Muito provável** | Alta | Só com aceite expresso e por escrito da InfinitePay. |
| R6 | Bloqueio de Pix e de transações de apostas (MP 1.394, arts. 14 e 15) | Regulatório / gateway | Provável | Média/alta | Não. |
| R7 | Dívida de jogo não exigível (CC art. 814): chargebacks e disputas sem base | Cível | **Certo** para aposta; cinzento para "prêmio" | Média | Não, no modelo de pote. |
| R8 | Menores de idade (LCP art. 50, §1º; ECA) | Penal / cível | Certo | Alta | Exigiria verificação de idade forte. |
| R9 | Tributação (IR sobre prêmios, receita da taxa) e responsabilidade perante o consumidor (CDC) | Fiscal / consumidor | Certo que existe; detalhe não levantado | Média | Contador e advogado. |
| R10 | Risco de imagem e das plataformas (Railway, lojas de apps; a MP 1.394, arts. 19 a 21, impõe dever de cuidado a provedores e lojas) | Operacional | Provável | Média | Não, no modelo apostado. |

---

## 3. Alternativas viáveis (do mais seguro para o mais arriscado)

| Alternativa | Como funciona | O que exige / base legal | Risco residual |
|---|---|---|---|
| **A. Competição sem dinheiro** (já existe: ranking/Elo, ranqueadas) | Títulos, temporadas, medalhas, perfil. | Nada específico. | Mínimo. |
| **B. Moeda virtual sem resgate** ("fichas") | Fichas usadas só dentro do jogo. **Não podem** ser convertidas em dinheiro, sacadas nem transferidas entre jogadores. Podem ser ganhas de graça. | Sem valor de resgate não há "ganho e perda" econômico. Mesmo assim, é preciso seguir o CDC (informação clara, arrependimento em compra on-line). | **Baixo** se as fichas forem só ganhas. **Cinzento** se forem vendidas: vender fichas usadas para "apostar" se parece com o modelo de "cassino social", e um mercado paralelo de revenda pode recriar o valor monetário. Também é preciso verificar as regras atuais sobre caixas de recompensa e menores (não levantado aqui). |
| **C. Monetização sem aposta** | Assinatura premium, cosméticos (baralhos, mesas, avatares), sem efeito no resultado. | CDC, emissão de nota e tributos. Encaixa no uso normal da InfinitePay (venda de serviço digital próprio). | Baixo. |
| **D. Torneio gratuito com prêmio pago pela plataforma** | Inscrição grátis, sem exigir compra. A plataforma (ou um patrocinador) paga do próprio bolso um prêmio fixo, anunciado antes. | A Lei 5.768/1971, art. 3º, II, dispensa autorização para concurso exclusivamente cultural, desportivo ou recreativo "não subordinado a qualquer modalidade de álea ou pagamento pelos concorrentes" e sem vínculo com compra. O CC art. 814, §3º, admite prêmio ao vencedor de competição. É preciso regulamento público, verificação de idade, KYC mínimo para pagar e retenção de IR. | **Cinzento num ponto:** o truco tem álea (as cartas). Se a autoridade entender que há álea relevante, a dispensa do art. 3º não vale e cai-se no art. 1º, que exige autorização prévia do Ministério da Fazenda, só para pessoa jurídica comercial (§1º), e **proíbe prêmio em dinheiro** (§3º). Prêmio em produto, e não em dinheiro, reduz esse risco. **Exige parecer.** |
| **E. Promoção comercial autorizada** | Concurso ou sorteio vinculado a uma marca ou patrocinador, com autorização. | Lei 5.768, art. 1º: autorização prévia, pessoa jurídica comercial em dia com os tributos, prêmio **não** em dinheiro (§3º), sorteios pela Loteria Federal (§4º). A lei atribui a autorização ao Ministério da Fazenda. Qual órgão processa os pedidos hoje não foi verificado neste levantamento. | Baixo se autorizada, mas há burocracia e taxas. Não serve para prêmio em dinheiro. |
| **F. Torneio com inscrição paga e prêmio fixo garantido** | O jogador paga a inscrição e o prêmio é fixo, garantido pela plataforma, sem depender do número de inscritos. | Nenhuma norma autoriza isso de forma expressa. | **Alto / cinzento.** Inscrição paga, chance de ganhar e prêmio formam a estrutura de uma aposta. Fica fora da dispensa do art. 3º, II, da Lei 5.768 (há "pagamento pelos concorrentes"). **Não recomendado** sem parecer favorável e escrito. |
| **G. Esperar o cenário mudar** | Acompanhar o STF (RE 966.177 / Tema 924), a votação da MP 1.394 e eventuais leis gerais sobre jogos. | — | Não gera nada hoje. Uma eventual lei que legalize jogos de azar viria com licença, capital mínimo e compliance fora do alcance de um projeto pequeno. |

**Recomendação prática:** seguir com A + C (e B só com fichas não vendáveis, se fizer sentido para o produto). Levar D a um advogado se o dono quiser oferecer prêmio de verdade, de preferência começando com prêmio em produto ou patrocínio. Descartar o modo apostado e a alternativa F.

---

## 4. Perguntas para levar ao advogado

1. O truco on-line entre dois jogadores ou duplas, com pote formado por eles e taxa da plataforma, se enquadra no art. 50 da LCP? Vale a pena encomendar um estudo estatístico de habilidade, como já foi feito para o poker?
2. Um torneio gratuito com prêmio em dinheiro pago pela plataforma cabe no art. 3º, II, da Lei 5.768/1971, dada a álea na distribuição das cartas? Ou precisa da autorização do art. 1º, que proíbe prêmio em dinheiro?
3. Quais são as obrigações fiscais e de PLD para pagar prêmios a pessoas físicas (retenção de IR, KYC)?
4. Vender fichas sem resgate gera algum risco de "jogo" ou de consumo, inclusive com menores (CDC e ECA)?
5. Se a MP 1.394 não for convertida em lei, algo muda para o modelo P2P? (A leitura deste levantamento é que não, por causa da Portaria 1.207.)

---

## 5. Limitações deste levantamento

- **Portarias SPA/MF 615, 722, 1.207 e 1.231/2024:** o texto oficial no DOU (in.gov.br) **não abriu** (erro de conexão em duas tentativas). A exclusão do P2P e dos jogos de habilidade (Portaria 1.207, art. 2º, parágrafo único) foi confirmada pela notícia oficial do Ministério da Fazenda e por reproduções de terceiros, não pelo DOU. A versão consolidada atual não foi verificada.
- **MP 1.394/2026:** texto lido no Planalto. Decreto 13.128/2026 e exposição de motivos não lidos. A situação da tramitação foi verificada em 10/11/2026.
- **Lei 14.790:** arts. 49 a 58 lidos só por resumo. Tributação do operador (Lei 13.756/2018, LC 224/2025) não levantada.
- **Resolução BCB 80/2021:** não li o texto consolidado (alterado depois, por exemplo pela Res. BCB 494/2025). Os limites de dispensa não foram verificados.
- **InfinitePay:** Termos de Uso lidos por inteiro. Contrato de afiliação lido verbatim até a cláusula 17.7 e o restante por resumo. Política de privacidade não lida. Não há lista pública de atividades proibidas.
- **Jurisprudência:** nenhuma decisão específica sobre truco foi encontrada. As decisões sobre poker vieram de fontes secundárias (notícias e artigos), não dos acórdãos.
- **STF, Tema 924:** acompanhado por notícias de agosto e setembro de 2026. O andamento atual não foi consultado no portal do STF.

---

## 6. Fontes (acesso em 10/11/2026)

**Legislação (Planalto e Congresso)**
- Decreto-Lei 3.688/1941 (Lei das Contravenções Penais), arts. 50, 51 e 58 — https://www.planalto.gov.br/ccivil_03/decreto-lei/del3688.htm
- Lei 10.406/2002 (Código Civil), arts. 814 a 817 — https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm
- Lei 5.768/1971 (distribuição gratuita de prêmios), arts. 1º, 3º e 12 — https://www.planalto.gov.br/ccivil_03/leis/l5768.htm
- Lei 9.613/1998 (lavagem de dinheiro), arts. 9º a 12 — https://www.planalto.gov.br/ccivil_03/leis/l9613compilado.htm
- Lei 12.865/2013 (arranjos e instituições de pagamento), arts. 6º, 9º e 12 — https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12865.htm
- Lei 14.790/2023 (apostas de quota fixa), arts. 2º, 3º, 5º, 7º, 12, 22, 23, 26, 30 e 41 — https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14790.htm
- Medida Provisória 1.394/2026 — https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/mpv/mpv1394.htm
- Tramitação da MPV 1394/2026 — https://www.congressonacional.leg.br/materias/medidas-provisorias/-/mpv/175871

**Ministério da Fazenda / SPA**
- MP 1.394/2026: entenda as novas regras (publicado em 02/10/2026, atualizado em 07/10/2026) — https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/medida-provisoria-ndeg-1-394-2026-entenda-as-novas-regras-para-as-apostas-de-quota-fixa
- Legislação de apostas de quota fixa (lista de portarias, atualizada em 04/11/2026) — https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/legislacao/apostas-de-quota-fixa
- "Ministério da Fazenda publica portaria com regras para jogos on-line" (Portaria 1.207/2024; exclusão de P2P e jogos de habilidade) — https://www.gov.br/fazenda/pt-br/assuntos/noticias/2024/julho/ministerio-da-fazenda-publica-portaria-com-regras-para-jogos-on-line
- Portaria SPA/MF 1.207/2024 no DOU (não abriu) — https://www.in.gov.br/en/web/dou/-/portaria-spa/mf-n-1.207-de-29-de-julho-de-2024-575312304
- Portaria SPA/MF 615/2024 no DOU (não abriu) — https://www.in.gov.br/en/web/dou/-/portaria-normativa-spa/mf-n-615-de-16-de-abril-de-2024-554928583
- Portaria SPA/MF 722/2024 no DOU (não abriu) — https://www.in.gov.br/en/web/dou/-/portaria-spa/mf-n-722-de-2-de--maio-de-2024-557715851
- Portaria SPA/MF 1.231/2024 no DOU (não abriu) — https://www.in.gov.br/en/web/dou/-/portaria-spa/mf-n-1.231-de-31-de-julho-de-2024-575670297

**Banco Central**
- Resolução BCB 80/2021 (instituições de pagamento), referência secundária — https://legismap.com.br/leis-e-normas/resolucao-bcb-n-080-de-25-03-2021 · normativos oficiais: https://www.bcb.gov.br/estabilidadefinanceira/buscanormas

**InfinitePay (CloudWalk IP)**
- Termos de Uso (itens 1.2, 3.3, 3.8, 7.1, 8.1, 14.1.1 a 14.2) — https://www.infinitepay.io/legal/termos-de-uso
- Contrato de Afiliação (itens 4.1, 4.3.3, 7.5, 15.3) — https://www.infinitepay.io/legal/contrato-de-afiliacao
- Política de Combate a Atos Ilícitos e PLD — https://www.infinitepay.io/legal/politica-pld

**Jurisprudência e STF (fontes secundárias)**
- STF, RE 966.177 / Tema 924 — Conjur (05/08/2026): https://conjur.com.br/2026-ago-05/stf-julga-nesta-quarta-a-criminalizacao-dos-jogos-de-azar-prevista-na-lei-de-contravencoes-penais/ · Migalhas: https://www.migalhas.com.br/quentes/461812/ao-vivo-stf-julga-exploracao-de-jogos-de-azar-como-contravencao-penal · Correio Braziliense (09/2026): https://www.correiobraziliense.com.br/direito-e-justica/2026/09/7500262-entre-a-contravencao-e-a-regulacao-o-inicio-do-julgamento-dos-jogos-de-azar-no-stf.html
- Poker como habilidade (decisões estaduais) — Dizer o Direito: https://www.dizerodireito.com.br/2012/01/justica-tem-decidido-que-poquer-nao-e.html · Conjur (2021): https://www.conjur.com.br/2021-ago-01/justica-entende-poquer-nao-depende-exclusivamente-sorte/
- Posição contrária (MP-RS) — https://www.mprs.mp.br/media/areas/criminal/arquivos/resposta_poquer.pdf
- Panorama da MP 1.394 — Migalhas: https://www.migalhas.com.br/coluna/uma-migalhas/466172/o-fim-das-bets-o-que-determina-a-medida-provisoria-1-394-2026
