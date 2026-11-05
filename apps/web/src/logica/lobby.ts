import { type Pontuacao, REGRAS_RANQUEADA, type RegrasMesa, type Variante } from '@truco/engine';
import type { NivelBot } from '@truco/protocolo';

export interface FormLobby {
  nome: string;
  variante: Variante;
  pontuacao: Pontuacao;
  maoDe10: boolean;
  maoDe11: RegrasMesa['maoDe11'];
  familia: RegrasMesa['familia'];
  humanos: number;
  nivelBot: NivelBot;
}

/** O que vai em `joinOrCreate('mesa', ...)`: opções de criação (lidas por `opcoesDaSala`) + `nome` do join. */
export interface OpcoesEntrada {
  nome: string;
  variante: Variante;
  humanos: number;
  nivelBot: NivelBot;
  regras: Omit<RegrasMesa, 'variante'>;
}

export const CHAVE_APELIDO = 'truco:apelido';

/** Regras iniciais = as da ranqueada da variante. */
export function formPadrao(variante: Variante = 'paulista', nome = ''): FormLobby {
  const r = REGRAS_RANQUEADA[variante];
  return {
    nome,
    variante,
    pontuacao: r.pontuacao,
    maoDe10: r.maoDe10,
    maoDe11: r.maoDe11,
    familia: r.familia,
    humanos: 1,
    nivelBot: 'facil',
  };
}

export function trocarVariante(f: FormLobby, variante: Variante): FormLobby {
  return { ...formPadrao(variante, f.nome), humanos: f.humanos, nivelBot: f.nivelBot };
}

export function opcoesDeEntrada(f: FormLobby): OpcoesEntrada {
  return {
    nome: f.nome.trim() || 'Jogador',
    variante: f.variante,
    humanos: Math.min(4, Math.max(1, Math.round(f.humanos))),
    nivelBot: f.nivelBot,
    regras: { pontuacao: f.pontuacao, maoDe10: f.maoDe10, maoDe11: f.maoDe11, familia: f.familia },
  };
}

export function lerApelido(): string {
  try {
    return localStorage.getItem(CHAVE_APELIDO) ?? '';
  } catch {
    return '';
  }
}

export function gravarApelido(nome: string): void {
  try {
    localStorage.setItem(CHAVE_APELIDO, nome);
  } catch {
    // modo privado / storage cheio: segue sem lembrar
  }
}
