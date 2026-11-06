import { NOME_MODO, NOME_VARIANTE, textoDelta, textoResultado } from '../logica/conta';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

export function TelaHistorico({ api }: { api: Pick<Api, 'historico'> }) {
  const { dados, erro, carregando } = useCarregar(() => api.historico(), []);
  return (
    <main className="tela-conta">
      <h1>Histórico</h1>
      {carregando && !dados && <p role="status">Carregando…</p>}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && dados.partidas.length === 0 && (
        <section className="historico-vazio">
          <h2>Nenhuma partida por aqui ainda</h2>
          <p>Cada partida que você terminar logado aparece nesta lista, com o placar, o modo e quanto o Elo mudou.</p>
          <a className="botao-principal botao-link" href="#/">
            Jogar uma partida
          </a>
        </section>
      )}
      {dados && dados.partidas.length > 0 && (
        <ul className="lista-dados">
          {dados.partidas.map((p) => (
            <li key={p.partidaId}>
              <span>
                {NOME_VARIANTE[p.variante]} · {NOME_MODO[p.modo]}
              </span>
              <span>
                {p.nos} × {p.eles}
              </span>
              <span>{textoResultado(p)}</span>
              <span className="delta">{textoDelta(p.deltaElo)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
