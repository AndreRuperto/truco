import type { DiaAdmin, MesaAdmin, PartidaAdmin, UsuarioAdmin } from '@truco/api';
import { type FormEvent, useState } from 'react';
import { Avatar } from '../componentes/Avatar';
import { NOME_MODO, NOME_VARIANTE } from '../logica/conta';
import { ABAS_ADMIN, type AbaAdmin, hrefDe } from '../logica/rotas';
import { type Api, ErroApi } from '../rede/api';
import { useCarregar } from '../rede/hooks';

type ApiAdmin = Pick<Api, 'admin'>;

const NOME_ABA: Record<AbaAdmin, string> = { resumo: 'Resumo', usuarios: 'Usuários', mesas: 'Mesas agora', partidas: 'Partidas' };

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmt = (f: Intl.DateTimeFormat, iso: string | null) => (iso ? f.format(new Date(iso)) : '—');

export function TelaAdmin({ aba, api }: { aba: AbaAdmin; api: ApiAdmin }) {
  return (
    <main className="tela-conta tela-admin">
      <h1>Admin</h1>
      <nav className="admin-abas" aria-label="Seções do admin">
        {ABAS_ADMIN.map((a) => (
          <a key={a} href={hrefDe({ tela: 'admin', aba: a })} aria-current={a === aba ? 'page' : undefined}>
            {NOME_ABA[a]}
          </a>
        ))}
      </nav>
      {aba === 'resumo' && <Resumo api={api} />}
      {aba === 'usuarios' && <Usuarios api={api} />}
      {aba === 'mesas' && <Mesas api={api} />}
      {aba === 'partidas' && <Partidas api={api} />}
    </main>
  );
}

function Estado({ carregando, erro, temDados }: { carregando: boolean; erro: string | null; temDados: boolean }) {
  if (erro) {
    return (
      <p className="erro-form" role="alert">
        {erro === 'só para admin' ? 'Esta área é só para quem administra o site.' : erro}
      </p>
    );
  }
  return carregando && !temDados ? <p role="status">Carregando…</p> : null;
}

// ---------- resumo ----------

function Resumo({ api }: { api: ApiAdmin }) {
  const { dados, erro, carregando } = useCarregar(() => api.admin.resumo(), []);
  return (
    <section aria-label="Resumo">
      <Estado carregando={carregando} erro={erro} temDados={!!dados} />
      {dados && (
        <>
          <dl className="admin-numeros">
            <div>
              <dt>Usuários</dt>
              <dd>{dados.usuarios}</dd>
            </div>
            <div>
              <dt>Banidos</dt>
              <dd>{dados.banidos}</dd>
            </div>
            <div>
              <dt>Partidas</dt>
              <dd>{dados.partidas}</dd>
            </div>
            <div>
              <dt>Mesas agora</dt>
              <dd>{dados.mesasAtivas}</dd>
            </div>
          </dl>
          <div className="admin-graficos">
            <Barras titulo="Partidas por dia" dias={dados.porDia} campo="partidas" />
            <Barras titulo="Contas novas por dia" dias={dados.porDia} campo="usuarios" />
          </div>
        </>
      )}
    </section>
  );
}

