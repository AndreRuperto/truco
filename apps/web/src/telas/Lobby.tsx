import type { Pontuacao, RegrasMesa, Variante } from '@truco/engine';
import type { NivelBot } from '@truco/protocolo';
import { type FormEvent, useState } from 'react';
import {
  type FormLobby,
  formPadrao,
  gravarApelido,
  lerApelido,
  type OpcoesEntrada,
  opcoesDeEntrada,
  trocarVariante,
} from '../logica/lobby';

interface Props {
  aoJogar: (o: OpcoesEntrada) => void;
}

export function Lobby({ aoJogar }: Props) {
  const [f, setF] = useState<FormLobby>(() => formPadrao('paulista', lerApelido()));
  const mudar = <K extends keyof FormLobby>(k: K, v: FormLobby[K]) => setF((x) => ({ ...x, [k]: v }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    gravarApelido(f.nome.trim());
    aoJogar(opcoesDeEntrada(f));
  };

  return (
    <main className="lobby">
      <h1>Truco</h1>
      <form className="formulario" onSubmit={enviar}>
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
            <option value="1-3-6-9-12">1 · 3 · 6 · 9 · 12</option>
            <option value="2-4-8-10-12">2 · 4 · 8 · 10 · 12</option>
          </select>
        </div>
        <label className="campo-check">
          <input type="checkbox" checked={f.maoDe10} onChange={(e) => mudar('maoDe10', e.target.checked)} />
          Mão de 10
        </label>
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
        <div className="botoes-lobby">
          <button type="submit" className="botao-principal">
            Jogar
          </button>
          <button type="button" disabled title="Em breve">
            Ranqueada (em breve)
          </button>
        </div>
      </form>
    </main>
  );
}
