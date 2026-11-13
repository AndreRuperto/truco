import type { ItemHistorico } from '@truco/api';
import { useState } from 'react';
import { NOME_MODO, NOME_VARIANTE, textoDelta, textoResultado } from '../logica/conta';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

type Tom = 'vitoria' | 'derrota' | 'neutro';

const tomDe = (p: ItemHistorico): Tom => (p.abandonou ? 'derrota' : p.venceu === true ? 'vitoria' : p.venceu === false ? 'derrota' : 'neutro');

const DIA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function quando(p: ItemHistorico): string {
  const d = new Date(p.terminadaEm ?? p.iniciadaEm);
  return Number.isNaN(d.getTime()) ? '' : `${DIA.format(d)} · ${HORA.format(d)}`;
}

export function TelaHistorico({ api }: { api: Pick<Api, 'historico'> }) {
  const { dados, erro, carregando } = useCarregar(() => api.historico(), []);
  const partidas = dados?.partidas ?? [];
  const vitorias = partidas.filter((p) => p.venceu === true && !p.abandonou).length;
  const derrotas = partidas.filter((p) => tomDe(p) === 'derrota').length;
  const [filtro, setFiltro] = useState<'todas' | 'vitoria' | 'derrota'>('todas');
  const filtradas = partidas.filter((p) => filtro === 'todas' || tomDe(p) === filtro);
  return (
    <main className="tela-conta tela-historico">
      <header className="pagina-abertura">
        <h1>Histórico</h1>
        <p>Relembre as partidas, os placares e como seu Elo mudou.</p>
      </header>
      {carregando && !dados && <p role="status">Carregando…</p>}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && partidas.length === 0 && (
        <section className="historico-vazio">
          <h2>Nenhuma partida por aqui ainda</h2>
          <p>Cada partida que você terminar logado aparece nesta lista, com o placar, o modo e quanto o Elo mudou.</p>
          <a className="botao-principal botao-link" href="#/">
            Jogar uma partida
          </a>
        </section>
      )}
      {partidas.length > 0 && (
        <>
          <p className="historico-resumo">
            <span>
              <strong>{partidas.length}</strong> {partidas.length === 1 ? 'partida' : 'partidas'}
            </span>
            <span className="tom-vitoria">
              <strong>{vitorias}</strong> {vitorias === 1 ? 'vitória' : 'vitórias'}
            </span>
            <span className="tom-derrota">
              <strong>{derrotas}</strong> {derrotas === 1 ? 'derrota' : 'derrotas'}
            </span>
          </p>
          <div className="historico-filtros" role="group" aria-label="Filtrar resultados">
            {([
              ['todas', 'Todas'],
              ['vitoria', 'Vitórias'],
              ['derrota', 'Derrotas'],
            ] as const).map(([valor, rotulo]) => (
              <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>
                {rotulo}
              </button>
            ))}
          </div>
          {filtradas.length === 0 && <p className="historico-sem-filtro">Nenhuma partida neste filtro.</p>}
          <ul className="historico-lista">
            {filtradas.map((p) => {
              const tom = tomDe(p);
              const delta = textoDelta(p.deltaElo);
              return (
                <li key={p.partidaId} className={`historico-item tom-${tom}`}>
                  <div className="historico-info">
                    <span className="historico-resultado">{textoResultado(p)}</span>
                    <span className="historico-modo">
                      {NOME_VARIANTE[p.variante]} · {NOME_MODO[p.modo]}
                    </span>
                    <span className="historico-data">{quando(p)}</span>
                    {p.eloCongelado && <span className="historico-congelado">não contou para o ranking (mesmo grupo 5 vezes em 24 h)</span>}
                  </div>
                  <div className="historico-placar" aria-label={`Placar: nós ${p.nos}, eles ${p.eles}`}>
                    <span aria-hidden="true">
                      {p.nos} × {p.eles}
                    </span>
                    <small aria-hidden="true">nós · eles</small>
                  </div>
                  {/* Sempre presente (vazio sem Elo) para o placar ficar na mesma coluna em todas as linhas. */}
                  <span
                    className={`historico-delta${p.deltaElo === null ? '' : p.deltaElo > 0 ? ' sobe' : p.deltaElo < 0 ? ' desce' : ''}`}
                    title={delta ? 'Variação de Elo' : undefined}
                  >
                    {delta}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