function Barras({ titulo, dias, campo }: { titulo: string; dias: DiaAdmin[]; campo: 'partidas' | 'usuarios' }) {
  const max = Math.max(1, ...dias.map((d) => d[campo]));
  const total = dias.reduce((t, d) => t + d[campo], 0);
  const rotulo = (d: DiaAdmin) => `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}`;
  return (
    <figure className="admin-barras">
      <figcaption>
        {titulo} <span>{total} em 14 dias</span>
      </figcaption>
      <ol>
        {dias.map((d) => (
          <li key={d.dia} title={`${rotulo(d)}: ${d[campo]}`}>
            <span className="admin-barra-valor">{d[campo] || ''}</span>
            <span className="admin-barra" style={{ height: `${(d[campo] / max) * 100}%` }} />
            <span className="admin-barra-dia">{rotulo(d)}</span>
            <span className="so-leitor">
              {rotulo(d)}: {d[campo]}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

// ---------- usuários ----------

function Usuarios({ api }: { api: ApiAdmin }) {
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.admin.usuarios(busca), [busca]);
  const buscar = (e: FormEvent) => {
    e.preventDefault();
    setBusca(texto);
  };
  return (
    <section aria-label="Usuários">
      <form className="admin-busca" role="search" onSubmit={buscar}>
        <label htmlFor="admin-busca" className="so-leitor">
          Buscar por apelido ou e-mail
        </label>
        <input id="admin-busca" type="search" placeholder="Apelido ou e-mail" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button type="submit" className="admin-botao">
          Buscar
        </button>
      </form>
      <Estado carregando={carregando} erro={erro} temDados={!!dados} />
      {dados && dados.usuarios.length === 0 && <p className="admin-vazio">Ninguém encontrado{busca ? ` para “${busca}”` : ''}.</p>}
      {dados && dados.usuarios.length > 0 && (
        <>
          <p className="admin-contagem">
            {dados.usuarios.length === 50 ? 'Mostrando os 50 mais novos' : `${dados.usuarios.length} ${dados.usuarios.length === 1 ? 'usuário' : 'usuários'}`}
            {busca && ` para “${busca}”`}
          </p>
          <ul className="admin-lista">
            {dados.usuarios.map((u) => (
              <CartaoUsuario key={u.id} u={u} api={api} aoMudar={recarregar} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CartaoUsuario({ u, api, aoMudar }: { u: UsuarioAdmin; api: ApiAdmin; aoMudar: () => void }) {
  const [modo, setModo] = useState<'ver' | 'apelido' | 'banir'>('ver');
  const [apelido, setApelido] = useState(u.apelido);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const agir = async (f: () => Promise<unknown>) => {
    setOcupado(true);
    setErro(null);
    try {
      await f();
      setModo('ver');
      aoMudar();
    } catch (e) {
      setErro(e instanceof ErroApi || e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  const idApelido = `admin-apelido-${u.id}`;
  return (
    <li className={`admin-cartao${u.banidoEm ? ' banido' : ''}`} aria-label={u.apelido}>
      <div className="admin-cartao-topo">
        <Avatar apelido={u.apelido} avatar={u.avatar} />
        <div className="admin-cartao-nome">
          <a href={hrefDe({ tela: 'perfil', id: u.id })}>{u.apelido}</a>
          <span>{u.email ?? 'sem e-mail'}</span>
        </div>
        <div className="admin-selos">
          {u.admin && <span className="selo selo-admin">admin</span>}
          {u.google && <span className="selo">Google</span>}
          {u.banidoEm && <span className="selo selo-banido">banido</span>}
        </div>
      </div>
      <p className="admin-cartao-meta">
        #{u.id} · desde {fmt(DATA, u.criadoEm)} · {u.partidas} {u.partidas === 1 ? 'partida' : 'partidas'}
        {u.banidoEm && ` · banido em ${fmt(DATA_HORA, u.banidoEm)}`}
      </p>
      {modo === 'apelido' && (
        <form
          className="admin-form-apelido"
          onSubmit={(e) => {
            e.preventDefault();
            void agir(() => api.admin.trocarApelido(u.id, apelido));
          }}
        >
          <label htmlFor={idApelido}>Novo apelido</label>
          <input id={idApelido} value={apelido} maxLength={20} onChange={(e) => setApelido(e.target.value)} autoFocus />
          <button type="submit" className="admin-botao" disabled={ocupado}>
            Salvar
          </button>
          <button type="button" className="admin-botao secundario" onClick={() => setModo('ver')}>
            Cancelar
          </button>
        </form>
      )}
      {modo === 'banir' && (
        <div className="admin-confirmar" role="group" aria-label={`Banir ${u.apelido}`}>
          <p>
            Banir <strong>{u.apelido}</strong>? A pessoa sai da conta agora e não consegue entrar de novo até ser desbanida.
          </p>
          <button type="button" className="admin-botao perigo" disabled={ocupado} onClick={() => void agir(() => api.admin.banir(u.id))}>
            Banir
          </button>
          <button type="button" className="admin-botao secundario" onClick={() => setModo('ver')}>
            Cancelar
          </button>
        </div>
      )}
      {modo === 'ver' && (
        <div className="admin-acoes">
          <button
            type="button"
            className="admin-botao secundario"
            onClick={() => {
              setApelido(u.apelido);
              setModo('apelido');
            }}
          >
            Trocar apelido
          </button>
          {u.banidoEm ? (
            <button type="button" className="admin-botao secundario" disabled={ocupado} onClick={() => void agir(() => api.admin.desbanir(u.id))}>
              Desbanir
            </button>
          ) : (
            !u.admin && (
              <button type="button" className="admin-botao perigo-leve" onClick={() => setModo('banir')}>
                Banir…
              </button>
            )
          )}
        </div>
      )}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
    </li>
  );
}

// ---------- mesas ----------

function haQuanto(iso: string | null, agora: number): string {
  if (!iso) return '';
  const min = Math.max(0, Math.round((agora - Date.parse(iso)) / 60_000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h} h ${min % 60} min`;
}

function Mesas({ api }: { api: ApiAdmin }) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.admin.mesas(), []);
  const agora = Date.now();
  return (
    <section aria-label="Mesas agora">
      <div className="admin-barra-topo">
        <p className="admin-contagem">
          {dados ? `${dados.mesas.length} ${dados.mesas.length === 1 ? 'mesa aberta' : 'mesas abertas'}` : ''}
        </p>
        <button type="button" className="admin-botao secundario" onClick={recarregar} disabled={carregando}>
          Atualizar
        </button>
      </div>
      <Estado carregando={carregando} erro={erro} temDados={!!dados} />
      {dados && dados.mesas.length === 0 && <p className="admin-vazio">Nenhuma mesa aberta agora.</p>}
      {dados && dados.mesas.length > 0 && (
        <ul className="admin-lista">
          {dados.mesas.map((m: MesaAdmin) => (
            <li key={m.id} className="admin-cartao">
              <div className="admin-cartao-topo">
                <div className="admin-cartao-nome">
                  <strong>
                    {m.variante ? NOME_VARIANTE[m.variante] : '?'} · {m.modo ? NOME_MODO[m.modo] : '?'}
                  </strong>
                  <span>
                    {m.dono ? `de ${m.dono} · ` : ''}
                    {haQuanto(m.criadaEm, agora)}
                  </span>
                </div>
                <div className="admin-selos">
                  {m.privada && <span className="selo">privada</span>}
                  <span className={`selo${m.trancada ? ' selo-admin' : ''}`}>{m.trancada ? 'em jogo' : 'esperando'}</span>
                </div>
              </div>
              <p className="admin-cartao-meta">
                {m.ocupados} de {m.lugares} conectados · sala {m.id}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- partidas ----------

function Partidas({ api }: { api: ApiAdmin }) {
  const { dados, erro, carregando } = useCarregar(() => api.admin.partidas(), []);
  return (
    <section aria-label="Partidas recentes">
      <Estado carregando={carregando} erro={erro} temDados={!!dados} />
      {dados && dados.partidas.length === 0 && <p className="admin-vazio">Nenhuma partida registrada ainda.</p>}
      {dados && dados.partidas.length > 0 && (
        <ul className="admin-lista">
          {dados.partidas.map((p) => (
            <CartaoPartida key={p.id} p={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CartaoPartida({ p }: { p: PartidaAdmin }) {
  const dupla = (d: number) => p.jogadores.filter((j) => j.dupla === d);
  const situacao = p.abandonada ? 'abandonada' : p.terminadaEm ? null : 'em andamento';
  return (
    <li className="admin-cartao">
      <div className="admin-cartao-topo">
        <div className="admin-cartao-nome">
          <strong>
            {NOME_VARIANTE[p.variante]} · {NOME_MODO[p.modo]}
          </strong>
          <span>
            #{p.id} · {fmt(DATA_HORA, p.iniciadaEm)}
          </span>
        </div>
        <div className="admin-selos">
          {p.ranqueada && <span className="selo selo-admin">ranqueada</span>}
          {situacao && <span className={`selo${p.abandonada ? ' selo-banido' : ''}`}>{situacao}</span>}
        </div>
      </div>
      <div className="admin-partida">
        {[0, 1].map((d) => (
          <div key={d} className={`admin-dupla${p.vencedora === d ? ' venceu' : ''}`}>
            <span className="admin-dupla-placar">{p.placar[d]}</span>
            <span className="admin-dupla-nomes">
              {dupla(d).map((j, i) => (
                <span key={i} className={j.abandonou ? 'abandonou' : undefined}>
                  {j.usuarioId ? <a href={hrefDe({ tela: 'perfil', id: j.usuarioId })}>{j.nome}</a> : j.nome}
                  {!j.humano && ' (bot)'}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </li>
  );
}
