import type { DiaAdmin, LinhaAuditoria, MesaAdmin, PaginaPartidasAdmin, PartidaAdmin, PedidoAdmin, UsuarioAdmin, VisaoPartidasAdmin } from '@truco/api';
import { formatarReais } from '../logica/lojaItens';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Avatar } from '../componentes/Avatar';
import { NOME_MODO, NOME_VARIANTE } from '../logica/conta';
import { ABAS_ADMIN, type AbaAdmin, hrefDe } from '../logica/rotas';
import { type Api, ErroApi } from '../rede/api';
import { useCarregar } from '../rede/hooks';

type ApiAdmin = Pick<Api, 'admin'>;

const NOME_ABA: Record<AbaAdmin, string> = { resumo: 'Resumo', usuarios: 'Usuários', pedidos: 'Pedidos', auditoria: 'Auditoria', mesas: 'Mesas agora', partidas: 'Partidas' };

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
      {aba === 'pedidos' && <Pedidos api={api} />}
      {aba === 'auditoria' && <Auditoria api={api} />}
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
          <dl className="admin-numeros" role="group" aria-label="Saúde do servidor">
            <div>
              <dt>Jogadores conectados</dt>
              <dd>{dados.jogadoresConectados ?? '—'}</dd>
            </div>
            <div>
              <dt>Versão</dt>
              <dd>{dados.versao ?? 'local'}</dd>
            </div>
            <div>
              <dt>Banco</dt>
              <dd>{dados.bancoMs === null || dados.bancoMs === undefined ? 'sem resposta' : `${dados.bancoMs} ms`}</dd>
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
  const [modo, setModo] = useState<'ver' | 'apelido' | 'banir' | 'ajuste' | 'confirmar-ajuste'>('ver');
  const [moeda, setMoeda] = useState<'fichas' | 'pila'>('fichas');
  const [delta, setDelta] = useState('');
  const [motivo, setMotivo] = useState('');
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
      {modo === 'ajuste' && (
        <form
          className="admin-form-apelido"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(delta);
            if (!Number.isInteger(n) || n === 0) return setErro('Diga um valor inteiro diferente de zero.');
            if (!motivo.trim()) return setErro('Diga o motivo do ajuste.');
            setErro(null);
            setModo('confirmar-ajuste');
          }}
        >
          <label htmlFor={`admin-moeda-${u.id}`}>Moeda</label>
          <select id={`admin-moeda-${u.id}`} value={moeda} onChange={(e) => setMoeda(e.target.value as 'fichas' | 'pila')}>
            <option value="fichas">Fichas</option>
            <option value="pila">Pila</option>
          </select>
          <label htmlFor={`admin-delta-${u.id}`}>Quanto (use - para tirar)</label>
          <input id={`admin-delta-${u.id}`} inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} autoFocus />
          <label htmlFor={`admin-motivo-${u.id}`}>Motivo</label>
          <input id={`admin-motivo-${u.id}`} value={motivo} maxLength={120} onChange={(e) => setMotivo(e.target.value)} />
          <button type="submit" className="admin-botao">
            Revisar
          </button>
          <button type="button" className="admin-botao secundario" onClick={() => setModo('ver')}>
            Cancelar
          </button>
        </form>
      )}
      {modo === 'confirmar-ajuste' && (
        <div className="admin-confirmar" role="group" aria-label={`Ajustar saldo de ${u.apelido}`}>
          <p>
            {Number(delta) > 0 ? '+' : ''}
            {Number(delta)} {moeda === 'fichas' ? 'Fichas' : 'Pila'} para {u.apelido}. Motivo: {motivo.trim()}. Fica no extrato e na auditoria.
          </p>
          <button type="button" className="admin-botao" disabled={ocupado} onClick={() => void agir(() => api.admin.ajuste(u.id, moeda, Number(delta), motivo.trim()))}>
            Confirmar ajuste
          </button>
          <button type="button" className="admin-botao secundario" onClick={() => setModo('ajuste')}>
            Voltar
          </button>
        </div>
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
          <button
            type="button"
            className="admin-botao secundario"
            onClick={() => {
              setDelta('');
              setMotivo('');
              setErro(null);
              setModo('ajuste');
            }}
          >
            Ajustar saldo…
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

// ---------- pedidos de Pila ----------

const NOME_STATUS: Record<PedidoAdmin['status'], string> = { criado: 'criado', pago: 'pago', estornado: 'estornado' };

function Pedidos({ api }: { api: ApiAdmin }) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.admin.pedidos(), []);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const estornar = async (id: string) => {
    setErroAcao(null);
    try {
      const r = await api.admin.estorno(id);
      const faltou = r.faltou ? ` Faltaram ${r.faltou} (já tinham sido gastos).` : '';
      setAviso(`Estornado: ${r.debitado} Pila tirados.${faltou}`);
      setConfirmando(null);
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <section aria-label="Pedidos de Pila">
      <Estado carregando={carregando} erro={erro} temDados={!!dados} />
      {aviso && <p role="status">{aviso}</p>}
      {erroAcao && (
        <p className="erro-form" role="alert">
          {erroAcao}
        </p>
      )}
      {dados && dados.pedidos.length === 0 && <p className="admin-vazio">Nenhum pedido ainda.</p>}
      {dados && dados.pedidos.length > 0 && (
        <div className="admin-tabela-rolagem">
        <table className="admin-tabela">
          <caption>Pedidos de Pila</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Usuário</th>
              <th scope="col">Pacote</th>
              <th scope="col">Valor</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="so-leitor">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dados.pedidos.map((p) => (
              <tr key={p.id}>
                <td>{fmt(DATA_HORA, p.criadoEm)}</td>
                <td>
                  <a href={hrefDe({ tela: 'perfil', id: p.usuarioId })}>{p.apelido}</a>
                </td>
                <td>
                  {p.pacoteId} ({p.pila} Pila)
                </td>
                <td>{formatarReais(p.valorCentavos)}</td>
                <td>{NOME_STATUS[p.status]}</td>
                <td>
                  {p.status === 'pago' &&
                    (confirmando === p.id ? (
                      <span role="group" aria-label={`Estornar o pedido de ${p.apelido}`}>
                        <button type="button" className="admin-botao perigo" onClick={() => void estornar(p.id)}>
                          Confirmar estorno
                        </button>
                        <button type="button" className="admin-botao secundario" onClick={() => setConfirmando(null)}>
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="admin-botao perigo-leve" onClick={() => setConfirmando(p.id)}>
                        Marcar estornado…
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}

// ---------- auditoria ----------

function textoAuditoria(l: LinhaAuditoria): string {
  const d = (l.detalhe ?? {}) as Record<string, unknown>;
  switch (l.acao) {
    case 'banir':
      return `baniu #${l.alvoId}`;
    case 'desbanir':
      return `desbaniu #${l.alvoId}`;
    case 'ajuste_saldo': {
      const delta = Number(d.delta);
      const sinal = delta > 0 ? '+' : '';
      const moeda = d.moeda === 'pila' ? 'Pila' : 'Fichas';
      return `ajustou o saldo de #${l.alvoId}: ${sinal}${delta} ${moeda} (${String(d.motivo ?? '')})`;
    }
    case 'estorno_pila': {
      const faltou = Number(d.faltou) ? `, faltaram ${Number(d.faltou)}` : '';
      return `estornou o pedido ${String(d.pedido)} de #${l.alvoId}: -${Number(d.debitado)} Pila${faltou}`;
    }
    case 'denuncia': {
      const alvo = l.alvoId ? `#${l.alvoId} (${String(d.nome ?? '')})` : `o convidado ${String(d.nome ?? '')}`;
      const partida = d.partidaId ? ` na partida #${Number(d.partidaId)}` : '';
      return `denunciou ${alvo}${partida}: ${String(d.motivo ?? '')}`;
    }
    default:
      return l.alvoId ? `${l.acao} #${l.alvoId}` : l.acao;
  }
}

function Auditoria({ api }: { api: ApiAdmin }) {
  const { dados, erro, carregando } = useCarregar(() => api.admin.auditoria(), []);
  return (
    <section aria-label="Auditoria">
      <Estado carregando={carregando} erro={erro} temDados={!!dados} />
      {dados && dados.auditoria.length === 0 && <p className="admin-vazio">Nada registrado ainda.</p>}
      {dados && dados.auditoria.length > 0 && (
        <ul className="admin-lista">
          {dados.auditoria.map((l) => (
            <li key={l.id} className="admin-cartao">
              <p className="admin-cartao-meta">
                {fmt(DATA_HORA, l.criadoEm)} · <strong>{l.admin}</strong> {textoAuditoria(l)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
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

const VISOES: { id: VisaoPartidasAdmin; nome: string; vazio: string }[] = [
  { id: 'criadas', nome: 'Criadas por mim', vazio: 'Você ainda não abriu nenhuma mesa que virou partida.' },
  { id: 'jogadas', nome: 'Que joguei', vazio: 'Você ainda não sentou em nenhuma partida registrada.' },
  { id: 'todas', nome: 'Todas', vazio: 'Nenhuma partida registrada ainda.' },
];

function Partidas({ api }: { api: ApiAdmin }) {
  const [visao, setVisao] = useState<VisaoPartidasAdmin>('todas');
  const [pagina, setPagina] = useState<PaginaPartidasAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Cada pedido leva um número: a resposta de uma visão antiga (clique rápido) é descartada.
  const pedido = useRef(0);

  const carregar = (v: VisaoPartidasAdmin, antes?: number) => {
    const n = ++pedido.current;
    setCarregando(true);
    setErro(null);
    api.admin.partidas(v, antes).then(
      (r) => {
        if (n !== pedido.current) return;
        setPagina((atual) => (antes !== undefined && atual ? { ...r, partidas: [...atual.partidas, ...r.partidas] } : r));
        setCarregando(false);
      },
      (e: unknown) => {
        if (n !== pedido.current) return;
        setErro(e instanceof Error ? e.message : String(e));
        setCarregando(false);
      },
    );
  };
  useEffect(() => {
    setPagina(null);
    carregar(visao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao]);

  const atual = VISOES.find((v) => v.id === visao)!;
  return (
    <section aria-label="Partidas">
      <div className="admin-abas admin-visoes" role="group" aria-label="Quais partidas">
        {VISOES.map((v) => (
          <button key={v.id} type="button" aria-pressed={v.id === visao} onClick={() => setVisao(v.id)}>
            {v.nome}
            {pagina && <span className="admin-visao-conta"> ({pagina.contagens[v.id]})</span>}
          </button>
        ))}
      </div>
      {visao === 'criadas' && pagina && pagina.semCriador > 0 && (
        <p className="admin-aviso">
          {pagina.semCriador === 1 ? '1 partida não tem' : `${pagina.semCriador} partidas não têm`} criador registrado (as antigas, as ranqueadas e
          as abertas por convidado): {pagina.semCriador === 1 ? 'ela aparece' : 'elas aparecem'} em Todas e, se você jogou, em Que joguei.
        </p>
      )}
      <Estado carregando={carregando} erro={erro} temDados={!!pagina} />
      {pagina && pagina.partidas.length === 0 && <p className="admin-vazio">{atual.vazio}</p>}
      {pagina && pagina.partidas.length > 0 && (
        <ul className="admin-lista">
          {pagina.partidas.map((p) => (
            <CartaoPartida key={p.id} p={p} />
          ))}
        </ul>
      )}
      {pagina?.proximo != null && (
        <div className="admin-mais">
          <button type="button" className="admin-botao secundario" disabled={carregando} onClick={() => carregar(visao, pagina.proximo ?? undefined)}>
            {carregando ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
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
