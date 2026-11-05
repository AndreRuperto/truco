import type { RatingVariante, UsuarioApi } from '@truco/api';
import type { Variante } from '@truco/engine';
import { type FormEvent, useState } from 'react';
import { NOME_VARIANTE } from '../logica/conta';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

interface Props {
  api: Pick<Api, 'perfil' | 'trocarApelido'>;
  /** null = o próprio perfil (exige login). */
  id: number | null;
  aoTrocarApelido?: (u: UsuarioApi) => void;
}

export function TelaPerfil({ api, id, aoTrocarApelido }: Props) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.perfil(id ?? undefined), [id]);
  return (
    <main className="tela-conta">
      {carregando && !dados && <p role="status">Carregando…</p>}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && (
        <>
          <h1>{dados.usuario.apelido}</h1>
          {id === null && (
            <FormApelido
              atual={dados.usuario.apelido}
              api={api}
              aoSalvar={(u) => {
                aoTrocarApelido?.(u);
                recarregar();
              }}
            />
          )}
          {(['paulista', 'mineiro'] as const).map((v) => (
            <CartaoVariante key={v} variante={v} r={dados.variantes[v]} />
          ))}
        </>
      )}
    </main>
  );
}

function CartaoVariante({ variante, r }: { variante: Variante; r: RatingVariante }) {
  return (
    <section className="cartao-variante" aria-label={NOME_VARIANTE[variante]}>
      <h2>{NOME_VARIANTE[variante]}</h2>
      <p className="patente">
        <span className="patente-faixa">{r.patente}</span>{' '}
        <span className="patente-pontos">
          <strong data-testid={`pontos-${variante}`}>{r.pontos}</strong> pontos
        </span>
        {r.proxima && <span className="patente-proxima">faltam {r.proxima.faltam} para {r.proxima.nome}</span>}
      </p>
      <dl className="estatisticas">
        <div>
          <dt>Elo</dt>
          <dd data-testid={`elo-${variante}`}>{r.elo}</dd>
        </div>
        <div>
          <dt>Ranqueadas</dt>
          <dd>{r.partidasRanqueadas}</dd>
        </div>
        <div>
          <dt>Partidas</dt>
          <dd>{r.jogos}</dd>
        </div>
        <div>
          <dt>Vitórias</dt>
          <dd>{r.vitorias}</dd>
        </div>
        <div>
          <dt>Truco aceito</dt>
          <dd>{r.pctTrucoAceito === null ? '—' : `${r.pctTrucoAceito}%`}</dd>
        </div>
        <div>
          <dt>Corridas</dt>
          <dd>{r.corridas}</dd>
        </div>
      </dl>
    </section>
  );
}

function FormApelido({ atual, api, aoSalvar }: { atual: string; api: Pick<Api, 'trocarApelido'>; aoSalvar: (u: UsuarioApi) => void }) {
  const [valor, setValor] = useState(atual);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      aoSalvar((await api.trocarApelido(valor.trim())).usuario);
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    }
  };
  return (
    <form className="formulario linha" onSubmit={salvar}>
      <div className="campo">
        <label htmlFor="apelido-conta">Apelido</label>
        <input id="apelido-conta" type="text" maxLength={20} value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <button type="submit">Salvar</button>
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}
