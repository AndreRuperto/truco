import type { PreferenciasMesa, UsuarioApi } from '@truco/api';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Cabecalho } from './componentes/Cabecalho';
import { FundoCartas } from './componentes/FundoCartas';
import { Toast } from './componentes/Toast';
import { formInicial, gravarAvatarLocal, lerApelido, lerAvatarLocal, lerPreferenciasLocais, type OpcoesEntrada, opcoesDeEntrada, opcoesDeVitrine } from './logica/lobby';
import { criarMesaAberta, criarMesaPrivada, entrarNaMesa, entrarPorCodigo, lerToken, tentarReconectar } from './rede/conexao';
import { useCarteira, useFila, useLoja, useSessao } from './rede/hooks';
import { api, carteira, loja, lojaFila, sessao } from './rede/instancia';
import { TelaLoja, TelaLojaObrigado } from './telas/Loja';
import { itemPorIdDoCatalogo, textoDosBonus } from './logica/lojaApp';
import { navegar, useRota } from './rede/rota';
import { TelaEntrar } from './telas/Entrar';
import { TelaEntrarPrivada } from './telas/EntrarPrivada';
import { TelaFila } from './telas/Fila';
import { TelaHistorico } from './telas/Historico';
import { Lobby } from './telas/Lobby';
import { TelaMesa } from './telas/Mesa';
import { TelaPerfil } from './telas/Perfil';
import { TelaRanking } from './telas/Ranking';
import { SalaEspera } from './telas/SalaEspera';
import { TelaSalas } from './telas/Salas';
import { TelaAdmin } from './telas/Admin';
import { TelaComoJogar } from './telas/ComoJogar';

/** Tela que exige login: espera a sessão; convidado (ou sessão expirada) recebe o link para entrar. */
function PedirLogin({ titulo, pronta }: { titulo: string; pronta: boolean }) {
  return (
    <main className="tela-conta">
      <h1>{titulo}</h1>
      {pronta ? (
        <p>
          Para ver isto, <a href="#/entrar">entre na sua conta</a>.
        </p>
      ) : (
        <p role="status">Carregando…</p>
      )}
    </main>
  );
}

/** Como o jogador entrou na última mesa, para "Jogar de novo" repetir (vale até recarregar a página). */
let ultimaEntrada: { tipo: 'mesa' | 'aberta' | 'privada'; opcoes: OpcoesEntrada } | null = null;

function jogarDeNovo(): void {
  const modo = loja.getSnapshot().msg?.modo;
  const entrada = ultimaEntrada;
  // `sair` larga o estado local na hora; não precisa esperar o servidor fechar a sala antiga.
  void loja.sair();
  if (modo === 'ranqueada') {
    navegar({ tela: 'fila' });
    void lojaFila.reentrar();
  } else if (entrada?.tipo === 'privada') void criarMesaPrivada(loja, entrada.opcoes);
  else if (entrada?.tipo === 'aberta') void criarMesaAberta(loja, entrada.opcoes);
  else if (entrada) void entrarNaMesa(loja, entrada.opcoes);
}

function podeJogarDeNovo(modo: string | undefined): boolean {
  return modo === 'ranqueada' ? lojaFila.getSnapshot().opcoes !== null : ultimaEntrada !== null;
}

