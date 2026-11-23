import { SeletorAvatar } from '../componentes/SeletorAvatar';
import { InstalarTruco } from '../componentes/InstalarTruco';
import type { PreferenciasMesa } from '@truco/api';
import { limiteMaoEspecial, type Pontuacao, type RegrasMesa, type Variante } from '@truco/engine';
import { type NivelBot, TEMPOS_FAMILIA_S, TEMPOS_JOGADA_S } from '@truco/protocolo';
import { type ComponentProps, type FormEvent, useEffect, useRef, useState } from 'react';
import { FundoCartas } from '../componentes/FundoCartas';
import {
  type FormLobby,
  formInicial,
  gravarApelido,
  gravarPreferenciasLocais,
  lerApelido,
  lerPreferenciasLocais,
  OPCOES_INTERCEPTACAO,
  type OpcoesEntrada,
  opcoesDeEntrada,
  opcoesTutorial,
  preferenciasDe,
  trocarVariante,
} from '../logica/lobby';
import { marcarTutorial, tutorialPendente } from '../logica/tutorial';
import { type IdAjuda, textoAjuda } from '../logica/ajudaRegras';
import { BotaoAjuda } from '../componentes/Ajuda';

interface Props {
  aoJogar: (o: OpcoesEntrada) => void;
  aoRanqueada?: () => void;
  aoCriarPrivada?: (o: OpcoesEntrada) => void;
  /** Foto atual (da conta ou do aparelho) e como trocar. Sem `aoTrocarAvatar`, sem seletor. */
  avatar?: string | null;
  aoTrocarAvatar?: (avatar: string | null) => void | Promise<void>;
  /** Com conta, a mesa usa o apelido da conta: o campo mostra ele e não edita. */
  apelidoConta?: string;
  /** Preferências salvas na conta: undefined = sem conta (ou ainda carregando), null = conta sem nada salvo. */
  preferenciasConta?: PreferenciasMesa | null;
  /** Grava na conta (só com login). Chamado pouco depois de cada mudança nas regras. */
  aoSalvarNaConta?: (p: PreferenciasMesa) => void;
  /** Baralho equipado na loja: aparece nas cartas do fundo. */
  verso?: ComponentProps<typeof FundoCartas>['verso'];
  /** Partida guiada (tutorial). Sem ele, nem o convite da 1ª visita nem o botão aparecem. */
  aoTutorial?: (o: OpcoesEntrada) => void;
}

/** Espera depois da última mudança antes de mandar para a conta. */
const ESPERA_SALVAR_MS = 600;

/** Os mesmos de `CACIFES_MESA` no servidor (ele valida). */
const CACIFES = [0, 50, 100, 250, 500, 1000] as const;

