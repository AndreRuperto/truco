import type { Variante } from '@truco/engine';
import { NOME_VARIANTE } from '../logica/conta';
import { hrefDe } from '../logica/rotas';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

export function TelaRanking({ api, variante }: { api: Pick<Api, 'ranking'>; variante: Variante }) {
  const { dados, erro, carregando } = useCarregar(() => api.ranking(variante), [variante]);
  return (
    <main className="tela-conta">
      <h1>Ranking</h1>
      <nav className="abas" aria-label="Variante">
        {(['paulista', 'mineiro'] as const).map((v) => (
          <a key={v} href={hrefDe({ tela: 'ranking', variante: v })} aria-current={v === variante ? 'page' : undefined}>
            {NOME_VARIANTE[v]}
          </a>
        ))}
      </nav>
      <div className="painel-abas">
        {carregando && !dados && <p role="status">Carregando…</p>}
        {erro && (
          <p className="erro-form" role="alert">
            {erro}
          </p>
        )}
        {dados && dados.linhas.length === 0 && (
          <section className="vazio" aria-labelledby="ranking-vazio">
            <h2 id="ranking-vazio">O ranking {NOME_VARIANTE[variante]} ainda está em branco</h2>
            <p>
              Aqui entram os jogadores de partidas ranqueadas no {NOME_VARIANTE[variante]}, ordenados por pontos de patente (no empate, por Elo).
            </p>
            <p>Ninguém terminou uma ranqueada nesta variante ainda: o primeiro a terminar já aparece no topo.</p>
            <a className="botao-principal" href={hrefDe({ tela: 'fila' })}>
              Jogar ranqueada
            </a>
          </section>
        )}
        {dados && dados.linhas.length > 0 && (
          <table className="tabela-ranking">
            <caption className="so-leitor">Ranking {NOME_VARIANTE[variante]}</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Jogador</th>
                <th scope="col">Patente</th>
                <th scope="col">Pontos</th>
                <th scope="col">Elo</th>
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map((l) => (
                <tr key={l.usuarioId}>
                  <td>{l.posicao}</td>
                  <td>
                    <a href={hrefDe({ tela: 'perfil', id: l.usuarioId })}>{l.apelido}</a>
                  </td>
                  <td>{l.patente}</td>
                  <td>{l.pontos}</td>
                  <td>{l.elo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
