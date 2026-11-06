import type { PreferenciasMesa } from '@truco/api';
import type { Pontuacao, RegrasMesa, Variante } from '@truco/engine';
import { type NivelBot, TEMPOS_FAMILIA_S } from '@truco/protocolo';
import { type FormEvent, useEffect, useRef, useState } from 'react';
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
  preferenciasDe,
  trocarVariante,
} from '../logica/lobby';

interface Props {
  aoJogar: (o: OpcoesEntrada) => void;
  aoRanqueada?: () => void;
  aoCriarPrivada?: (o: OpcoesEntrada) => void;
  /** Preferências salvas na conta: undefined = sem conta (ou ainda carregando), null = conta sem nada salvo. */
  preferenciasConta?: PreferenciasMesa | null;
  /** Grava na conta (só com login). Chamado pouco depois de cada mudança nas regras. */
  aoSalvarNaConta?: (p: PreferenciasMesa) => void;
}

/** Espera depois da última mudança antes de mandar para a conta. */
const ESPERA_SALVAR_MS = 600;

export function Lobby({ aoJogar, aoRanqueada, aoCriarPrivada, preferenciasConta, aoSalvarNaConta }: Props) {
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
  // Regras abertas de cara só em tela larga; no celular o "Jogar agora" fica na primeira dobra.
  const [regrasAbertas, setRegrasAbertas] = useState(() => window.matchMedia?.('(min-width: 900px)').matches ?? false);
  // O apelido não conta como mexer nas regras (não impede as da conta de chegarem).
  const mudar = <K extends keyof FormLobby>(k: K, v: FormLobby[K]) => (k === 'nome' ? setFCru : setF)((x) => ({ ...x, [k]: v }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    gravarApelido(f.nome.trim());
    const o = opcoesDeEntrada(f);
    if (o.modo === 'privada' && aoCriarPrivada) aoCriarPrivada(o);
    else aoJogar(o);
  };

  return (
    <main className="lobby">
      <FundoCartas />
      <h1 className="letreiro">Truco</h1>
      <p className="letreiro-sub">Senta, que a mesa tá posta.</p>
      <form className="formulario" onSubmit={enviar}>
        <div className="lobby-principal">
          <div className="campo">
            <label htmlFor="apelido">Apelido</label>
            <input
              id="apelido"
              type="text"
              value={f.nome}
              maxLength={20}
              autoComplete="nickname"
              placeholder="Como te chamam na mesa"
              onChange={(e) => mudar('nome', e.target.value)}
            />
          </div>
          <button type="submit" className="botao-principal">
            {f.privada && aoCriarPrivada ? 'Criar mesa privada' : 'Jogar agora'}
          </button>
          <div className="lobby-outros">
            <button type="button" onClick={aoRanqueada} disabled={!aoRanqueada}>
              Ranqueada
            </button>
            {aoCriarPrivada && (
              <label className="alternar-privada">
                <input type="checkbox" checked={f.privada} onChange={(e) => mudar('privada', e.target.checked)} />
                <span>
                  Mesa privada <small>(só entra quem tiver o link)</small>
                </span>
              </label>
            )}
          </div>
        </div>
        <details className="regras-mesa" open={regrasAbertas} onToggle={(e) => setRegrasAbertas(e.currentTarget.open)}>
          <summary>
            <span>Regras da mesa</span>
            <small>{resumoLobby(f)}</small>
          </summary>
          <div className="regras-grade">
            <div className="campo">
              <label htmlFor="variante">Variante</label>
              <select id="variante" value={f.variante} onChange={(e) => setF((x) => trocarVariante(x, e.target.value as Variante))}>
                <option value="paulista">Paulista (com vira)</option>
                <option value="mineiro">Mineiro (manilhas fixas)</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="pontuacao">Pontuação</label>
              <select id="pontuacao" value={f.pontuacao} onChange={(e) => mudar('pontuacao', e.target.value as Pontuacao)}>
                <option value="1-3-6-9-12">1, 3, 6, 9, 12</option>
                <option value="2-4-8-10-12">2, 4, 8, 10, 12</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="mao11">Mão de 11</label>
              <select id="mao11" value={f.maoDe11} onChange={(e) => mudar('maoDe11', e.target.value as RegrasMesa['maoDe11'])}>
                <option value="off">Desligada</option>
                <option value="qualquerDupla">Qualquer dupla com 11</option>
                <option value="onzeAOnze">Só no 11 a 11</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="familia">Família</label>
              <select id="familia" value={f.familia} onChange={(e) => mudar('familia', e.target.value as RegrasMesa['familia'])}>
                <option value="off">Desligada</option>
                <option value="aberta">Aberta (mostra as cartas)</option>
                <option value="fechada">Fechada</option>
              </select>
            </div>
            {f.familia !== 'off' && (
              <div className="campo">
                <label htmlFor="tempo-familia">Tempo para pedir família</label>
                <select id="tempo-familia" value={String(f.tempoFamiliaS)} onChange={(e) => mudar('tempoFamiliaS', Number(e.target.value) as FormLobby['tempoFamiliaS'])}>
                  {TEMPOS_FAMILIA_S.map((s) => (
                    <option key={s} value={String(s)}>
                      {s} segundos
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="campo">
              <label htmlFor="humanos">Humanos</label>
              <select id="humanos" value={String(f.humanos)} onChange={(e) => mudar('humanos', Number(e.target.value))}>
                <option value="1">Só eu (3 bots)</option>
                <option value="2">2 humanos</option>
                <option value="3">3 humanos</option>
                <option value="4">4 humanos</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="bots">Bots</label>
              <select id="bots" value={f.nivelBot} onChange={(e) => mudar('nivelBot', e.target.value as NivelBot)}>
                <option value="facil">Fácil</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>
            <div className="campo largo">
              <label htmlFor="interceptar">Adversários podem interceptar sinais</label>
              <select
                id="interceptar"
                value={String(f.chanceInterceptarSinal)}
                onChange={(e) => mudar('chanceInterceptarSinal', Number(e.target.value))}
              >
                {OPCOES_INTERCEPTACAO.map((o) => (
                  <option key={o.valor} value={String(o.valor)}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <label className="campo-check largo">
              <input type="checkbox" checked={f.maoDe10} onChange={(e) => mudar('maoDe10', e.target.checked)} />
              Mão de 10
            </label>
            {f.variante === 'mineiro' && (
              <label className="campo-check largo">
                <input type="checkbox" checked={f.maoLimpa} onChange={(e) => mudar('maoLimpa', e.target.checked)} />
                <span>
                  Mão limpa <small>(sem 4 a 7, com 2 coringas)</small>
                </span>
              </label>
            )}
          </div>
          <p className="regras-salvas">
            {aoSalvarNaConta ? 'Estas regras ficam salvas na sua conta.' : 'Estas regras ficam salvas neste aparelho. Entre na conta para levar para qualquer lugar.'}
          </p>
        </details>
      </form>
    </main>
  );
}

const TEXTO_FAMILIA: Record<RegrasMesa['familia'], string> = { off: 'sem família', aberta: 'família aberta', fechada: 'família fechada' };
const TEXTO_MAO11: Record<RegrasMesa['maoDe11'], string | null> = { off: null, qualquerDupla: 'mão de 11', onzeAOnze: 'mão de 11 só no 11 a 11' };

/** Uma linha com as regras escolhidas, para o bloco recolhido. */
function resumoLobby(f: FormLobby): string {
  const bots = 4 - f.humanos;
  const nivel = f.nivelBot === 'facil' ? (bots === 1 ? 'fácil' : 'fáceis') : bots === 1 ? 'difícil' : 'difíceis';
  const partes = [
    f.variante === 'paulista' ? 'Paulista' : 'Mineiro',
    f.pontuacao,
    f.maoDe10 ? 'mão de 10' : null,
    TEXTO_MAO11[f.maoDe11],
    TEXTO_FAMILIA[f.familia],
    f.variante === 'mineiro' && f.maoLimpa ? 'mão limpa' : null,
    bots > 0 ? `${bots} ${bots === 1 ? 'bot' : 'bots'} ${nivel}` : 'só humanos',
    f.chanceInterceptarSinal > 0 ? 'sinais interceptáveis' : null,
  ];
  return partes.filter(Boolean).join(', ');
}
