import type { Carta, Variante } from '@truco/engine';
import { type ReactNode, useId, useState } from 'react';
import { FALA_TEXTO } from '../logica/eventos';
import { INFO_SINAL } from '../logica/sinais';
import { CartaVisual } from './CartaVisual';

/*
 * Manual de como jogar. Segue as regras que o motor do jogo aplica de verdade (packages/engine):
 * se uma regra mudar lá, mude aqui também. Aparece em #/como-jogar e por cima da mesa (botão ?).
 */

const k = (valor: Carta['valor'], naipe: Carta['naipe']): Carta => ({ valor, naipe });

function Cartas({ cartas, variante = 'mineiro', vira = null, legenda }: { cartas: Carta[]; variante?: Variante; vira?: Carta | null; legenda?: string[] }) {
  return (
    <ul className="manual-cartas">
      {cartas.map((c, i) => (
        <li key={i}>
          <CartaVisual carta={c} variante={variante} vira={vira} />
          {legenda?.[i] && <span>{legenda[i]}</span>}
        </li>
      ))}
    </ul>
  );
}

const NOME_VALOR: Record<string, string> = { A: 'Ás', K: 'Rei', J: 'Valete', Q: 'Dama', C: 'Coringa' };
const nomeCarta = (c: Carta) => `${NOME_VALOR[c.valor] ?? c.valor} de ${c.naipe}`;

/**
 * A escada de força em cartas: manilhas, depois comuns, com uma seta entre cada degrau. Para o
 * leitor de tela é uma lista ordenada com o nome de cada carta (as setas são só desenho).
 */