export function Lobby({ verso, aoTutorial, aoJogar, aoRanqueada, aoCriarPrivada, preferenciasConta, aoSalvarNaConta, avatar = null, aoTrocarAvatar, apelidoConta }: Props) {
  const [f, setFCru] = useState<FormLobby>(() => formInicial(lerApelido(), lerPreferenciasLocais()));
  // Só grava depois que a pessoa mexe: abrir a tela não sobrescreve o que está na conta.
  const mexeu = useRef(false);
  const setF: typeof setFCru = (v) => {
    mexeu.current = true;
    setFCru(v);
  };
  // As da conta chegam depois do primeiro render; valem se a pessoa ainda não mexeu em nada.
  useEffect(() => {
    if (preferenciasConta && !mexeu.current) setFCru((x) => ({ ...formInicial(x.nome, preferenciasConta), privada: x.privada }));
  }, [preferenciasConta]);
  const prefs = preferenciasDe(f);
  const chavePrefs = JSON.stringify(prefs);
  useEffect(() => {
    if (!mexeu.current) return;
    gravarPreferenciasLocais(prefs);
    if (!aoSalvarNaConta) return;
    const t = setTimeout(() => aoSalvarNaConta(prefs), ESPERA_SALVAR_MS);
    return () => clearTimeout(t);
    // a chave resume `prefs`; o callback pode mudar a cada render da App
  }, [chavePrefs]);
  // Regras fechadas de cara: o resumo já diz o que está valendo; quem quiser mudar abre.
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  // O apelido não conta como mexer nas regras (não impede as da conta de chegarem).
  const mudar = <K extends keyof FormLobby>(k: K, v: FormLobby[K]) => (k === 'nome' ? setFCru : setF)((x) => ({ ...x, [k]: v }));

  const [convite, setConvite] = useState(tutorialPendente);
  // O "?" de cada regra: uma explicação aberta por vez, logo abaixo da regra.
  const [ajuda, setAjuda] = useState<IdAjuda | null>(null);
  const ajudaDe = (id: IdAjuda, tema: string) => {
    const aberta = ajuda === id;
    const idTexto = `ajuda-${id}`;
    return {
      botao: <BotaoAjuda tema={tema} aberta={aberta} controla={idTexto} aoAlternar={() => setAjuda((a) => (a === id ? null : id))} />,
      texto: aberta ? (
        <p id={idTexto} className="ajuda-regra">
          {textoAjuda(id, f.pontuacao)}
        </p>
      ) : null,
      descrita: aberta ? idTexto : undefined,
    };
  };
  const aj = {
    privada: ajudaDe('privada', 'Mesa privada'),
    variante: ajudaDe('variante', 'Variante'),
    pontuacao: ajudaDe('pontuacao', 'Pontuação'),
    familia: ajudaDe('familia', 'Família'),
    mao11: ajudaDe('mao11', 'Mão de ferro'),
    tempoFamilia: ajudaDe('tempo-familia', 'Tempo para pedir família'),
    tempoJogada: ajudaDe('tempo-jogada', 'Tempo por jogada'),
    ritmo: ajudaDe('ritmo', 'Ritmo da mesa'),
    humanos: ajudaDe('humanos', 'Humanos'),
    bots: ajudaDe('bots', 'Bots'),
    cacife: ajudaDe('cacife', 'Valendo Fichas'),
    sinais: ajudaDe('sinais', 'Sinais entre parceiros'),
    provocacoes: ajudaDe('provocacoes', 'Provocações'),
    interceptar: ajudaDe('interceptar', 'Interceptar sinais'),
    maoDe10: ajudaDe('maoDe10', `Mão de ${limiteMaoEspecial(f.pontuacao)}`),
    maoLimpa: ajudaDe('maoLimpa', 'Mão limpa'),
  };

  const comecarTutorial = () => {
    if (!aoTutorial) return;
    if (apelidoConta === undefined) gravarApelido(f.nome.trim());
    aoTutorial(opcoesTutorial((apelidoConta ?? f.nome).trim() || 'Jogador'));
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (apelidoConta === undefined) gravarApelido(f.nome.trim());
    const o = opcoesDeEntrada(apelidoConta === undefined ? f : { ...f, nome: apelidoConta });
    if (o.modo === 'privada' && aoCriarPrivada) aoCriarPrivada(o);
    else aoJogar(o);
  };

  return (
    <main className="lobby">
      <FundoCartas verso={verso} />
      <h1 className="letreiro">Truco</h1>
      <p className="letreiro-sub">Senta, que a mesa tá posta.</p>
      {aoTutorial && convite && (
        <section className="convite-tutorial" aria-labelledby="convite-tutorial-titulo">
          <h2 id="convite-tutorial-titulo">Primeira vez por aqui?</h2>
          <p>Aprenda jogando: uma partida guiada contra bots, sem pressa. Dá para pular quando quiser.</p>
          <div className="convite-tutorial-botoes">
            <button type="button" className="botao-principal" onClick={comecarTutorial}>
              Começar tutorial
            </button>
            <button
              type="button"
              className="botao-discreto"
              onClick={() => {
                marcarTutorial('pulado');
                setConvite(false);
              }}
            >
              Agora não
            </button>
          </div>
        </section>
      )}
      <form className="formulario" onSubmit={enviar}>
        <div className="lobby-principal">
          <div className="campo">
            <label htmlFor="apelido">Apelido</label>
            <div className="apelido-com-foto">
              {aoTrocarAvatar && <SeletorAvatar apelido={apelidoConta ?? f.nome} valor={avatar} aoMudar={aoTrocarAvatar} />}
              <input
                id="apelido"
                type="text"
                value={apelidoConta ?? f.nome}
                maxLength={20}
                autoComplete="nickname"
                placeholder="Como te chamam na mesa"
                readOnly={apelidoConta !== undefined}
                aria-describedby={apelidoConta !== undefined ? 'apelido-conta-dica' : undefined}
                onChange={(e) => mudar('nome', e.target.value)}
              />
            </div>
            {apelidoConta !== undefined && (
              <small id="apelido-conta-dica" className="dica-campo">
                É o apelido da sua conta. Para trocar, vá em <a href="#/perfil?editar">Editar perfil</a>.
              </small>
            )}
          </div>
          <button type="submit" className="botao-principal">
            {f.privada && aoCriarPrivada ? 'Criar mesa privada' : 'Jogar agora'}
          </button>
          <div className="lobby-outros">
            <button type="button" onClick={aoRanqueada} disabled={!aoRanqueada}>
              Ranqueada
            </button>
            {aoTutorial && (
              <button type="button" onClick={comecarTutorial}>
                Tutorial
              </button>
            )}
            {aoCriarPrivada && (
              <div className="alternar-privada-linha">
                <label className="alternar-privada">
                  <input type="checkbox" checked={f.privada} aria-describedby={aj.privada.descrita} onChange={(e) => mudar('privada', e.target.checked)} />
                  <span>Mesa privada</span>
                </label>
                {aj.privada.botao}
              </div>
            )}
            {aj.privada.texto}
          </div>
        </div>
        <details className="regras-mesa" open={regrasAbertas} onToggle={(e) => setRegrasAbertas(e.currentTarget.open)}>
          <summary>
            <span>Regras da mesa</span>
            <small>{resumoLobby(f)}</small>
          </summary>
          <div className="regras-grade">
            <h3 className="regras-grupo largo">Jogo</h3>
            <div className="campo">
              <div className="campo-rotulo">
                <label htmlFor="variante">Variante</label>
                {aj.variante.botao}
              </div>
              <select id="variante" aria-describedby={aj.variante.descrita} value={f.variante} onChange={(e) => setF((x) => trocarVariante(x, e.target.value as Variante))}>
                <option value="paulista">Paulista</option>
                <option value="mineiro">Mineiro</option>
              </select>
              {aj.variante.texto}
            </div>
            <div className="campo">
              <div className="campo-rotulo">
                <label htmlFor="pontuacao">Pontuação</label>
                {aj.pontuacao.botao}
              </div>
              <select id="pontuacao" aria-describedby={aj.pontuacao.descrita} value={f.pontuacao} onChange={(e) => mudar('pontuacao', e.target.value as Pontuacao)}>
                <option value="1-3-6-9-12">1, 3, 6, 9, 12</option>
                <option value="2-4-8-10-12">2, 4, 8, 10, 12</option>
              </select>
              {aj.pontuacao.texto}
            </div>
            <div className="campo">
              <div className="campo-rotulo">
                <label htmlFor="familia">Família</label>
                {aj.familia.botao}
              </div>
              <select id="familia" aria-describedby={aj.familia.descrita} value={f.familia} onChange={(e) => mudar('familia', e.target.value as RegrasMesa['familia'])}>
                <option value="off">Desligada</option>
                <option value="aberta">Aberta</option>
                <option value="fechada">Fechada</option>
              </select>
              {aj.familia.texto}
            </div>
            <div className="campo">
              <div className="campo-rotulo">
                <label htmlFor="mao11">Mão de ferro</label>
                {aj.mao11.botao}
              </div>
              <select id="mao11" aria-describedby={aj.mao11.descrita} value={f.maoDe11} onChange={(e) => mudar('maoDe11', e.target.value as RegrasMesa['maoDe11'])}>
                <option value="off">Desligada</option>
                <option value="onzeAOnze">
                  Só no {limiteMaoEspecial(f.pontuacao)} a {limiteMaoEspecial(f.pontuacao)}
                </option>
              </select>
              {aj.mao11.texto}
            </div>
            <div className="campo-check-linha largo">
              <label className="campo-check">
                <input type="checkbox" checked={f.maoDe10} aria-describedby={aj.maoDe10.descrita} onChange={(e) => mudar('maoDe10', e.target.checked)} />
                Mão de {limiteMaoEspecial(f.pontuacao)}
              </label>
              {aj.maoDe10.botao}
            </div>
            {aj.maoDe10.texto}
            {f.variante === 'mineiro' && (
              <>
                <div className="campo-check-linha largo">
                  <label className="campo-check">
                    <input type="checkbox" checked={f.maoLimpa} aria-describedby={aj.maoLimpa.descrita} onChange={(e) => mudar('maoLimpa', e.target.checked)} />
                    Mão limpa
                  </label>
                  {aj.maoLimpa.botao}
                </div>
                {aj.maoLimpa.texto}
              </>
            )}
            <h3 className="regras-grupo largo">Jogadores e tempo</h3>
            <div className="campo">
              <div className="campo-rotulo">
                <label htmlFor="humanos">Humanos</label>
                {aj.humanos.botao}
              </div>
              <select id="humanos" aria-describedby={aj.humanos.descrita} value={String(f.humanos)} onChange={(e) => mudar('humanos', Number(e.target.value))}>
                <option value="1">Só eu</option>
                <option value="2">2 humanos</option>
                <option value="3">3 humanos</option>
                <option value="4">4 humanos</option>
              </select>
              {aj.humanos.texto}
            </div>
            {f.humanos < 4 && (
              <div className="campo">
                <div className="campo-rotulo">
                  <label htmlFor="bots">Bots</label>
                  {aj.bots.botao}
                </div>
                <select id="bots" aria-describedby={aj.bots.descrita} value={f.nivelBot} onChange={(e) => mudar('nivelBot', e.target.value as NivelBot)}>
                  <option value="facil">Fácil</option>
                  <option value="dificil">Difícil</option>
                </select>
                {aj.bots.texto}
              </div>
            )}
            <div className="ritmo-mesa largo">
              <div className="campo-rotulo">
                <span id="ritmo-mesa-titulo" className="rotulo-grupo">
                  Ritmo da mesa
                </span>
                {aj.ritmo.botao}
              </div>
              <div role="radiogroup" aria-labelledby="ritmo-mesa-titulo" aria-describedby={aj.ritmo.descrita} className="ritmo-opcoes">
                {(
                  [
                    ['calmo', 'Calmo', 'dá tempo de acompanhar'],
                    ['rapido', 'Rápido', 'pra quem já joga'],
                  ] as const
                ).map(([valor, rotulo, explica]) => (
                  <label key={valor} className="ritmo-opcao">
                    <input type="radio" name="ritmo" value={valor} checked={f.ritmo === valor} onChange={() => mudar('ritmo', valor)} />
                    <span>
                      <strong>{rotulo}</strong>
                      <small>{explica}</small>
                    </span>
                  </label>
                ))}
              </div>
              {aj.ritmo.texto}
            </div>
            <div className="campo">
              <div className="campo-rotulo">
                <label htmlFor="tempo-jogada">Tempo por jogada</label>
                {aj.tempoJogada.botao}
              </div>
              <select
                id="tempo-jogada" aria-describedby={aj.tempoJogada.descrita}
                value={f.privada && f.semLimiteDeTempo ? 'semLimite' : String(f.tempoJogadaS)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'semLimite') mudar('semLimiteDeTempo', true);
                  else setF((x) => ({ ...x, semLimiteDeTempo: false, tempoJogadaS: Number(v) as FormLobby['tempoJogadaS'] }));
                }}
              >
                {TEMPOS_JOGADA_S.map((s) => (
                  <option key={s} value={String(s)}>
                    {s} segundos
                  </option>
                ))}
                {/* Sem relógio só entre amigos: nas públicas o relógio segura a mesa. */}
                {f.privada && aoCriarPrivada && <option value="semLimite">Sem limite</option>}
              </select>
              {aj.tempoJogada.texto}
            </div>
            {f.familia !== 'off' && (
              <div className="campo">
                <div className="campo-rotulo">
                  <label htmlFor="tempo-familia">Tempo para pedir família</label>
                  {aj.tempoFamilia.botao}
                </div>
                <select id="tempo-familia" aria-describedby={aj.tempoFamilia.descrita} value={String(f.tempoFamiliaS)} onChange={(e) => mudar('tempoFamiliaS', Number(e.target.value) as FormLobby['tempoFamiliaS'])}>
                  {TEMPOS_FAMILIA_S.map((s) => (
                    <option key={s} value={String(s)}>
                      {s} segundos
                    </option>
                  ))}
                </select>
                {aj.tempoFamilia.texto}
              </div>
            )}
            {/* Linha inteira: "1000 Fichas por cabeça" não cabe na coluna da direita. */}
            {apelidoConta !== undefined && (f.humanos >= 2 || f.privada) && (
              <div className="campo largo">
                <div className="campo-rotulo">
                  <label htmlFor="cacife">Valendo Fichas</label>
                  {aj.cacife.botao}
                </div>
                <select id="cacife" aria-describedby={aj.cacife.descrita} value={String(f.cacife ?? 0)} onChange={(e) => mudar('cacife', Number(e.target.value))}>
                  {CACIFES.map((c) => (
                    <option key={c} value={String(c)}>
                      {c === 0 ? 'Sem cacife' : `${c} Fichas por cabeça`}
                    </option>
                  ))}
                </select>
                {aj.cacife.texto}
              </div>
            )}
            <h3 className="regras-grupo largo">Na mesa</h3>
            <div className="campo-check-linha largo">
              <label className="campo-check">
                <input type="checkbox" checked={f.sinais} aria-describedby={aj.sinais.descrita} onChange={(e) => mudar('sinais', e.target.checked)} />
                Sinais entre parceiros
              </label>
              {aj.sinais.botao}
            </div>
            {aj.sinais.texto}
            {f.sinais && (
              <div className="campo largo campo-dependente">
                <div className="campo-rotulo">
                  <label htmlFor="interceptar">Adversários podem interceptar sinais</label>
                  {aj.interceptar.botao}
                </div>
                <select
                  id="interceptar" aria-describedby={aj.interceptar.descrita}
                  value={String(f.chanceInterceptarSinal)}
                  onChange={(e) => mudar('chanceInterceptarSinal', Number(e.target.value))}
                >
                  {OPCOES_INTERCEPTACAO.map((o) => (
                    <option key={o.valor} value={String(o.valor)}>
                      {o.rotulo}
                    </option>
                  ))}
                </select>
                {aj.interceptar.texto}
              </div>
            )}
            <div className="campo-check-linha largo">
              <label className="campo-check">
                <input type="checkbox" checked={f.provocacoes} aria-describedby={aj.provocacoes.descrita} onChange={(e) => mudar('provocacoes', e.target.checked)} />
                Provocações
              </label>
              {aj.provocacoes.botao}
            </div>
            {aj.provocacoes.texto}
          </div>
          <p className="regras-salvas">
            {aoSalvarNaConta ? 'Estas regras ficam salvas na sua conta.' : 'Estas regras ficam salvas neste aparelho. Entre na conta para levar para qualquer lugar.'}
          </p>
        </details>
      </form>
      <InstalarTruco />
      <p className="lobby-dica-cartas">Duplo clique nas cartas do fundo para fazê-las girar.</p>
      <nav className="rodape-legal" aria-label="Documentos">
        <a href="#/termos">Termos de uso</a> · <a href="#/privacidade">Privacidade</a>
      </nav>
    </main>
  );
}

