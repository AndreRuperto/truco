import { useEffect } from 'react';
import { Toast } from './componentes/Toast';
import { entrarNaMesa, tentarReconectar } from './rede/conexao';
import { useLoja } from './rede/hooks';
import { loja } from './rede/instancia';
import { Lobby } from './telas/Lobby';
import { TelaMesa } from './telas/Mesa';
import { SalaEspera } from './telas/SalaEspera';

export function App() {
  const snap = useLoja(loja);

  useEffect(() => {
    void tentarReconectar(loja);
  }, []);

  let tela;
  if (snap.status === 'conectando') tela = <p className="aviso-centro">Conectando…</p>;
  else if (snap.status === 'fora') tela = <Lobby aoJogar={(o) => void entrarNaMesa(loja, o)} />;
  else if (!snap.msg) tela = <p className="aviso-centro">Entrando na mesa…</p>;
  else if (!snap.msg.visao) tela = <SalaEspera msg={snap.msg} aoIniciar={loja.iniciar} aoSair={() => void loja.sair()} />;
  else tela = <TelaMesa snap={snap} acoes={loja} />;

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