function Escada({
  variante,
  vira,
  rotulo,
  manilhas,
  legendaManilhas,
  comuns,
}: {
  variante: Variante;
  vira: Carta | null;
  rotulo: string;
  manilhas: Carta[];
  legendaManilhas?: string[];
  comuns: Carta[];
}) {
  // Sobe da mais fraca (esquerda) para a mais forte (direita): comuns e depois as manilhas.
  const degraus = [
    ...manilhas.map((c, i) => ({ c, grupo: 'manilha' as const, legenda: legendaManilhas?.[i] })),
    ...comuns.map((c) => ({ c, grupo: 'comum' as const, legenda: undefined as string | undefined })),
  ].reverse();
  return (
    <figure className="escada">
      <figcaption>{rotulo}</figcaption>
      <ol className="escada-degraus" aria-label={rotulo}>
        {degraus.map(({ c, grupo, legenda }, i) => (
          <li key={`${c.valor}${c.naipe}`} className={`escada-degrau escada-${grupo}`} aria-label={nomeCarta(c) + (grupo === 'manilha' ? ', manilha' : '')}>
            {i > 0 && (
              <span className={degraus[i - 1].grupo !== grupo ? 'escada-seta escada-divisa' : 'escada-seta'} aria-hidden="true">
                ›
              </span>
            )}
            <span className="escada-carta" aria-hidden="true">
              <CartaVisual carta={c} variante={variante} vira={vira} />
              <span className="escada-legenda">{legenda ?? (grupo === 'manilha' ? 'manilha' : '')}</span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

interface SecaoInfo {
  id: string;
  titulo: string;
  corpo: ReactNode;
}

const SINAIS_ORDEM = ['zap', 'copas', 'espadilha', 'picafumo', 'coringa', 'tres', 'dois', 'as', 'nada'] as const;
const FALAS_ORDEM = ['truco', 'seis', 'nove', 'doze', 'desce', 'corro', 'boa', 'vixe', 'bora'] as const;

const NOME: Record<Variante, string> = { paulista: 'Paulista', mineiro: 'Mineiro' };

/** Comuns da mais forte para a mais fraca, em naipes que não são manilha nos exemplos. */
const COMUNS: Carta[] = [
  k('3', 'ouros'),
  k('2', 'copas'),
  k('A', 'paus'),
  k('K', 'ouros'),
  k('J', 'copas'),
  k('Q', 'paus'),
  k('7', 'espadas'),
  k('6', 'ouros'),
  k('5', 'copas'),
  k('4', 'espadas'),
];
const VIRA_EXEMPLO = k('7', 'ouros');

function secoesDe(v: Variante): SecaoInfo[] {
  const paulista = v === 'paulista';
  const secoes: (SecaoInfo | false)[] = [
  {
    id: 'resumo',
    titulo: `Resumo do ${NOME[v]}`,
    corpo: paulista ? (
      <>
        <p>
          O <strong>paulista</strong> tem <strong>vira</strong>: depois de dar as cartas, uma carta fica virada no meio da mesa e
          as quatro cartas do número seguinte a ela são as manilhas daquela mão. A cada mão, manilhas diferentes.
        </p>
        <ul>
          <li>Manilhas: o número seguinte à vira, nos quatro naipes (paus › copas › espadas › ouros).</li>
          <li>Pontuação costumeira: 1, 3, 6, 9, 12.</li>
          <li>Mão de 11 ligada; sem família e sem mão de 10.</li>
          <li>É exatamente assim na ranqueada do paulista.</li>
        </ul>
      </>
    ) : (
      <>
        <p>
          O <strong>mineiro</strong> não tem vira: as quatro manilhas são <strong>sempre as mesmas</strong> (4 de paus, 7 de
          copas, Ás de espadas e 7 de ouros). Você decora uma vez e pronto.
        </p>
        <ul>
          <li>Manilhas fixas: zap (4♣), 7♥, espadilha (A♠) e pica-fumo (7♦).</li>
          <li>Pontuação costumeira: 2, 4, 8, 10, 12.</li>
          <li>Mão de 10 e família fechada ligadas.</li>
          <li>Opção de mão limpa: baralho sem 4 a 7 e com 2 coringas.</li>
          <li>A ranqueada do mineiro usa 2, 4, 8, 10, 12, mão de 10 e família fechada.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'basico',
    titulo: 'O básico',
    corpo: (
      <>
        <p>
          Truco se joga em <strong>quatro pessoas, em duas duplas</strong>. Seu parceiro senta na sua frente; os adversários,
          um de cada lado. Aqui, quem falta na mesa vira bot.
        </p>
        <p>
          A partida é dividida em <strong>mãos</strong>. Em cada mão, cada um recebe <strong>3 cartas</strong> e a mão é
          disputada em até <strong>3 rodadas</strong>: cada pessoa joga uma carta por rodada e a carta mais forte leva a
          rodada para a dupla dela. <strong>Quem fizer 2 rodadas ganha a mão</strong> e marca os pontos que a mão estiver
          valendo.
        </p>
        <p>
          <strong>Ganha a partida a dupla que chegar a 12 pontos primeiro.</strong>
        </p>
        <p>Existem duas variantes, e você escolhe na tela inicial (este guia é do {NOME[v]}; dá para trocar lá em cima):</p>
        <ul>
          <li>
            <strong>Paulista</strong>: depois de dar as cartas, vira-se uma carta na mesa (a <em>vira</em>), e ela decide
            quais são as cartas mais fortes da mão.
          </li>
          <li>
            <strong>Mineiro</strong>: não tem vira; as quatro cartas mais fortes são sempre as mesmas.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'forca',
    titulo: 'A força das cartas',
    corpo: (
      <>
        <p>
          O baralho tem 40 cartas: sai 8, 9 e 10. Nas cartas comuns só o número importa (o naipe não), e acima de todas
          ficam as <strong>4 manilhas</strong>. {paulista ? 'Exemplo com a vira 7 de ouros' : 'No mineiro é sempre esta'}, da
          mais fraca para a mais forte (cada seta aponta para a carta que ganha):
        </p>
        {paulista ? (
          <Escada
            variante="paulista"
            vira={VIRA_EXEMPLO}
            rotulo="Da mais fraca para a mais forte, com a vira 7 de ouros"
            manilhas={[k('Q', 'paus'), k('Q', 'copas'), k('Q', 'espadas'), k('Q', 'ouros')]}
            comuns={COMUNS.filter((c) => c.valor !== 'Q')}
          />
        ) : (
          <Escada
            variante="mineiro"
            vira={null}
            rotulo="Da mais fraca para a mais forte, no mineiro"
            manilhas={[k('4', 'paus'), k('7', 'copas'), k('A', 'espadas'), k('7', 'ouros')]}
            legendaManilhas={['Zap', 'Copas', 'Espadilha', 'Ouros']}
            comuns={COMUNS}
          />
        )}
        {paulista ? (
          <p>
            Com outra vira, a escada muda: as manilhas passam a ser o número seguinte, e esse número sai das comuns. Fora as
            manilhas, a ordem das comuns é sempre <strong>3 › 2 › A › K › J › Q › 7 › 6 › 5 › 4</strong>.
          </p>
        ) : (
          <p>
            Só aquelas quatro são manilhas: os outros 4, 7 e Ases (como o 4 de espadas ou o Ás de paus) são cartas comuns. Com
            a mão limpa ligada, os 2 coringas entram entre as manilhas e o 3.
          </p>
        )}
        <p>
          Repare que o <strong>3 e o 2 ganham do Ás</strong>, e que a <strong>Dama (Q) é mais fraca que o Valete (J)</strong>.
          Duas cartas comuns do mesmo número empatam: um K de copas e um K de paus têm a mesma força.
        </p>
        <p>
          Na mesa, o botão <strong>Ordem</strong> abre essa escada inteira e marca onde estão as cartas da sua mão.
        </p>
      </>
    ),
  },
  {
    id: 'manilhas',
    titulo: 'Manilhas',
    corpo: (
      <>
        <p>
          Manilhas são as quatro cartas mais fortes da mão. Elas ganham de qualquer carta comum e, entre elas, nunca empatam: a
          ordem vai pelo naipe.
        </p>
        {!paulista && (
          <>
        <h3>No mineiro: sempre as mesmas</h3>
        <Cartas
          variante="mineiro"
          cartas={[k('4', 'paus'), k('7', 'copas'), k('A', 'espadas'), k('7', 'ouros')]}
          legenda={['Zap', 'Copas (7 de copas)', 'Espadilha', 'Pica-fumo (7 de ouros)']}
        />
        <p>
          Da mais forte para a mais fraca: <strong>4 de paus</strong> (o zap), <strong>7 de copas</strong>,{' '}
          <strong>Ás de espadas</strong> (a espadilha) e <strong>7 de ouros</strong> (o pica-fumo). Os outros 4, 7 e Ases
          continuam cartas comuns.
        </p>
          </>
        )}
        {paulista && (
          <>
        <h3>No paulista: depende da vira</h3>
        <p>
          A vira é a carta que fica virada no meio da mesa. As manilhas são <strong>as quatro cartas do número seguinte ao da
          vira</strong>, na ordem da força comum: se a vira é um 7, as manilhas são as Damas; se a vira é um K, são os Ases; se
          a vira é um 3, dá a volta e as manilhas são os 4.
        </p>
        <p>Exemplo com a vira 7 de ouros:</p>
        <Cartas variante="paulista" vira={k('7', 'ouros')} cartas={[k('7', 'ouros')]} legenda={['Vira']} />
        <Cartas
          variante="paulista"
          vira={k('7', 'ouros')}
          cartas={[k('Q', 'paus'), k('Q', 'copas'), k('Q', 'espadas'), k('Q', 'ouros')]}
          legenda={['1ª (paus)', '2ª (copas)', '3ª (espadas)', '4ª (ouros)']}
        />
        <p>
          Entre as manilhas do paulista a ordem dos naipes é sempre <strong>paus › copas › espadas › ouros</strong>. Enquanto a
          vira vale, aquele número deixa de ser carta comum: no exemplo, nenhuma Dama é carta comum.
        </p>
          </>
        )}
        <p>As cartas não trazem o nome da manilha escrito: você aprende a reconhecer. O guia Ordem, na mesa, ajuda.</p>
      </>
    ),
  },
  {
    id: 'mao',
    titulo: 'Como corre uma mão',
    corpo: (
      <>
        <h3>Quem dá as cartas</h3>
        <p>
          Quem dá as cartas é o <strong>pé</strong>. A cada mão o pé passa para a pessoa seguinte da roda, e{' '}
          <strong>quem começa jogando é quem está logo depois do pé</strong>.
        </p>
        <h3>Embaralhar e cortar</h3>
        <p>
          O monte é físico: as cartas recolhidas no fim de uma mão voltam para o monte e o baralho só se mistura se alguém
          embaralhar.
        </p>
        <ol>
          <li>
            <strong>O pé embaralha</strong> quantas vezes quiser (até 20) e passa o monte para cortar.
          </li>
          <li>
            <strong>Quem corta é quem está do outro lado do pé</strong> (o anterior a ele na roda). Ele tem 3 movimentos, e
            cada um pode ser cortar ou embaralhar mais uma vez. Também pode devolver o monte sem gastar tudo.
          </li>
          <li>
            Como primeiro movimento, quem corta ainda pode gastar os 3 de uma vez em duas jogadas especiais:
            <ul>
              <li>
                <strong>Abrir 3</strong>: as 3 cartas de cima são mostradas para todos e ficam fora da mão.
              </li>
              <li>
                <strong>Dar 3</strong>: as 3 cartas de cima vão fechadas direto para o parceiro de quem cortou, que fica fora da
                distribuição.
              </li>
            </ul>
          </li>
        </ol>
        <h3>Como dar</h3>
        <p>O pé escolhe como distribuir as 3 cartas de cada um:</p>
        <ul>
          <li>
            <strong>Por cima</strong>: 3 de uma vez, tiradas de cima do monte.
          </li>
          <li>
            <strong>Por baixo</strong>: 3 de uma vez, tiradas de baixo do monte.
          </li>
          <li>
            <strong>Subindo</strong>: uma de cada vez, de baixo do monte, em três voltas.
          </li>
        </ul>
        {paulista ? (
          <p>Depois de dar as mãos, a carta seguinte do monte fica virada na mesa: é a vira, que define as manilhas.</p>
        ) : (
          <p>No mineiro não tem vira: as manilhas são sempre as mesmas.</p>
        )}
        <p>
          Se você não fizer nada no seu tempo, o jogo faz o movimento por você. Durante a partida, cada jogada tem 20 segundos.
        </p>
      </>
    ),
  },
  {
    id: 'rodadas',
    titulo: 'Rodadas, empates e carta coberta',
    corpo: (
      <>
        <h3>Quem ganha a rodada</h3>
        <p>
          Ganha a rodada a dupla que jogou a carta mais forte. Quem ganhou a rodada começa a próxima. Se as duas cartas mais
          fortes forem da mesma dupla, ela ganha normalmente.
        </p>
        <h3>Empate (cangar)</h3>
        <p>
          Quando a carta mais forte de uma dupla tem a mesma força da carta mais forte da outra, a rodada{' '}
          <strong>empata</strong> (dizem que <em>cangou</em>). Aí vale assim:
        </p>
        <ul>
          <li>
            <strong>Empatou a 1ª</strong>: quem ganhar a 2ª leva a mão. Se a 2ª também empatar, quem ganhar a 3ª leva.
          </li>
          <li>
            <strong>Alguém ganhou a 1ª e a 2ª empatou</strong>: quem ganhou a 1ª leva a mão, sem jogar a 3ª.
          </li>
          <li>
            <strong>Cada dupla ganhou uma e a 3ª empatou</strong>: quem ganhou a 1ª leva a mão.
          </li>
          <li>
            <strong>As três empataram</strong>: ninguém marca ponto.
          </li>
        </ul>
        <h3>Cangou a 1ª: cartas empilhadas</h3>
        <p>
          Quando a 1ª rodada canga, ninguém joga a 2ª carta na vez. <strong>Todo mundo junta as duas cartas que sobraram,
          uma em cima da outra</strong>, e escolhe qual vai por cima: a mais forte, para decidir já na 2ª, ou a mais fraca,
          guardando a forte embaixo. Cada um escolhe sem ver o que os outros fizeram. Na mesa, é só tocar na carta que vai
          por cima.
        </p>
        <ol>
          <li>Com tudo empilhado, quem é da vez pode pedir truco ou mandar mostrar.</li>
          <li>
            <strong>Todos mostram a de cima ao mesmo tempo</strong>: essa é a 2ª rodada. A de baixo continua escondida.
          </li>
          <li>
            Se a 2ª também cangar, quem é da vez (pode pedir truco de novo) manda <strong>abrir</strong>: todos viram a de
            baixo de lado, e ela decide a 3ª.
          </li>
        </ol>
        <h3>Carta coberta</h3>
        <p>
          <strong>A partir da 2ª rodada</strong>, você pode jogar uma carta virada para baixo. Ela{' '}
          <strong>não vale nada</strong> (perde de qualquer carta), mas ninguém fica sabendo qual era. Serve para esconder o
          jogo quando a rodada já está perdida ou ganha pelo parceiro. Na 1ª rodada e na mão de 11 não pode.
        </p>
      </>
    ),
  },
  {
    id: 'truco',
    titulo: 'Truco: aumentando a aposta',
    corpo: (
      <>
        <p>
          Toda mão começa valendo pouco. <strong>Depois que a 1ª rodada termina</strong>, na sua vez, você pode pedir{' '}
          <strong>Truco!</strong> para a mão valer mais. Na 1ª rodada não se pede truco. A escada de valores depende da
          pontuação escolhida na mesa:
        </p>
        <table className="manual-tabela">
          <caption>Quanto a mão vale em cada pedido</caption>
          <thead>
            <tr>
              <th scope="col">Pontuação</th>
              <th scope="col">Sem pedido</th>
              <th scope="col">Truco</th>
              <th scope="col">Seis</th>
              <th scope="col">Nove</th>
              <th scope="col">Doze</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">1, 3, 6, 9, 12</th>
              <td>1</td>
              <td>3</td>
              <td>6</td>
              <td>9</td>
              <td>12</td>
            </tr>
            <tr>
              <th scope="row">2, 4, 8, 10, 12</th>
              <td>2</td>
              <td>4</td>
              <td>8</td>
              <td>10</td>
              <td>12</td>
            </tr>
          </tbody>
        </table>
        <p>A dupla adversária responde com uma de três opções:</p>
        <ul>
          <li>
            <strong>Aceitar (Desce!)</strong>: a mão passa a valer o pedido e o jogo continua.
          </li>
          <li>
            <strong>Correr</strong>: desiste da mão. Quem pediu ganha o que a mão valia <em>antes</em> do pedido.
          </li>
          <li>
            <strong>Aumentar</strong>: aceita e já pede o degrau seguinte (Seis!, Nove!, Doze!). Agora é a sua dupla que
            precisa responder.
          </li>
        </ul>
        <p>
          Depois que um pedido é aceito, <strong>a dupla que pediu não pode pedir de novo</strong>: o próximo aumento tem que
          vir do outro lado. O máximo é Doze. Quem responde é qualquer um da dupla; o primeiro a responder decide pelos dois.
        </p>
        <h3>Bater na mesa</h3>
        <p>
          Para pedir Seis, Nove ou Doze com estilo, <strong>segure o botão</strong>: quanto mais tempo segurar, mais forte o
          soco na mesa quando soltar. Um toque rápido só faz o pedido. Bata forte várias vezes e a mesa de madeira racha e
          quebra; aí entra uma mesa de plástico de bar.
        </p>
      </>
    ),
  },
  {
    id: 'mao11',
    titulo: 'Mão de 11 (mão de ferro)',
    corpo: (
      <>
        <p>
          Quando liga, a mão de 11 muda a mão em que alguém está a um ponto de ganhar. Você escolhe na mesa quando ela vale:
          com <strong>qualquer dupla com 11</strong> (padrão do paulista), <strong>só no 11 a 11</strong>, ou desligada.
        </p>
        <ul>
          <li>
            <strong>Todo mundo joga às cegas</strong>: as cartas vêm viradas e ninguém vê nem as próprias. Você escolhe a carta
            só pela posição.
          </li>
          <li>
            <strong>Não se pede truco</strong> e <strong>não se joga coberta</strong>.
          </li>
          <li>A mão já começa valendo o primeiro nível de truco: <strong>3 pontos</strong> na escada 1–3–6–9–12, ou <strong>4 pontos</strong> na escada 2–4–8–10–12. Quem atingir 12 pontos vence a partida.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'mao10',
    titulo: 'Mão de 10',
    corpo: (
      <>
        <p>
          Padrão no mineiro. Quando <strong>só uma dupla está com 10 pontos</strong>, antes de jogar ela{' '}
          <strong>vê as cartas do parceiro</strong> e decide:
        </p>
        <ul>
          <li>
            <strong>Jogar</strong>: a mão já começa valendo truco (3 ou 4 pontos).
          </li>
          <li>
            <strong>Correr</strong>: a dupla adversária ganha o valor inicial da mão (1 ou 2 pontos) sem jogar.
          </li>
        </ul>
        <p>
          Nessa mão <strong>ninguém pede truco</strong>: ela já é trucada. Na mesa de verdade, quem pede truco na mão de 10
          dá tento para os adversários (o valor da mão); aqui o botão de truco nem aparece. Se as duas duplas estiverem com
          10, a mão é normal.
        </p>
      </>
    ),
  },
  {
    id: 'familia',
    titulo: 'Família',
    corpo: (
      <>
        <p>
          <strong>Família é uma mão só de figuras e Ases</strong>: três cartas entre Q, J, K e A (o Ás de espadas também
          conta). É uma mão fraca, então quem tem pode trocar.
        </p>
        <p>Exemplo de família:</p>
        <Cartas variante="mineiro" cartas={[k('Q', 'ouros'), k('K', 'paus'), k('A', 'copas')]} />
        <p>
          <strong>Quando pedir</strong>: só antes de cair a primeira carta da mão, sem truco pedido, numa mão normal (nem de 10
          nem de 11). Pedir família <strong>troca suas 3 cartas por 3 do monte</strong>. Qualquer jogador pode pedir, até fora
          da vez.
        </p>
        <h3>Família fechada (padrão do mineiro)</h3>
        <p>
          Você bota as 3 cartas viradas na mesa e pega 3 novas. Como ninguém vê, <strong>pode ser blefe</strong>. A dupla
          adversária decide se <strong>confere</strong>:
        </p>
        <ul>
          <li>
            Conferiu e <strong>era família</strong>: sua dupla ganha o valor inicial da mão (1 ou 2 pontos).
          </li>
          <li>
            Conferiu e <strong>era blefe</strong>: quem conferiu ganha esses pontos.
          </li>
          <li>Não conferiu: ninguém pontua, você só trocou de cartas.</li>
        </ul>
        <p>
          São no máximo 3 famílias fechadas por mão (o "abrir 3" do corte conta como uma). Depois disso, só aberta.
        </p>
        <h3>Família aberta</h3>
        <p>
          As cartas vão para a mesa viradas para cima, então <strong>tem que ser família de verdade</strong>. Você troca as
          cartas e ninguém pontua.
        </p>
      </>
    ),
  },
  !paulista && {
    id: 'mao-limpa',
    titulo: 'Mão limpa',
    corpo: (
      <>
        <p>
          Uma opção do mineiro com um baralho de <strong>29 cartas</strong>: saem todos os 4, 5, 6 e 7 que não são manilha, e
          entram <strong>2 coringas</strong>.
        </p>
        <Cartas variante="mineiro" cartas={[k('C', 'copas'), k('C', 'paus')]} legenda={['Coringa', 'Coringa']} />
        <p>
          O coringa fica <strong>entre as manilhas e o 3</strong>: perde para qualquer manilha e ganha de todas as cartas comuns.
          Os dois coringas empatam entre si.
        </p>
      </>
    ),
  },
  {
    id: 'sinais',
    titulo: 'Sinais e falas',
    corpo: (
      <>
        <p>
          No truco de verdade, os parceiros trocam caretas para contar o que têm na mão. Aqui, o botão{' '}
          <strong>Sinais</strong> manda uma careta para o seu parceiro:
        </p>
        <ul className="manual-sinais">
          {SINAIS_ORDEM.filter((s) => !paulista || s !== 'coringa').map((s) => (
            <li key={s}>
              <span aria-hidden="true">{INFO_SINAL[s].emoji}</span> {INFO_SINAL[s].descricao}
              {s === 'coringa' && <small> (só na mão limpa)</small>}
            </li>
          ))}
        </ul>
        <p>
          Cuidado: dependendo da mesa, <strong>os adversários podem interceptar o sinal</strong> e ver a careta também. A chance
          aparece no painel de sinais e é escolhida na criação da mesa.
        </p>
        <p>
          O botão <strong>Falas</strong> solta um balão para a mesa toda, só para provocar ou comemorar:{' '}
          {FALAS_ORDEM.map((f) => FALA_TEXTO[f]).join(', ')}. Falar "TRUCO!" não pede truco de verdade: para isso use o botão de
          pedido.
        </p>
      </>
    ),
  },
  {
    id: 'mesas',
    titulo: 'Tipos de mesa',
    corpo: (
      <>
        <ul>
          <li>
            <strong>Jogar agora</strong>: abre uma mesa com as regras escolhidas em "Regras da mesa". Com "Só eu", os outros
            três são bots (fácil ou difícil).
          </li>
          <li>
            <strong>Mesa privada</strong>: cria uma mesa com link; só entra quem tiver o link. Mande para os amigos.
          </li>
          <li>
            <strong>Salas</strong>: lista as mesas abertas para você entrar.
          </li>
          <li>
            <strong>Ranqueada</strong>: precisa de conta. As regras são fixas e contam pontos no ranking:
            <ul>
              <li>Paulista: 1, 3, 6, 9, 12, mão de 11 com qualquer dupla, sem família.</li>
              <li>Mineiro: 2, 4, 8, 10, 12, mão de 10, família fechada.</li>
            </ul>
            Sair de uma ranqueada no meio conta como derrota e bloqueia a fila por 5 minutos.
          </li>
        </ul>
        <p>Numa mesa comum, se você sair, um bot assume o seu lugar até o fim.</p>
      </>
    ),
  },
  {
    id: 'dicas',
    titulo: 'Dicas para começar',
    corpo: (
      <ul>
        <li>Guarde a carta mais forte. Ganhar a 1ª rodada com uma carta média e segurar a manilha costuma render mais.</li>
        <li>
          Ganhou a 1ª? Na 2ª, se o parceiro já está ganhando a rodada, jogue coberta ou uma carta fraca e guarde a boa para a
          3ª.
        </li>
        <li>Pedir truco com mão fraca é blefe, e blefe faz parte. Mas correr cedo custa menos do que perder um Seis.</li>
        <li>Use os sinais: saber que o parceiro tem o zap muda tudo. Só cuidado com quem está olhando.</li>
        <li>Na dúvida, abra o guia Ordem na mesa e veja onde suas cartas estão na escada.</li>
      </ul>
    ),
  },
  {
    id: 'glossario',
    titulo: 'Glossário',
    corpo: (
      <dl className="manual-glossario">
        <dt>Pé</dt>
        <dd>Quem embaralha e dá as cartas na mão.</dd>
        <dt>Mão</dt>
        <dd>Uma distribuição de cartas, disputada em até 3 rodadas.</dd>
        <dt>Rodada</dt>
        <dd>Cada um joga uma carta; a mais forte leva.</dd>
        <dt>Vira</dt>
        <dd>A carta virada no paulista; o número seguinte a ela é a manilha.</dd>
        <dt>Manilha</dt>
        <dd>Uma das quatro cartas mais fortes da mão.</dd>
        <dt>Zap</dt>
        <dd>A manilha mais forte (a de paus).</dd>
        <dt>Cangar</dt>
        <dd>Empatar uma rodada.</dd>
        <dt>Correr</dt>
        <dd>Desistir da mão diante de um pedido.</dd>
        <dt>Coberta</dt>
        <dd>Carta jogada virada; não vale nada.</dd>
        <dt>Mão de ferro</dt>
        <dd>A mão de 11: todos jogam sem ver as cartas.</dd>
        <dt>Família</dt>
        <dd>Mão só com Q, J, K e A, que pode ser trocada.</dd>
      </dl>
    ),
  },
  ];
  return secoes.filter((x): x is SecaoInfo => x !== false);
}

/** Ids e títulos das seções de cada guia, na ordem (para testes e links). */
export const secoesManual = (v: Variante) => secoesDe(v).map((s) => ({ id: s.id, titulo: s.titulo }));

/**
 * O manual inteiro com sumário. Os links do sumário são botões que rolam até a seção: o app usa
 * o hash da URL para as telas, então âncoras `#secao` trocariam de tela.
 */
export function Manual({ varianteInicial = 'mineiro' }: { varianteInicial?: Variante }) {
  const [v, setV] = useState<Variante>(varianteInicial);
  const secoes = secoesDe(v);
  const prefixo = useId();
  const idDe = (s: string) => `${prefixo}-${s}`;
  const ir = (s: string) => {
    const alvo = document.getElementById(idDe(s));
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    alvo?.focus({ preventScroll: true });
  };
  return (
    <div className="manual">
      <div className="manual-variante" role="group" aria-label="Guia da variante">
        {(['paulista', 'mineiro'] as const).map((x) => (
          <button key={x} type="button" aria-pressed={v === x} onClick={() => setV(x)}>
            Guia do {NOME[x]}
          </button>
        ))}
      </div>
      <nav className="manual-sumario" aria-label="Sumário do manual">
        <ol>
          {secoes.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => ir(s.id)}>
                {s.titulo}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {secoes.map((s) => (
        <section key={s.id} className="manual-secao" aria-labelledby={idDe(s.id)}>
          <h2 id={idDe(s.id)} tabIndex={-1}>
            {s.titulo}
          </h2>
          {s.corpo}
        </section>
      ))}
    </div>
  );
}
