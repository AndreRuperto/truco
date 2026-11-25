import type { CarteiraApi, CatalogoApi, Conquista, RatingVariante, UsuarioApi } from '@truco/api';
import type { Variante } from '@truco/engine';
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { AVATARES_PRONTOS } from '@truco/api';
import { Avatar, DesenhoAvatar, NOME_AVATAR, reduzirFoto } from '../componentes/Avatar';
import { BotaoGoogle } from '../componentes/BotaoGoogle';
import { PreferenciasTema } from '../componentes/PreferenciasTema';
import { SeuVisual } from '../componentes/SeuVisual';
import { NOME_VARIANTE } from '../logica/conta';
import type { AbaPerfil } from '../logica/rotas';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

interface Props {
  api: Pick<Api, 'perfil' | 'trocarApelido'> & Partial<Pick<Api, 'conectarGoogle' | 'trocarAvatar' | 'excluirConta'>>;
  /** null = o próprio perfil (exige login). */
  id: number | null;
  /** Veio de "Editar perfil": rola até o bloco de edição e põe o foco no apelido. */
  editar?: boolean;
  /** Aba pedida pela URL (`?aba=`); sem ela, Conta no próprio perfil e Pontos no de outro jogador. */
  aba?: AbaPerfil;
  /** O jogador trocou de aba: põe na URL. `substituir` (setas) troca a entrada do histórico em vez de empilhar. */
  aoTrocarAba?: (aba: AbaPerfil, opcoes: { substituir: boolean }) => void;
  /** Quem está logado (para mostrar e-mail e Google no próprio perfil). */
  usuario?: UsuarioApi | null;
  /** Client ID do Google, se o login com Google estiver ligado no servidor. */
  googleClientId?: string | null;
  aoTrocarApelido?: (u: UsuarioApi) => void;
  /** A conta foi excluída: a sessão acabou. */
  aoExcluir?: () => void;
  /** Itens da conta para o "Seu visual" (moldura, baralho, roupa, mesa, avatar da loja). Sem eles, o bloco não aparece. */
  visual?: { catalogo: CatalogoApi | null; carteira: CarteiraApi | null; api: Pick<Api, 'loja'>; aoMudar: () => Promise<void> };
}

const NOME_ABA: Record<AbaPerfil, string> = { conta: 'Conta', pontos: 'Pontos', conquistas: 'Conquistas' };

