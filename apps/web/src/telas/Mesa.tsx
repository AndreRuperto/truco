import { type Cadeira, ehFaseRitual, parceiroDe, quemDeveAgir } from '@truco/engine';
import { useRef, useState } from 'react';
import { useAnimacaoRitual } from '../componentes/animacaoMesa';
import { Assento } from '../componentes/Assento';
import { BarraAcoes } from '../componentes/BarraAcoes';
import { CentroMesa } from '../componentes/CentroMesa';
import { Chat } from '../componentes/Chat';
import { ConfirmarSaida } from '../componentes/ConfirmarSaida';
import { Cronometro } from '../componentes/Cronometro';
import { FamiliasNaMesa } from '../componentes/FamiliasNaMesa';
import { Mao } from '../componentes/Mao';
import { Monte } from '../componentes/Monte';
import { FimDeMao, FimDePartida } from '../componentes/Overlays';
import { PainelFalas } from '../componentes/PainelFalas';
import { PainelSinais } from '../componentes/PainelSinais';
import { Placar } from '../componentes/Placar';
import { Tampo } from '../componentes/Tampo';
import { agruparAcoes } from '../logica/acoes';
import { botaoBate } from '../logica/batida';
import { baloesAtivos } from '../logica/eventos';
import { cadeiraNaPosicao } from '../logica/posicoes';
import { prazoEhMeu } from '../logica/prazo';
import { donoDoMonte, mostrarResumoMao, textoEtapa } from '../logica/ritual';
import { type SinalRecebido, temCoringa, textoSinalRecebido } from '../logica/sinais';
import { placarRelativo, resumoFimMao, resumoFimPartida, textoPedidoPendente, valorMao } from '../logica/textos';
import { useAgora } from '../rede/hooks';
import type { EstadoLoja, Loja } from '../rede/loja';

const DURACAO_SINAL_MS = 4_000;

interface Props {
  /** Precisa ter `msg.visao` (a App só mostra a mesa depois que a partida começa). */
  snap: EstadoLoja;
  acoes: Pick<Loja, 'enviarAcao' | 'enviarSinal' | 'enviarFala' | 'sair'> & Partial<Pick<Loja, 'enviarBatida'>>;
  aoChat?: (texto: string) => void;
  /** Começa outra partida com as mesmas opções (a App decide como). Sem ele, o fim só volta ao início. */
  aoJogarDeNovo?: () => void;
}

