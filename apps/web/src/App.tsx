import type { UsuarioApi } from '@truco/api';
import { useCallback, useEffect } from 'react';
import { Cabecalho } from './componentes/Cabecalho';
import { Toast } from './componentes/Toast';
import { entrarNaMesa, tentarReconectar } from './rede/conexao';
import { useLoja, useSessao } from './rede/hooks';
import { api, loja, sessao } from './rede/instancia';
import { navegar, useRota } from './rede/rota';
import { TelaEntrar } from './telas/Entrar';
import { Lobby } from './telas/Lobby';
import { TelaMesa } from './telas/Mesa';
import { SalaEspera } from './telas/SalaEspera';

export function App() {
  const snap = useLoja(loja);
  const ses = useSessao(sessao);
  const rota = useRota();

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
    else if (!snap.msg.visao) tela = <SalaEspera msg={snap.msg} aoIniciar={loja.iniciar} aoSair={() => void loja.sair()} />;
    else tela = <TelaMesa snap={snap} acoes={loja} />;
  } else {
    let conteudo;
    switch (rota.tela) {
      case 'entrar':
        conteudo = <TelaEntrar token={rota.token} config={ses.config} api={api} aoEntrar={aoEntrar} />;
        break;
      default:
        conteudo = (
          <Lobby
            aoJogar={(o) => void entrarNaMesa(loja, o)}
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
