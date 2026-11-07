import type { Variante } from '@truco/engine';
import { NOME_VARIANTE } from '../logica/conta';
import { hrefDe } from '../logica/rotas';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

export function TelaRanking({ api, variante }: { api: Pick<Api, 'ranking'>; variante: Variante }) {
  const { dados, erro, carregando } = useCarregar(() => api.ranking(variante), [variante]);
  return (
    <main className="tela-conta pagina-larga pagina-ranking">
      <header className="pagina-abertura">
        <span className="pagina-selo">A disputa continua</span>
        <h1>Ranking</h1>
        <p>Quem domina a mesa? Confira os destaques e acompanhe a classificação completa.</p>
      </header>
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
          <>
            <section className="podio-secao" aria-label="Pódio dos melhores jogadores">
              <div className="podio-titulo">
                <span aria-hidden="true">★</span>
                <h2>Destaques da mesa</h2>
                <small>Top 3 · {NOME_VARIANTE[variante]}</small>
              </div>
              <ol className="podio-ranking">
                {[...dados.linhas]
                  .filter((l) => l.posicao >= 1 && l.posicao <= 3)
                  .sort((a, b) => (a.posicao === 2 ? 0 : a.posicao === 1 ? 1 : 2) -
                    (b.posicao === 2 ? 0 : b.posicao === 1 ? 1 : 2))
                  .map((l) => (
                    <li key={l.usuarioId} className={`podio-item posicao-${l.posicao}`}>
                      <span className="podio-medalha" aria-label={`${l.posicao}º lugar`}>
                        {l.posicao === 1 ? '★' : l.posicao === 2 ? '◆' : '✦'}
                      </span>
                      <strong className="podio-nome">{l.apelido}</strong>
                      <span className="podio-patente">{l.patente}</span>
                      <span className="podio-elo">{l.elo} Elo</span>
                    </li>
                  ))}
              </ol>
            </section>
            <h2 className="ranking-lista-titulo">Classificação completa</h2>
            <div className="tabela-ranking-rolagem">
              <table className="tabela-ranking">
            <caption className="so-leitor">Ranking {NOME_VARIANTE[variante]}</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Jogador</th>
                <th scope="col" className="col-patente">Patente</th>
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
                    <span className="ranking-patente-celular" aria-hidden="true">
                      {l.patente}
                    </span>
                  </td>
                  <td className="col-patente">{l.patente}</td>
                  <td>{l.pontos}</td>
                  <td>{l.elo}</td>
                </tr>
              ))}
            </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