export function TelaMesa({ snap, acoes, aoChat, aoJogarDeNovo }: Props) {
  const agora = useAgora(250);
  const [painel, setPainel] = useState<'sinais' | 'falas' | 'chat' | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const msg = snap.msg!;
  const modo = msg.modo;
  const v = msg.visao!;
  const m = v.mao;
  const minha = msg.minhaCadeira;
  const camadaRitual = useRef<HTMLDivElement>(null);
  useAnimacaoRitual(snap.movimentos, minha, camadaRitual);
  const variante = v.regras.variante;
  const vira = m?.vira ?? null;
  const ui = agruparAcoes(msg.minhasAcoes, v);
  const baloes = baloesAtivos(snap.eventos, agora);
  const { nos, eles } = placarRelativo(v);
  const nome = (c: Cadeira) => msg.cadeiras[c]?.nome ?? `Cadeira ${c + 1}`;
  const agentes = quemDeveAgir(v);
  const daVez = (c: Cadeira) => agentes.includes(c);

  const ultimo = [...snap.eventos].reverse().find((e) => e.tipo === 'sinal');
  const sinal: (SinalRecebido & { em: number }) | null =
    ultimo && ultimo.tipo === 'sinal' ? { sinal: ultimo.sinal, interceptado: ultimo.interceptado, nome: nome(ultimo.de), em: ultimo.em } : null;

  const jogar = (indice: number, coberta: boolean) => {
    const a = msg.minhasAcoes.find((x) => x.tipo === 'jogar' && x.indice === indice && !!x.coberta === coberta);
    if (a) acoes.enviarAcao(a);
  };
  const alternar = (p: 'sinais' | 'falas' | 'chat') => setPainel((atual) => (atual === p ? null : p));

  const emRitual = ehFaseRitual(v.fase) || v.fase === 'aguardandoMonte';
  const resumoMao = mostrarResumoMao(v) && v.ultimaMao ? resumoFimMao(v.ultimaMao, minha) : null;
  // No ritual a última rodada só fica no centro enquanto o resumo está na tela (depois as cartas já voltaram ao monte).
  const ultimaVisivel = emRitual && !resumoMao ? null : v.ultimaMao;
  const etapa = textoEtapa(v, nome);
  const fim = v.fase === 'fimPartida' ? resumoFimPartida(v) : null;
  const pedido = textoPedidoPendente(v);

  return (
    <main className="tela-mesa">
      <Placar nos={nos} eles={eles} valor={m ? valorMao(v.regras, m.nivel) : null} pedido={pedido?.replace(/\.$/, '') ?? null} />
      <Tampo fisica={msg.mesaFisica} minha={minha} batida={snap.batida}>
        {(['cima', 'esquerda', 'direita'] as const).map((pos) => {
          const c = cadeiraNaPosicao(minha, pos);
          return (
            <Assento
              key={pos}
              posicao={pos}
              info={msg.cadeiras[c]}
              qtdCartas={m?.qtdCartas[c] ?? 0}
              daVez={daVez(c)}
              balao={baloes.get(c) ?? null}
              maoVisivel={c === parceiroDe(minha) ? (m?.maoParceiro ?? null) : null}
              variante={variante}
              vira={vira}
              prazo={msg.prazo?.cadeiras.includes(c) ? msg.prazo : null}
              agora={agora}
            />
          );
        })}
        <CentroMesa
          mao={m}
          ultimaMao={ultimaVisivel}
          minha={minha}
          variante={variante}
          extra={
            <>
              <Monte qtd={v.qtdMonte} dono={donoDoMonte(v)} minha={minha} />
              {/* Sempre montada: a região viva só anuncia mudanças de texto se já existia. */}
              <p className="etapa" role="status" data-testid="etapa">
                {etapa ?? ''}
              </p>
            </>
          }
        />
        <FamiliasNaMesa visao={v} nome={nome} />
        <Assento
          posicao="baixo"
          info={msg.cadeiras[minha]}
          qtdCartas={0}
          daVez={daVez(minha)}
          balao={baloes.get(minha) ?? null}
          maoVisivel={null}
          variante={variante}
          vira={vira}
        />
        <div ref={camadaRitual} className="camada-voo" aria-hidden="true" />
      </Tampo>
      {prazoEhMeu(msg) && msg.prazo && <Cronometro prazo={msg.prazo} agora={agora} />}
      {m ? <Mao cartas={m.minhaMao} jogaveis={ui.jogaveis} cobriveis={ui.cobriveis} variante={variante} vira={vira} aoJogar={jogar} /> : <div />}
      <div className="rodape-mesa">
        <BarraAcoes
          botoes={ui.botoes}
          pedido={pedido}
          aoEscolher={acoes.enviarAcao}
          bate={(b) => botaoBate(b, m)}
          aoBater={acoes.enviarBatida}
        />
        <nav className="barra-social" aria-label="Sinais e falas">
          <button type="button" aria-pressed={painel === 'sinais'} onClick={() => alternar('sinais')}>
            Sinais
          </button>
          <button type="button" aria-pressed={painel === 'falas'} onClick={() => alternar('falas')}>
            Falas
          </button>
          {modo === 'privada' && aoChat && (
            <button type="button" aria-pressed={painel === 'chat'} onClick={() => alternar('chat')}>
              Chat
            </button>
          )}
          <button type="button" onClick={() => setConfirmarSaida(true)}>
            Sair
          </button>
        </nav>
      </div>
      {painel === 'sinais' && (
        <PainelSinais
          chanceInterceptar={msg.chanceInterceptarSinal}
          ultimo={sinal}
          maoLimpa={temCoringa(msg.regras)}
          aoEnviar={(s) => {
            acoes.enviarSinal(s);
            setPainel(null);
          }}
        />
      )}
      {painel === 'falas' && (
        <PainelFalas
          aoEnviar={(f) => {
            acoes.enviarFala(f);
            setPainel(null);
          }}
        />
      )}
      {painel === 'chat' && aoChat && <Chat mensagens={snap.chat} aoEnviar={aoChat} />}
      {confirmarSaida && <ConfirmarSaida ranqueada={modo === 'ranqueada'} aoSair={() => void acoes.sair()} aoCancelar={() => setConfirmarSaida(false)} />}
      {painel !== 'sinais' && sinal && agora - sinal.em < DURACAO_SINAL_MS && (
        <div className="sinal-flutuante" role="status">
          {textoSinalRecebido(sinal)}
        </div>
      )}
      {resumoMao && <FimDeMao titulo={resumoMao.titulo} detalhe={resumoMao.detalhe} />}
      {fim && <FimDePartida titulo={fim.titulo} placar={fim.placar} venceu={fim.venceu} aoJogarDeNovo={aoJogarDeNovo} aoVoltar={() => void acoes.sair()} />}
    </main>
  );
}
