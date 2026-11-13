import { type Cadeira, duplaDe, ehFamilia, ehFaseRitual, fechadasUsadas, LIMITE_FAMILIAS_FECHADAS, parceiroDe, quemDeveAgir } from '@truco/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CartaVisual } from '../componentes/CartaVisual';
import { BaralhoNaPartida } from '../componentes/BaralhoNaPartida';
import { SeletorAparenciaMesa } from '../componentes/SeletorAparenciaMesa';
import { useAnimacaoRitual } from '../componentes/animacaoMesa';
import { Assento, GRITOS } from '../componentes/Assento';
import { BarraAcoes } from '../componentes/BarraAcoes';
import { CentroMesa, useRodadaNaMesa } from '../componentes/CentroMesa';
import { Chat } from '../componentes/Chat';
import { ConfirmarSaida } from '../componentes/ConfirmarSaida';
import { Cronometro } from '../componentes/Cronometro';
import { FamiliasNaMesa } from '../componentes/FamiliasNaMesa';
import { RevelacaoCangada } from '../componentes/RevelacaoCangada';
import { GuiaOrdem } from '../componentes/GuiaOrdem';
import { Icone3D, IconeChat, IconeFalas, IconeManual, IconeSair, IconeSinais, IconeSom } from '../componentes/IconesMesa';
import { ManualMesa } from '../componentes/ManualMesa';
import { Mao } from '../componentes/Mao';
import { Mesa3D } from '../componentes/Mesa3D';
import { Monte } from '../componentes/Monte';
import { FimDeMao, FimDePartida } from '../componentes/Overlays';
import { PainelFalas } from '../componentes/PainelFalas';
import { PainelSinais } from '../componentes/PainelSinais';
import { Placar } from '../componentes/Placar';
import { Tampo } from '../componentes/Tampo';
import { agruparAcoes } from '../logica/acoes';
import { aparenciaPermitida, lerAparenciaMesa, salvarAparenciaMesa, type AparenciaMesa } from '../logica/aparenciaMesa';
import { estiloVerso } from '../logica/lojaItens';
import { botaoBate } from '../logica/batida';
import { rotuloCarta } from '../logica/cartas';
import { baloesAtivos } from '../logica/eventos';
import { estadoMesa3D } from '../logica/mesa3d';
import { cadeiraNaPosicao } from '../logica/posicoes';
import { prazoEhMeu } from '../logica/prazo';
import { donoDoMonte, mostrarResumoMao, textoEtapa } from '../logica/ritual';
import { type SinalRecebido, temCoringa, textoSinalRecebido } from '../logica/sinais';
import { placarRelativo, resumoFimMao, resumoFimPartida, textoPedidoPendente, textoResultadoRodada, valorMao } from '../logica/textos';
import { useAvisoNaAba } from '../logica/avisoAba';
import { dicaAgora, gravarDicas, type IdDica, lerDicas } from '../logica/dicas';
import { useAgora } from '../rede/hooks';
import { gravarVisualizacaoMesa, lerVisualizacaoMesa, type VisualizacaoMesa } from '../logica/visualizacaoMesa';
export { CHAVE_VISTA_3D } from '../logica/visualizacaoMesa';
import { gravarSomLigado, lerSomLigado, useSonsDaMesa } from '../som/useSons';
import type { EstadoLoja, Loja } from '../rede/loja';

const DURACAO_SINAL_MS = 4_000;
interface Props {
  /** Precisa ter `msg.visao` (a App só mostra a mesa depois que a partida começa). */
  snap: EstadoLoja;
  /** Feltro em prévia gratuita para contas; não há cobrança. */
  temConta?: boolean;
  acoes: Pick<Loja, 'enviarAcao' | 'enviarSinal' | 'enviarFala' | 'sair'> & Partial<Pick<Loja, 'enviarBatida' | 'enviarSemFamilia' | 'enviarRevanche'>>;
  aoChat?: (texto: string) => void;
  /** Começa outra partida com as mesmas opções (a App decide como). Sem ele, o fim só volta ao início. */
  aoJogarDeNovo?: () => void;
  /**
   * Conexão caída: a mesa mostra o último estado visto, esmaecida e inerte (nenhum clique,
   * foco ou leitor de tela entra nela). A App mostra o aviso da reconexão por cima.
   */
  desatualizada?: boolean;
  /** Itens da loja que a conta tem (libera os tampos comprados). */
  inventario?: readonly string[];
}

