import type { UsuarioApi } from '@truco/api';
import { useCallback, useEffect } from 'react';
import { Cabecalho } from './componentes/Cabecalho';
import { Toast } from './componentes/Toast';
import { lerApelido } from './logica/lobby';
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

export function App() {
  const snap = useLoja(loja);
  const ses = useSessao(sessao);
  const rota = useRota();
  const fila = useFila(lojaFila);
  const nomePadrao = () => ses.usuario?.apelido ?? (lerApelido() || 'Jogador');

  useEffect(() => {
    void tentarReconectar(loja);
    void sessao.carregar();
  }, []);

  const aoEntrar = useCallback((u: UsuarioApi) => {
    sessao.definirUsuario(u);
    navegar({ tela: 'inicio' });
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
    else tela = <TelaMesa snap={snap} acoes={loja} aoChat={loja.enviarChat} />;
  } else {
    let conteudo;
    switch (rota.tela) {
      case 'entrar':
        conteudo = <TelaEntrar token={rota.token} config={ses.config} api={api} aoEntrar={aoEntrar} />;
        break;
      case 'perfil':
        conteudo = <TelaPerfil key={rota.id ?? 'eu'} id={rota.id} api={api} aoTrocarApelido={(u) => sessao.definirUsuario(u)} />;
        break;
      case 'historico':
        conteudo = <TelaHistorico api={api} />;
        break;
      case 'ranking':
        conteudo = <TelaRanking variante={rota.variante} api={api} />;
        break;
      case 'salas':
        conteudo = <TelaSalas api={api} aoEntrar={(id) => void entrarPorCodigo(loja, id, nomePadrao())} />;
        break;
      case 'privada':
        conteudo = (
          <TelaEntrarPrivada
            key={rota.codigo}
            codigo={rota.codigo}
            nomeInicial={ses.usuario?.apelido ?? lerApelido()}
            aoEntrar={(nome) => {
              // ao sair da mesa volta ao início, não à tela do convite
              navegar({ tela: 'inicio' });
              void entrarPorCodigo(loja, rota.codigo, nome);
            }}
          />
        );
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
            aoJogar={(o) => void entrarNaMesa(loja, o)}
            aoCriarPrivada={(o) => void criarMesaPrivada(loja, o)}
            aoRanqueada={() => navegar(ses.usuario ? { tela: 'fila' } : { tela: 'entrar', token: null })}
          />
        );
    }
    tela = (
      <>
        <Cabecalho usuario={ses.usuario} aoSair={() => void sessao.sair()} />
        {conteudo}
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