export function TelaPerfil({ api, id, editar = false, aba: abaPedida, aoTrocarAba, usuario = null, googleClientId = null, aoTrocarApelido, aoExcluir, visual }: Props) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.perfil(id ?? undefined), [id]);
  // Conta só no próprio perfil; Conquistas só quando o servidor manda a lista.
  const abas: AbaPerfil[] = [...(id === null ? (['conta'] as const) : []), 'pontos', ...(dados?.conquistas?.length ? (['conquistas'] as const) : [])];
  const pedida = editar ? 'conta' : abaPedida;
  const abaUrl = pedida && abas.includes(pedida) ? pedida : abas[0];
  const [abaLocal, setAbaLocal] = useState<AbaPerfil>(abaUrl);
  // A URL manda (voltar/avançar do navegador, link compartilhado, "Editar perfil"). Sincroniza na
  // própria renderização, não num efeito: o painel Conta já sai visível quando o "editar" dos filhos
  // rola e põe o foco no apelido (efeitos de filhos rodam antes dos do pai).
  const [urlAnterior, setUrlAnterior] = useState(abaUrl);
  if (urlAnterior !== abaUrl) {
    setUrlAnterior(abaUrl);
    setAbaLocal(abaUrl);
  }
  const aba = abas.includes(abaLocal) ? abaLocal : abaUrl;
  const botoes = useRef<Partial<Record<AbaPerfil, HTMLButtonElement | null>>>({});
  const escolher = (a: AbaPerfil, substituir: boolean) => {
    setAbaLocal(a);
    if (a !== aba) aoTrocarAba?.(a, { substituir });
  };
  const teclar = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = abas.indexOf(aba);
    const alvo =
      e.key === 'ArrowRight' ? abas[(i + 1) % abas.length]
      : e.key === 'ArrowLeft' ? abas[(i - 1 + abas.length) % abas.length]
      : e.key === 'Home' ? abas[0]
      : e.key === 'End' ? abas[abas.length - 1]
      : null;
    if (!alvo) return;
    e.preventDefault();
    // Ativação automática (os painéis já estão carregados). Seta não empilha histórico, exceto ao sair
    // da aba de abertura: assim o "voltar" ainda volta a ela em vez de sair do perfil.
    escolher(alvo, aba !== abas[0]);
    botoes.current[alvo]?.focus();
  };
  const feitas = dados?.conquistas?.filter((c) => c.alcancada).length ?? 0;
  const total = dados?.conquistas?.length ?? 0;
  const painel = (a: AbaPerfil, filhos: ReactNode) => (
    <div role="tabpanel" id={`painel-perfil-${a}`} aria-labelledby={`aba-perfil-${a}`} className="perfil-painel" hidden={aba !== a} tabIndex={a === 'conta' ? undefined : 0}>
      {filhos}
    </div>
  );
  return (
    <main className="tela-conta pagina-perfil">
      {carregando && !dados && <p role="status">Carregando…</p>}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && (
        <>
          <header className="perfil-apresentacao">
            <h1 className="perfil-titulo">
              <Avatar apelido={dados.usuario.apelido} avatar={dados.usuario.avatar} tamanho={56} />
              {dados.usuario.apelido}
            </h1>
            <p>Patentes, números e conquistas de quem senta à mesa.</p>
          </header>
          <div className="perfil-abas" role="tablist" aria-label="Seções do perfil">
            {abas.map((a) => (
              <button
                key={a}
                ref={(b) => {
                  botoes.current[a] = b;
                }}
                type="button"
                role="tab"
                id={`aba-perfil-${a}`}
                aria-controls={`painel-perfil-${a}`}
                aria-selected={aba === a}
                tabIndex={aba === a ? 0 : -1}
                onClick={() => escolher(a, false)}
                onKeyDown={teclar}
              >
                {NOME_ABA[a]}
                {a === 'conquistas' && (
                  <>
                    <span className="perfil-aba-resumo" aria-hidden="true">
                      {feitas}/{total}
                    </span>
                    <span className="so-leitor"> {feitas} de {total}</span>
                  </>
                )}
              </button>
            ))}
          </div>
          {id === null &&
            painel(
              'conta',
              <>
                <EditarPerfil
                  apelido={dados.usuario.apelido}
                  usuario={usuario}
                  editar={editar}
                  api={api}
                  googleClientId={googleClientId}
                  visual={visual}
                  aoSalvar={(u) => {
                    aoTrocarApelido?.(u);
                    recarregar();
                  }}
                />
                {usuario && api.excluirConta && <ExcluirConta apelido={usuario.apelido} excluir={api.excluirConta} aoExcluir={() => aoExcluir?.()} />}
              </>,
            )}
          {painel(
            'pontos',
            (['paulista', 'mineiro'] as const).map((v) => <CartaoVariante key={v} variante={v} r={dados.variantes[v]} />),
          )}
          {dados.conquistas && dados.conquistas.length > 0 && painel('conquistas', <Conquistas lista={dados.conquistas} />)}
        </>
      )}
    </main>
  );
}