export function App() {
  const snap = useLoja(loja);
  const ses = useSessao(sessao);
  const rota = useRota();
  const fila = useFila(lojaFila);
  const cart = useCarteira(carteira);
  const [avisoBonus, setAvisoBonus] = useState<string | null>(null);
  // Regras da tela inicial guardadas na conta: undefined = sem conta ou carregando.
  const [prefsConta, setPrefsConta] = useState<PreferenciasMesa | null | undefined>(undefined);
  const idUsuario = ses.usuario?.id;
  // Carteira da conta: ao entrar (aplica os bônus do dia no servidor) e ao voltar de uma partida.
  useEffect(() => {
    if (idUsuario === undefined) {
      carteira.limpar();
      return;
    }
    void carteira.carregar().then((c) => {
      const t = c ? textoDosBonus(c.bonus) : null;
      if (t) setAvisoBonus(t);
    });
  }, [idUsuario, snap.status === 'fora']);
  useEffect(() => {
    if (rota.tela === 'loja') void carteira.carregarCatalogo();
  }, [rota.tela]);
  useEffect(() => {
    setPrefsConta(undefined);
    if (idUsuario === undefined) return;
    let vivo = true;
    api
      .preferencias()
      .then((r) => vivo && setPrefsConta(r.preferencias))
      .catch(() => vivo && setPrefsConta(null));
    return () => {
      vivo = false;
    };
  }, [idUsuario]);
  const salvarPrefs = useCallback((p: PreferenciasMesa) => {
    // Falhar ao salvar não atrapalha o jogo: o aparelho já guardou uma cópia.
    api.salvarPreferencias(p).catch(() => {});
  }, []);
  const nomePadrao = () => ses.usuario?.apelido ?? (lerApelido() || 'Jogador');
  // Foto: com conta, a da conta (o servidor usa essa); sem conta, a escolhida e guardada no aparelho.
  const [avatarLocal, setAvatarLocal] = useState<string | null>(lerAvatarLocal);
  const avatar = ses.usuario ? (ses.usuario.avatar ?? null) : avatarLocal;
  const trocarAvatar = async (v: string | null) => {
    if (ses.usuario) {
      sessao.definirUsuario((await api.trocarAvatar(v)).usuario);
      return;
    }
    gravarAvatarLocal(v);
    setAvatarLocal(v);
  };
  const comFoto = (o: OpcoesEntrada): OpcoesEntrada => ({ ...o, avatar: ses.usuario ? null : avatarLocal });

  useEffect(() => {
    void tentarReconectar(loja);
    void sessao.carregar();
  }, []);

  useEffect(() => {
    if (snap.status !== 'reconectando') return;
    const tentar = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && lerToken()) {
        void tentarReconectar(loja);
      }
    };
    // O Android pode congelar timers em segundo plano; visibilitychange
    // garante uma tentativa imediata quando o jogador retorna à aba.
    document.addEventListener('visibilitychange', tentar);
    window.addEventListener('online', tentar);
    const intervalo = window.setInterval(tentar, 5000);
    tentar();
    return () => {
      document.removeEventListener('visibilitychange', tentar);
      window.removeEventListener('online', tentar);
      window.clearInterval(intervalo);
    };
  }, [snap.status]);

  const aoEntrar = useCallback((u: UsuarioApi) => {
    sessao.definirUsuario(u);
    // substitui #/entrar: "voltar" depois de entrar não reabre a tela de login
    navegar({ tela: 'inicio' }, { substituir: true });
  }, []);

  let tela;
  // Queda de conexão com uma partida já na tela: a mesa fica, esmaecida e sem comandos, com o
  // último estado visto (sem cronômetro, que já não vale), até o estado novo chegar.
  const anterior = snap.estadoAnterior?.visao ? snap.estadoAnterior : null;
  const mesaCaida = !!anterior && !snap.msg && snap.status !== 'fora';
  if (mesaCaida)
    tela = (
      <TelaMesa
        temConta={!!ses.usuario}
        inventario={cart.carteira?.inventario}
        snap={{ ...snap, msg: { ...anterior, prazo: null } }}
        acoes={loja}
        desatualizada
      />
    );
  else if (snap.status === 'conectando') tela = <p className="aviso-centro">Conectando…</p>;
  else if (snap.status === 'reconectando') tela = (
    <main className="aviso-centro" role="status">
      <p>Recuperando sua mesa e sua cadeira…</p>
      <p>Ao voltar para esta aba, a conexão será tentada automaticamente.</p>
      <button type="button" onClick={() => void tentarReconectar(loja)}>Tentar novamente</button>
      <button type="button" onClick={() => loja.desistirReconexao()}>Voltar ao início</button>
    </main>
  );
  else if (snap.status !== 'fora') {
    if (!snap.msg) tela = <p className="aviso-centro">Entrando na mesa…</p>;
    else if (!snap.msg.visao)
      tela = (
        <SalaEspera
          msg={snap.msg}
          aoIniciar={loja.iniciar}
          aoSair={() => void loja.sair()}
          salaId={snap.salaId}
          chat={snap.chat}
          aoChat={loja.enviarChat}
        />
      );
    else
      tela = (
        <TelaMesa
          temConta={!!ses.usuario}
          inventario={cart.carteira?.inventario}
          snap={snap}
          acoes={loja}
          aoChat={loja.enviarChat}
          aoJogarDeNovo={podeJogarDeNovo(snap.msg.modo) ? jogarDeNovo : undefined}
        />
      );
  } else {
    let conteudo;
    switch (rota.tela) {
      case 'entrar':
        conteudo = <TelaEntrar token={rota.token} config={ses.config} api={api} aoEntrar={aoEntrar} />;
        break;
      case 'perfil':
        conteudo =
          rota.id === null && !ses.usuario ? (
            <PedirLogin titulo="Perfil" pronta={ses.pronta} />
          ) : (
            <TelaPerfil
              key={rota.id ?? 'eu'}
              id={rota.id}
              editar={rota.editar === true}
              api={api}
              usuario={ses.usuario}
              googleClientId={ses.config.google}
              aoTrocarApelido={(u) => sessao.definirUsuario(u)}
            />
          );
        break;
      case 'historico':
        conteudo = ses.usuario ? <TelaHistorico api={api} /> : <PedirLogin titulo="Histórico" pronta={ses.pronta} />;
        break;
      case 'ranking':
        conteudo = <TelaRanking variante={rota.variante} api={api} />;
        break;
      case 'salas':
        conteudo = (
          <TelaSalas
            api={api}
            aoEntrar={(id) => void entrarPorCodigo(loja, id, { nome: nomePadrao(), avatar: ses.usuario ? null : avatarLocal })}
            aoJogarComBots={() => {
              // As regras de sempre (conta > aparelho > padrão), só eu contra 3 bots.
              const f = { ...formInicial(nomePadrao(), prefsConta ?? lerPreferenciasLocais()), humanos: 1 };
              const o = comFoto(opcoesDeEntrada(f));
              ultimaEntrada = { tipo: 'mesa', opcoes: o };
              void entrarNaMesa(loja, o);
            }}
            aoCriarMesa={(tipo, acesso) => {
              const o = comFoto(opcoesDeVitrine(tipo, acesso, nomePadrao(), prefsConta ?? lerPreferenciasLocais()));
              ultimaEntrada = { tipo: acesso === 'privada' ? 'privada' : 'aberta', opcoes: o };
              if (acesso === 'privada') void criarMesaPrivada(loja, o);
              else void criarMesaAberta(loja, o);
            }}
            aoRanqueada={() => navegar(ses.usuario ? { tela: 'fila' } : { tela: 'entrar', token: null })}
          />
        );
        break;
      case 'privada':
        conteudo = (
          <TelaEntrarPrivada
            key={rota.codigo}
            codigo={rota.codigo}
            nomeInicial={ses.usuario?.apelido ?? lerApelido()}
            avatar={avatar}
            aoTrocarAvatar={trocarAvatar}
            aoEntrar={(nome) => {
              // ao sair da mesa volta ao início, não à tela do convite
              navegar({ tela: 'inicio' });
              void entrarPorCodigo(loja, rota.codigo, { nome, avatar: ses.usuario ? null : avatarLocal });
            }}
          />
        );
        break;
      case 'manual':
        conteudo = <TelaComoJogar />;
        break;
      case 'loja':
        conteudo = (
          <TelaLoja
            aba={rota.aba}
            api={api}
            usuario={ses.usuario}
            catalogo={cart.catalogo}
            carteira={cart.carteira}
            aoMudar={async () => {
              await carteira.carregar();
              // O avatar da loja fica na conta: a sessão precisa da foto nova.
              const eu = await api.eu().catch(() => null);
              if (eu?.usuario) sessao.definirUsuario(eu.usuario);
            }}
          />
        );
        break;
      case 'lojaObrigado':
        conteudo = ses.usuario ? (
          <TelaLojaObrigado pedido={rota.pedido} api={api} aoPago={() => void carteira.carregar()} />
        ) : (
          <PedirLogin titulo="Compra de Pila" pronta={ses.pronta} />
        );
        break;
      case 'admin':
        conteudo = ses.usuario ? <TelaAdmin aba={rota.aba} api={api} /> : <PedirLogin titulo="Admin" pronta={ses.pronta} />;
        break;
      case 'fila':
        conteudo =
          ses.pronta && !ses.usuario ? (
            <main className="tela-conta">
              <h1>Ranqueada</h1>
              <p>
                Para jogar ranqueada, <a href="#/entrar">entre na sua conta</a>.
              </p>
            </main>
          ) : (
            <TelaFila estado={fila} aoEntrar={(o) => void lojaFila.entrar(o)} aoCancelar={() => void lojaFila.cancelar()} />
          );
        break;
      default:
        conteudo = (
          <Lobby
            aoJogar={(cru) => {
              const o = comFoto(cru);
              ultimaEntrada = { tipo: 'mesa', opcoes: o };
              void entrarNaMesa(loja, o);
            }}
            aoCriarPrivada={(cru) => {
              const o = comFoto(cru);
              ultimaEntrada = { tipo: 'privada', opcoes: o };
              void criarMesaPrivada(loja, o);
            }}
            avatar={avatar}
            aoTrocarAvatar={trocarAvatar}
            apelidoConta={ses.usuario?.apelido}
            aoRanqueada={() => navegar(ses.usuario ? { tela: 'fila' } : { tela: 'entrar', token: null })}
            preferenciasConta={ses.usuario ? prefsConta : undefined}
            aoSalvarNaConta={ses.usuario ? salvarPrefs : undefined}
          />
        );
    }
    tela = (
      <>
        <Cabecalho
          pronta={ses.pronta}
          usuario={ses.usuario}
          atual={rota.tela === 'perfil' && rota.id !== null ? undefined : rota.tela === 'lojaObrigado' ? 'loja' : rota.tela}
          saldos={cart.carteira}
          moldura={itemPorIdDoCatalogo(cart.catalogo, cart.carteira?.equipados.moldura)}
          aoSair={() => {
            navegar({ tela: 'inicio' });
            void sessao.sair();
          }}
        />
        {avisoBonus && snap.status === 'fora' && (
          <div className="faixa-bonus" role="status">
            <span>{avisoBonus}</span>
            <button type="button" className="botao-discreto" onClick={() => setAvisoBonus(null)}>
              Fechar
            </button>
          </div>
        )}
        {/* A tela inicial tem o fundo de cartas inteiro (com mouse); as outras, a versão discreta. */}
        {rota.tela !== 'inicio' && <FundoCartas discreto />}
        {/* trocar de conta remonta a tela: nada do usuário anterior sobrevive em estado local */}
        <Fragment key={ses.usuario?.id ?? 'anon'}>{conteudo}</Fragment>
      </>
    );
  }

  return (
    <>
      {mesaCaida ? (
        <div className="faixa-aviso faixa-reconexao" role="status">
          <p>
            <strong>Conexão caiu — reconectando…</strong>
            <span>Sua cadeira fica guardada. A mesa volta sozinha quando a internet voltar.</span>
          </p>
          {snap.status === 'reconectando' && (
            <div className="faixa-reconexao-botoes">
              <button type="button" onClick={() => void tentarReconectar(loja)}>
                Tentar agora
              </button>
              <button type="button" className="botao-discreto" onClick={() => loja.desistirReconexao()}>
                Voltar ao início
              </button>
            </div>
          )}
        </div>
      ) : (
        snap.status === 'reconectando' && (
          <div className="faixa-aviso" role="status">
            Conexão caiu — reconectando…
          </div>
        )
      )}
      {tela}
      {snap.erro && <Toast key={snap.erro.id} erro={snap.erro} aoFechar={loja.limparErro} />}

    </>
  );
}
