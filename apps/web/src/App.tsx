import type { PreferenciasMesa, UsuarioApi } from '@truco/api';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Cabecalho } from './componentes/Cabecalho';
import { FundoCartas } from './componentes/FundoCartas';
import { Toast } from './componentes/Toast';
import { formInicial, gravarAvatarLocal, lerApelido, lerAvatarLocal, lerPreferenciasLocais, type OpcoesEntrada, opcoesDeEntrada } from './logica/lobby';
import { criarMesaPrivada, entrarNaMesa, entrarPorCodigo, tentarReconectar } from './rede/conexao';
import { useFila, useLoja, useSessao } from './rede/hooks';
import { api, loja, lojaFila, sessao } from './rede/instancia';
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
let ultimaEntrada: { tipo: 'mesa' | 'privada'; opcoes: OpcoesEntrada } | null = null;

function jogarDeNovo(): void {
  const modo = loja.getSnapshot().msg?.modo;
  const entrada = ultimaEntrada;
  // `sair` larga o estado local na hora; não precisa esperar o servidor fechar a sala antiga.
  void loja.sair();
  if (modo === 'ranqueada') {
    navegar({ tela: 'fila' });
    void lojaFila.reentrar();
  } else if (entrada?.tipo === 'privada') void criarMesaPrivada(loja, entrada.opcoes);
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
  // Regras da tela inicial guardadas na conta: undefined = sem conta ou carregando.
  const [prefsConta, setPrefsConta] = useState<PreferenciasMesa | null | undefined>(undefined);
  const idUsuario = ses.usuario?.id;
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

  const aoEntrar = useCallback((u: UsuarioApi) => {
    sessao.definirUsuario(u);
    // substitui #/entrar: "voltar" depois de entrar não reabre a tela de login
    navegar({ tela: 'inicio' }, { substituir: true });
  }, []);

  let tela;
  if (snap.status === 'conectando') tela = <p className="aviso-centro">Conectando…</p>;
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
          atual={rota.tela === 'perfil' && rota.id !== null ? undefined : rota.tela}
          aoSair={() => {
            navegar({ tela: 'inicio' });
            void sessao.sair();
          }}
        />
        {/* A tela inicial tem o fundo de cartas inteiro (com mouse); as outras, a versão discreta. */}
        {rota.tela !== 'inicio' && <FundoCartas discreto />}
        {/* trocar de conta remonta a tela: nada do usuário anterior sobrevive em estado local */}
        <Fragment key={ses.usuario?.id ?? 'anon'}>{conteudo}</Fragment>
      </>
    );
  }

  return (
    <>
      {snap.status === 'reconectando' && (
        <div className="faixa-aviso" role="status">
          Conexão caiu — reconectando…
        </div>
      )}
      {tela}
      {snap.erro && <Toast key={snap.erro.id} erro={snap.erro} aoFechar={loja.limparErro} />}
    </>
  );
}