function CartaoVariante({ variante, r }: { variante: Variante; r: RatingVariante }) {
  return (
    <section className="cartao-variante" aria-label={NOME_VARIANTE[variante]}>
      <h2><span className="variante-emblema" aria-hidden="true">{variante === 'paulista' ? '♠' : '♣'}</span>{NOME_VARIANTE[variante]}</h2>
      <p className="patente">
        <span className="patente-emblema" aria-hidden="true">★</span>
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

/** O próprio perfil: apelido, e-mail da conta e o login com Google. */
function EditarPerfil({
  apelido,
  usuario,
  editar,
  api,
  googleClientId,
  visual,
  aoSalvar,
}: {
  apelido: string;
  usuario: UsuarioApi | null;
  editar: boolean;
  api: Pick<Api, 'trocarApelido'> & Partial<Pick<Api, 'conectarGoogle' | 'trocarAvatar'>>;
  googleClientId: string | null;
  visual?: Props['visual'];
  aoSalvar: (u: UsuarioApi) => void;
}) {
  const bloco = useRef<HTMLElement>(null);
  const [erroGoogle, setErroGoogle] = useState<string | null>(null);
  useEffect(() => {
    if (!editar) return;
    bloco.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    bloco.current?.querySelector<HTMLInputElement>('#apelido-conta')?.focus({ preventScroll: true });
  }, [editar]);
  const conectar = async (credencial: string) => {
    setErroGoogle(null);
    try {
      if (api.conectarGoogle) aoSalvar((await api.conectarGoogle(credencial)).usuario);
    } catch (x) {
      setErroGoogle(x instanceof Error ? x.message : String(x));
    }
  };
  return (
    <section className="editar-perfil" ref={bloco} aria-labelledby="titulo-editar-perfil">
      <h2 id="titulo-editar-perfil">Editar perfil</h2>
      {usuario && api.trocarAvatar && <EscolherAvatar usuario={usuario} trocar={api.trocarAvatar} aoSalvar={aoSalvar} />}
      <FormApelido atual={apelido} api={api} aoSalvar={aoSalvar} />
      {usuario && visual && <SeuVisual usuario={usuario} {...visual} />}
      <PreferenciasTema />
      {usuario && (
        <dl className="dados-conta">
          <div>
            <dt>E-mail</dt>
            <dd>{usuario.email ?? 'sem e-mail'}</dd>
          </div>
          <div>
            <dt>Google</dt>
            <dd data-testid="google-status">{usuario.google ? 'Conectado: dá para entrar com o Google' : 'Não conectado'}</dd>
          </div>
        </dl>
      )}
      {usuario && !usuario.google && googleClientId && api.conectarGoogle && (
        <div className="conectar-google">
          <p>Conecte sua conta Google para entrar com um clique, sem esperar o e-mail.</p>
          <BotaoGoogle clientId={googleClientId} aoCredencial={(c) => void conectar(c)} />
          {erroGoogle && (
            <p className="erro-form" role="alert">
              {erroGoogle}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Foto de perfil: um dos desenhos do site ou uma foto do aparelho (reduzida antes de subir). */
function EscolherAvatar({
  usuario,
  trocar,
  aoSalvar,
}: {
  usuario: UsuarioApi;
  trocar: (avatar: string | null) => Promise<{ usuario: UsuarioApi }>;
  aoSalvar: (u: UsuarioApi) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const atual = usuario.avatar ?? null;
  const salvar = async (valor: string | null | Promise<string>) => {
    setErro(null);
    setSalvando(true);
    try {
      aoSalvar((await trocar(await valor)).usuario);
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setSalvando(false);
    }
  };
  return (
    <fieldset className="escolher-avatar" aria-busy={salvando}>
      <legend>Foto de perfil</legend>
      <div className="avatar-atual">
        <Avatar apelido={usuario.apelido} avatar={atual} tamanho={72} rotulo="Sua foto atual" />
        <div className="avatar-acoes">
          <button type="button" onClick={() => arquivo.current?.click()} disabled={salvando}>
            Enviar foto
          </button>
          {atual && (
            <button type="button" onClick={() => void salvar(null)} disabled={salvando}>
              Tirar foto
            </button>
          )}
          <input
            ref={arquivo}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            data-testid="avatar-arquivo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void salvar(reduzirFoto(f));
            }}
          />
        </div>
      </div>
      <p className="avatar-dica">Ou escolha um dos nossos:</p>
      <ul className="avatares-prontos">
        {AVATARES_PRONTOS.map((id) => (
          <li key={id}>
            <button
              type="button"
              aria-pressed={atual === `pronto:${id}`}
              aria-label={NOME_AVATAR[id]}
              title={NOME_AVATAR[id]}
              disabled={salvando}
              onClick={() => void salvar(`pronto:${id}`)}
            >
              <DesenhoAvatar id={id} />
            </button>
          </li>
        ))}
      </ul>
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
    </fieldset>
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
      <button type="submit">Salvar apelido</button>
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}

/** Exclusão da conta (F6.4): explica o que some e o que fica; só libera com o apelido digitado. */
function ExcluirConta({ apelido, excluir, aoExcluir }: { apelido: string; excluir: (apelido: string) => Promise<void>; aoExcluir: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!aberto) {
    return (
      <p className="excluir-conta-abrir">
        <button type="button" className="botao-perigo" onClick={() => setAberto(true)}>
          Excluir minha conta…
        </button>
      </p>
    );
  }
  const confere = digitado.trim().toLowerCase() === apelido.toLowerCase();
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!confere) return;
    setErro(null);
    setEnviando(true);
    try {
      await excluir(digitado.trim());
      aoExcluir();
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
      setEnviando(false);
    }
  };
  return (
    <section className="excluir-conta" aria-labelledby="titulo-excluir-conta">
      <h2 id="titulo-excluir-conta">Excluir conta</h2>
      <p>
        Não dá para desfazer. Seu e-mail, Google, foto e apelido são apagados, você sai do ranking e perde Fichas, Pila e
        itens. As partidas ficam no histórico de quem jogou com você, como “Jogador removido”.
      </p>
      <form className="formulario" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="confirmar-exclusao">
            Digite o seu apelido (<strong>{apelido}</strong>) para confirmar
          </label>
          <input id="confirmar-exclusao" type="text" autoComplete="off" value={digitado} onChange={(e) => setDigitado(e.target.value)} />
        </div>
        <div className="linha">
          <button type="submit" className="botao-perigo" disabled={!confere || enviando}>
            Excluir para sempre
          </button>
          <button type="button" onClick={() => setAberto(false)} disabled={enviando}>
            Cancelar
          </button>
        </div>
        {erro && (
          <p className="erro-form" role="alert">
            {erro}
          </p>
        )}
      </form>
    </section>
  );
}

/** Medalhas: as já conquistadas primeiro; as outras mostram quanto falta. */
function Conquistas({ lista }: { lista: Conquista[] }) {
  const feitas = lista.filter((c) => c.alcancada).length;
  const ordem = [...lista].sort((a, b) => Number(b.alcancada) - Number(a.alcancada));
  return (
    <section className="conquistas" aria-labelledby="titulo-conquistas">
      <h2 id="titulo-conquistas">
        Conquistas <small>{feitas} de {lista.length}</small>
      </h2>
      <ul>
        {ordem.map((c) => (
          <li key={c.id} className={c.alcancada ? 'conquista feita' : 'conquista'}>
            <span className="medalha" aria-hidden="true">
              {c.alcancada ? '★' : '☆'}
            </span>
            <span className="conquista-texto">
              <strong>{c.nome}</strong>
              <span>{c.descricao}</span>
              {!c.alcancada && c.progresso && (
                <span className="conquista-progresso">
                  <progress max={c.progresso.meta} value={c.progresso.atual} aria-label={`${c.nome}: ${c.progresso.atual} de ${c.progresso.meta}`} />
                  {c.progresso.atual}/{c.progresso.meta}
                </span>
              )}
            </span>
            <span className="so-leitor">{c.alcancada ? 'conquistada' : 'ainda não'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