export function TelaMesa({ snap, acoes, aoChat, aoJogarDeNovo, temConta = false, desatualizada = false, inventario = [] }: Props) {
  const agora = useAgora(250);
  const raiz = useRef<HTMLElement>(null);
  // React 18 não conhece `inert` como propriedade booleana: liga direto no elemento.
  useEffect(() => {
    if (raiz.current) raiz.current.inert = desatualizada;
  }, [desatualizada]);
  const [painel, setPainel] = useState<'sinais' | 'falas' | 'chat' | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [manual, setManual] = useState(false);
  const fecharManual = useCallback(() => setManual(false), []);
  const [somLigado, setSomLigado] = useState(lerSomLigado);
  useSonsDaMesa(snap, somLigado, agora);
  // Em outra aba/app: o título pisca e o celular vibra quando é a minha vez de agir.
  useAvisoNaAba(prazoEhMeu(snap.msg!), 'Sua vez! · Truco', somLigado);
  const [visualizacao, setVisualizacao] = useState<VisualizacaoMesa>(lerVisualizacaoMesa);
  const ultima2D = useRef<'personagens' | 'cadeiras'>(visualizacao === 'cadeiras' ? 'cadeiras' : 'personagens');
  const [menuVistas, setMenuVistas] = useState(false);
  const vista3d = visualizacao === '3d';
  const [aparenciaSalva, setAparenciaSalva] = useState<AparenciaMesa>(lerAparenciaMesa);
  const [personalizando, setPersonalizando] = useState(false);
  const aparencia = aparenciaPermitida(aparenciaSalva, temConta, inventario);
  const mudarAparencia = (escolhida: AparenciaMesa) => {
    if (aparenciaPermitida(escolhida, temConta, inventario) !== escolhida) return;
    setAparenciaSalva(escolhida);
    salvarAparenciaMesa(escolhida);
  };
  const [aviso3d, setAviso3d] = useState<string | null>(null);
  const escolherVisualizacao = (nova: VisualizacaoMesa) => {
    if (nova !== '3d') ultima2D.current = nova;
    setVisualizacao(nova);
    gravarVisualizacaoMesa(nova);
    setAviso3d(null);
    setMenuVistas(false);
  };
  const trocarVista = () => escolherVisualizacao(vista3d ? ultima2D.current : '3d');
  const falhar3d = useCallback((motivo: string) => {
    console.warn('[vista 3D]', motivo);
    setVisualizacao(ultima2D.current);
    gravarVisualizacaoMesa(ultima2D.current);
    setAviso3d('Não deu para abrir a vista 3D neste aparelho. Voltamos para a mesa normal.');
  }, []);
  const msg = snap.msg!;
  const modo = msg.modo;
  const v = msg.visao!;
  const verso = estiloVerso(msg.cadeiras[v.pe]?.visual?.verso);
  const m = v.mao;
  const minha = msg.minhaCadeira;
  const camadaRitual = useRef<HTMLDivElement>(null);
  useAnimacaoRitual(snap.movimentos, minha, camadaRitual);
  const variante = v.regras.variante;
  const vira = m?.vira ?? null;
  const ui = agruparAcoes(msg.minhasAcoes, v);
  // Em até 340 px de largura, três balões ao mesmo tempo se encobriam: mostra só os 2 mais recentes.
  const estreita = typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 340px)').matches ?? false);
  const baloes = baloesAtivos(snap.eventos, agora, undefined, estreita ? 2 : Infinity);
  const { nos, eles } = placarRelativo(v);
  const nome = (c: Cadeira) => msg.cadeiras[c]?.nome ?? `Cadeira ${c + 1}`;
  const agentes = quemDeveAgir(v);
  const daVez = (c: Cadeira) => agentes.includes(c);

  const ultimo = [...snap.eventos].reverse().find((e) => e.tipo === 'sinal');
  const sinal: (SinalRecebido & { em: number }) | null =
    ultimo && ultimo.tipo === 'sinal' ? { sinal: ultimo.sinal, interceptado: ultimo.interceptado, nome: nome(ultimo.de), em: ultimo.em } : null;

  const jogar = (indice: number, coberta: boolean) => {
    const a =
      msg.minhasAcoes.find((x) => x.tipo === 'jogar' && x.indice === indice && !!x.coberta === coberta) ??
      msg.minhasAcoes.find((x) => x.tipo === 'empilhar' && x.indice === indice);
    if (a) acoes.enviarAcao(a);
  };
  const alternar = (p: 'sinais' | 'falas' | 'chat') => setPainel((atual) => (atual === p ? null : p));

  const emRitual = ehFaseRitual(v.fase) || v.fase === 'aguardandoMonte';
  const resumoMao = mostrarResumoMao(v) && v.ultimaMao ? resumoFimMao(v.ultimaMao, minha) : null;
  // No ritual a última rodada só fica no centro enquanto o resumo está na tela (depois as cartas já voltaram ao monte).
  const ultimaVisivel = emRitual && !resumoMao ? null : v.ultimaMao;
  const etapa = textoEtapa(v, nome);
  const podeTreinarEmbaralhamento = v.fase === 'embaralhando' && v.ritual?.embaralhador === minha;
  // Sem etapa do ritual: a linha do meio diz de quem é a vez e, se é de humano, quanto tempo falta.
  // Na vista 3D a cena já marca a vez (anel e segundos): a linha fica só para o ritual.
  const vezTexto = etapa || msg.janelaFamilia || vista3d ? null : textoVez(v, agentes, minha, nome, msg.prazo, agora);
  const fim = v.fase === 'fimPartida' ? resumoFimPartida(v) : null;
  const pedido = textoPedidoPendente(v);
  // Primeira partida guiada: uma dica por vez; some ao tocar "Entendi" ou quando a pessoa já agiu.
  const [dicas, setDicas] = useState(lerDicas);
  const dica = dicas.desligadas ? null : dicaAgora(msg, ui, dicas.vistas);
  const marcarVista = useCallback((id: IdDica) => {
    setDicas((d) => {
      if (d.vistas.includes(id)) return d;
      const nova = { ...d, vistas: [...d.vistas, id] };
      gravarDicas(nova);
      return nova;
    });
  }, []);
  const dicaAnterior = useRef<IdDica | null>(null);
  useEffect(() => {
    const antes = dicaAnterior.current;
    dicaAnterior.current = dica?.id ?? null;
    if (antes && antes !== dica?.id) marcarVista(antes);
  }, [dica?.id, marcarVista]);
  const rodada = useRodadaNaMesa(m, ultimaVisivel);
  // Enquanto a rodada que fechou fica no meio (MOSTRA_RODADA_MS), a linha diz quem levou; a vez
  // continua no assento ("vez") e no placar. Anunciada (polite); a vez com segundos não (off).
  const exib = rodada.exibicao;
  const resultadoRodada = m && !etapa && exib.anterior && exib.jogadas.length > 0 && exib.resultado !== null
    ? textoResultadoRodada(exib.resultado, duplaDe(minha))
    : null;
  const textoLinha = etapa ?? resultadoRodada ?? vezTexto ?? '';
  const soVez = !etapa && !resultadoRodada && !!vezTexto;
  const linhaEtapa = (
    // Sempre montada: a região viva só anuncia mudanças de texto se já existia.
    <p className={soVez ? 'etapa vez-linha' : 'etapa'} role="status" data-testid="etapa" aria-live={soVez ? 'off' : undefined}>
      {textoLinha}
    </p>
  );
  // Uma região só para leitor de tela: o pedido com o valor em jogo, ou "Sua vez." (sem segundos).
  const anuncio = pedido ?? (v.fase === 'jogando' && !msg.janelaFamilia && daVez(minha) ? 'Sua vez.' : '');

  return (
    <main
      ref={raiz}
      className="tela-mesa"
      data-visualizacao={visualizacao}
      data-desatualizada={desatualizada || undefined}
      aria-hidden={desatualizada || undefined}
      // O baralho da mão é o de quem dá as cartas (o pé): todos veem o verso que ele equipou.
      data-verso={verso?.estampa}
      style={verso?.style}
    >
      {/* Menu da mesa: ícones no canto de cima (o nome de cada um vai no aria-label e no title). */}
      <nav className="barra-mesa" aria-label="Menu da mesa">
        {msg.sinais !== false && (
          <button type="button" className="icone-mesa" aria-label="Sinais" title="Sinais" aria-pressed={painel === 'sinais'} onClick={() => alternar('sinais')}>
            <IconeSinais />
          </button>
        )}
        <button type="button" className="icone-mesa" aria-label="Falas" title="Falas" aria-pressed={painel === 'falas'} onClick={() => alternar('falas')}>
          <IconeFalas />
        </button>
        {modo === 'privada' && aoChat && (
          <button type="button" className="icone-mesa" aria-label="Chat" title="Chat" aria-pressed={painel === 'chat'} onClick={() => alternar('chat')}>
            <IconeChat />
          </button>
        )}
        <button type="button" className="icone-mesa" aria-label="Personalizar mesa" title="Escolher madeira, feltro ou plástico" aria-expanded={personalizando} aria-controls="personalizar-mesa" onClick={() => setPersonalizando((v) => !v)}>
          <span aria-hidden="true">♣</span>
        </button>
        <button type="button" className="icone-mesa" aria-label="Visual da mesa" aria-expanded={menuVistas} aria-controls="menu-visualizacao-mesa" title="Personagens, cadeiras ou 3D" onClick={() => setMenuVistas((v) => !v)}>
          <span aria-hidden="true">▦</span>
        </button>
        <button type="button" className="icone-mesa" aria-label="3D" title={vista3d ? 'Voltar para a mesa 2D' : 'Ver a mesa em 3D'} aria-pressed={vista3d} onClick={trocarVista}>
          <Icone3D />
        </button>
        <button
          type="button"
          className="icone-mesa"
          aria-label="Som"
          aria-pressed={somLigado}
          title={somLigado ? 'Desligar o som' : 'Ligar o som'}
          onClick={() =>
            setSomLigado((x) => {
              gravarSomLigado(!x);
              return !x;
            })
          }
        >
          <IconeSom ligado={somLigado} />
        </button>
        <button type="button" className="icone-mesa botao-ajuda" aria-label="Como jogar" title="Como jogar" onClick={() => setManual(true)}>
          <IconeManual />
        </button>
        <button type="button" className="icone-mesa" aria-label="Sair" title="Sair da mesa" onClick={() => setConfirmarSaida(true)}>
          <IconeSair />
        </button>
      </nav>
      {menuVistas && (
        <div className="menu-visualizacao-mesa" id="menu-visualizacao-mesa" role="group" aria-label="Selecionar visualização da mesa">
          {([
            ['personagens', 'Personagens'],
            ['cadeiras', 'Cadeiras (vista de cima)'],
            ['3d', '3D'],
          ] as const).map(([id, rotulo]) => (
            <button type="button" key={id} aria-pressed={visualizacao === id} onClick={() => escolherVisualizacao(id)}>{rotulo}</button>
          ))}
        </div>
      )}
      {personalizando && (
        <SeletorAparenciaMesa
          valor={aparencia}
          temConta={temConta}
          inventario={inventario}
          aoEscolher={mudarAparencia}
          aoFechar={() => setPersonalizando(false)}
        />
      )}
      <Placar
        nos={nos}
        eles={eles}
        valor={m ? valorMao(v.regras, m.nivel) : null}
        pedido={pedido?.replace(/\.$/, '') ?? null}
        situacao={
          (fim ? 'Partida encerrada' : msg.janelaFamilia ? 'Hora da família' : etapa ? 'Preparando a mão' : daVez(minha) ? 'Sua vez' : 'Aguardando jogada') +
          (msg.cacife?.efetivo ? ` · pote ${msg.cacife.pote} Fichas` : '')
        }
      />
      {vista3d ? (
        <div className="mesa-3d" data-testid="mesa-3d">
          <Mesa3D
            estado={{ ...estadoMesa3D({
              visao: v,
              minha,
              cadeiras: msg.cadeiras,
              prazo: msg.prazo,
              mesaFisica: msg.mesaFisica,
              baloes,
              exibicao: rodada.exibicao,
              naPilha: rodada.naPilha,
              agora,
            }), aparenciaMesa: aparencia }}
            minha={minha}
            batida={snap.batida}
            aoFalhar={falhar3d}
          />
          <div className="mesa-3d-hud">
            {linhaEtapa}
            <FamiliasNaMesa visao={v} nome={nome} />
            <RevelacaoCangada dados={rodada.cangadaLateral} variante={variante} vira={vira} minha={minha} />
            <GuiaOrdem regras={v.regras} vira={vira} mao={m?.minhaMao ?? []} />
            {m?.maoParceiro && (
              <div className="mesa-3d-parceiro" aria-label={`Mão de ${nome(parceiroDe(minha))}`}>
                {m.maoParceiro.map((c) => (
                  <CartaVisual key={`${c.valor}${c.naipe}`} carta={c} variante={variante} vira={vira} tamanho="pequena" />
                ))}
              </div>
            )}
            {/* A cena é desenho: o que está na mesa vai em texto para o leitor de tela. */}
            <ul className="so-leitor" aria-label="Cartas na mesa">
              {rodada.exibicao.jogadas.map(({ chave, jogada: j }) => (
                <li key={chave}>
                  {nome(j.cadeira)}: {j.coberta || !j.carta ? 'carta coberta' : rotuloCarta(j.carta, variante, vira)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
      <Tampo
        aparencia={aparencia}
        fisica={msg.mesaFisica}
        minha={minha}
        batida={snap.batida}
        jogadores={(['cima', 'esquerda', 'direita'] as const).map((pos) => {
          const c = cadeiraNaPosicao(minha, pos);
          return { pos, nome: nome(c), daVez: daVez(c), gritando: GRITOS.has(baloes.get(c) ?? ''), roupa: msg.cadeiras[c]?.visual?.roupa };
        })}
      >
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
              {linhaEtapa}
            </>
          }
        />
        <FamiliasNaMesa visao={v} nome={nome} />
        <GuiaOrdem regras={v.regras} vira={vira} mao={m?.minhaMao ?? []} />
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
      )}
      {podeTreinarEmbaralhamento && <BaralhoNaPartida key={minha} />}
      {aviso3d && (
        <p className="aviso-3d" role="alert">
          {aviso3d}
        </p>
      )}
      {dica && (
        <aside className="dica-mesa" aria-label="Dica">
          <p>{dica.texto}</p>
          <div className="dica-mesa-botoes">
            <button type="button" onClick={() => marcarVista(dica.id)}>
              Entendi
            </button>
            <button
              type="button"
              className="botao-discreto"
              onClick={() => {
                const nova = { ...dicas, desligadas: true };
                gravarDicas(nova);
                setDicas(nova);
              }}
            >
              Sem dicas
            </button>
          </div>
        </aside>
      )}
      {prazoEhMeu(msg) && msg.prazo && <Cronometro prazo={msg.prazo} agora={agora} />}
      {m ? (
        <Mao
          cartas={m.minhaMao}
          jogaveis={ui.empilhaveis.length > 0 ? ui.empilhaveis : ui.jogaveis}
          cobriveis={ui.cobriveis}
          variante={variante}
          vira={vira}
          aoJogar={jogar}
          pilha={!m.cangada ? null : ui.empilhaveis.length > 0 ? 'escolher' : m.cangada.empilhou[minha] && m.minhaMao.length === 2 ? 'empilhada' : null}
        />
      ) : (
        <div />
      )}
      <div className="rodape-mesa">
        {msg.janelaFamilia && (
          <JanelaFamilia
            restam={Math.max(0, Math.ceil((msg.janelaFamilia.ate - agora) / 1000))}
            decidi={msg.janelaFamilia.decidiram.includes(minha)}
            fechadas={m ? fechadasUsadas(m) : 0}
            podePedir={!!m && (fechadasUsadas(m) < LIMITE_FAMILIAS_FECHADAS || m.minhaMao.every((c) => c !== null) && ehFamilia(m.minhaMao as Exclude<typeof m.minhaMao[number], null>[]))}
            aoPassar={acoes.enviarSemFamilia}
          />
        )}
        <BarraAcoes
          botoes={ui.botoes}
          pedido={pedido}
          aoEscolher={acoes.enviarAcao}
          bate={(b) => botaoBate(b, m)}
          aoBater={acoes.enviarBatida}
        />
      </div>
      {/* Depois do rodapé, e não entre a mão e ele: o desktop põe as ações ao lado da mão com
          `.minha-mao + .rodape-mesa` (estilos.css), e um irmão no meio quebrava o seletor. */}
      <p className="so-leitor" role="status" data-testid="anuncio-mesa">{anuncio}</p>
      {painel === 'sinais' && msg.sinais !== false && (
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
      {manual && <ManualMesa aoFechar={fecharManual} variante={variante} />}
      {resumoMao && <FimDeMao titulo={resumoMao.titulo} detalhe={resumoMao.detalhe} />}
      {fim && (
        <FimDePartida
          titulo={fim.titulo}
          placar={fim.placar}
          venceu={fim.venceu}
          cacife={msg.cacife}
          aoJogarDeNovo={aoJogarDeNovo}
          aoVoltar={() => void acoes.sair()}
          revanche={
            msg.revanche && acoes.enviarRevanche
              ? {
                  aoPedir: acoes.enviarRevanche,
                  jaPedi: msg.revanche.votos.includes(minha),
                  quantos: [msg.revanche.votos.length, msg.revanche.votos.length + msg.revanche.faltam.length],
                }
              : null
          }
        />
      )}
    </main>
  );
}

/**
 * Hora de pedir família, logo depois de dar: ninguém joga carta ainda (nem quem começa).
 * "Família!" fica na barra de ações; aqui o "Sem família" adianta o jogo quando todos decidem.
 */
function JanelaFamilia({ restam, decidi, fechadas, podePedir, aoPassar }: { restam: number; decidi: boolean; fechadas: number; podePedir: boolean; aoPassar?: () => void }) {
  return (
    <div className="janela-familia" role="group" aria-label="Hora de pedir família">
      <span className="janela-familia-texto">
        {decidi || !podePedir ? 'Esperando os outros' : 'Tem família?'} <strong>{restam}s</strong>
      </span>
      <small className="familia-limite">Fechadas usadas: {fechadas}/{LIMITE_FAMILIAS_FECHADAS}</small>
      {!decidi && podePedir && aoPassar && (
        <button type="button" onClick={aoPassar}>
          Sem família
        </button>
      )}
    </div>
  );
}

/** "Sua vez · 18s", "Vez de Bia · 9s", "Vez de Bot Zé": só na hora de jogar carta (uma cadeira agindo). */
function textoVez(
  v: { fase: string },
  agentes: Cadeira[],
  minha: Cadeira,
  nome: (c: Cadeira) => string,
  prazo: { cadeiras: Cadeira[]; ate: number } | null,
  agora: number,
): string | null {
  if (v.fase !== 'jogando' || agentes.length !== 1) return null;
  const c = agentes[0];
  const s = prazo?.cadeiras.includes(c) ? Math.max(0, Math.ceil((prazo.ate - agora) / 1000)) : null;
  const quem = c === minha ? 'Sua vez' : `Vez de ${nome(c)}`;
  return s === null ? quem : `${quem} · ${s}s`;
}