const TEXTO_FAMILIA: Record<RegrasMesa['familia'], string> = { off: 'sem família', aberta: 'família aberta', fechada: 'família fechada' };

/** Uma linha com as regras escolhidas, para o bloco recolhido. */
function resumoLobby(f: FormLobby): string {
  const bots = 4 - f.humanos;
  const nivel = f.nivelBot === 'facil' ? (bots === 1 ? 'fácil' : 'fáceis') : bots === 1 ? 'difícil' : 'difíceis';
  const partes = [
    f.variante === 'paulista' ? 'Paulista' : 'Mineiro',
    f.pontuacao,
    f.maoDe10 ? `mão de ${limiteMaoEspecial(f.pontuacao)}` : null,
    f.maoDe11 === 'onzeAOnze' ? 'mão de ferro' : null,
    TEXTO_FAMILIA[f.familia],
    f.variante === 'mineiro' && f.maoLimpa ? 'mão limpa' : null,
    bots > 0 ? `${bots} ${bots === 1 ? 'bot' : 'bots'} ${nivel}` : 'só humanos',
    !f.sinais ? 'sem sinais' : f.chanceInterceptarSinal > 0 ? 'sinais interceptáveis' : null,
    !f.provocacoes ? 'sem provocações' : null,
    f.cacife && (f.humanos >= 2 || f.privada) ? `valendo ${f.cacife} Fichas` : null,
    f.ritmo === 'rapido' ? 'ritmo rápido' : 'ritmo calmo',
    f.privada && f.semLimiteDeTempo ? 'sem limite de tempo' : `${f.tempoJogadaS} s por jogada`,
  ];
  return partes.filter(Boolean).join(', ');
}
