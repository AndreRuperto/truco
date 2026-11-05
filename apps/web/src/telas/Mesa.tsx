import { type Cadeira, parceiroDe, quemDeveAgir } from '@truco/engine';
import { useState } from 'react';
import { Assento } from '../componentes/Assento';
import { BarraAcoes } from '../componentes/BarraAcoes';
import { CartaVisual } from '../componentes/CartaVisual';
import { CentroMesa } from '../componentes/CentroMesa';
import { Cronometro } from '../componentes/Cronometro';
import { Mao } from '../componentes/Mao';
import { FimDeMao, FimDePartida } from '../componentes/Overlays';
import { PainelFalas } from '../componentes/PainelFalas';
import { PainelSinais } from '../componentes/PainelSinais';
import { Placar } from '../componentes/Placar';
import { agruparAcoes } from '../logica/acoes';
import { baloesAtivos } from '../logica/eventos';
import { cadeiraNaPosicao } from '../logica/posicoes';
import { prazoEhMeu } from '../logica/prazo';
import { type SinalRecebido, textoSinalRecebido } from '../logica/sinais';
import {
  placarRelativo,
  resumoFimMao,
  resumoFimPartida,
  textoFamilia,
  textoPedidoPendente,
  valorMao,
} from '../logica/textos';
import { useAgora } from '../rede/hooks';
import type { EstadoLoja, Loja } from '../rede/loja';

const DURACAO_SINAL_MS = 4_000;

interface Props {
  /** Precisa ter `msg.visao` (a App só mostra a mesa depois que a partida começa). */
  snap: EstadoLoja;
  acoes: Pick<Loja, 'enviarAcao' | 'enviarSinal' | 'enviarFala' | 'sair'>;
}

export function TelaMesa({ snap, acoes }: Props) {
  const agora = useAgora(250);
  const [painel, setPainel] = useState<'sinais' | 'falas' | null>(null);
  const msg = snap.msg!;
  const v = msg.visao!;
  const m = v.mao;
  const minha = msg.minhaCadeira;
  const variante = v.regras.variante;
  const vira = m?.vira ?? null;
  const ui = agruparAcoes(msg.minhasAcoes, m);
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
  const alternar = (p: 'sinais' | 'falas') => setPainel((atual) => (atual === p ? null : p));

  const entreMaos = !m && v.fase === 'aguardandoDistribuicao';
  const familia = entreMaos ? textoFamilia(v, nome) : null;
  const resumoMao = entreMaos && !familia && v.ultimaMao ? resumoFimMao(v.ultimaMao, minha) : null;
  const fim = v.fase === 'fimPartida' ? resumoFimPartida(v) : null;

  return (
    <main className="tela-mesa">
      <Placar nos={nos} eles={eles} valor={m ? valorMao(v.regras, m.nivel) : null} />
      <div className="feltro">
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
        <CentroMesa mao={m} ultimaMao={v.ultimaMao} minha={minha} variante={variante} />
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
      </div>
      {prazoEhMeu(msg) && msg.prazo && <Cronometro prazo={msg.prazo} agora={agora} />}
      <BarraAcoes botoes={ui.botoes} pedido={textoPedidoPendente(v)} aoEscolher={acoes.enviarAcao} />
      {m && <Mao cartas={m.minhaMao} jogaveis={ui.jogaveis} cobriveis={ui.cobriveis} variante={variante} vira={vira} aoJogar={jogar} />}
      <nav className="barra-social" aria-label="Sinais e falas">
        <button type="button" aria-pressed={painel === 'sinais'} onClick={() => alternar('sinais')}>
          Sinais
        </button>
        <button type="button" aria-pressed={painel === 'falas'} onClick={() => alternar('falas')}>
          Falas
        </button>
      </nav>
      {painel === 'sinais' && (
        <PainelSinais
          chanceInterceptar={msg.chanceInterceptarSinal}
          ultimo={sinal}
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
      {painel !== 'sinais' && sinal && agora - sinal.em < DURACAO_SINAL_MS && (
        <div className="sinal-flutuante" role="status">
          {textoSinalRecebido(sinal)}
        </div>
      )}
      {familia && (
        <FimDeMao titulo="Família!" detalhe={familia}>
          {v.ultimaFamilia?.cartas && (
            <div className="cartas-familia" aria-label="Cartas da família">
              {v.ultimaFamilia.cartas.map((c, i) => (
                <CartaVisual key={i} carta={c} variante={variante} vira={null} tamanho="pequena" />
              ))}
            </div>
          )}
        </FimDeMao>
      )}
      {resumoMao && <FimDeMao titulo={resumoMao.titulo} detalhe={resumoMao.detalhe} />}
      {fim && <FimDePartida titulo={fim.titulo} placar={fim.placar} venceu={fim.venceu} aoJogarDeNovo={() => void acoes.sair()} />}
    </main>
  );
}
