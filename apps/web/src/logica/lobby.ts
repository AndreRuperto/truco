import { type Pontuacao, REGRAS_RANQUEADA, type RegrasMesa, type Variante } from '@truco/engine';
import { chaveRegras, type NivelBot } from '@truco/protocolo';

export interface FormLobby {
  nome: string;
  variante: Variante;
  pontuacao: Pontuacao;
  maoDe10: boolean;
  maoDe11: RegrasMesa['maoDe11'];
  familia: RegrasMesa['familia'];
  /** Mão limpa (só vale no mineiro). */
  maoLimpa: boolean;
  humanos: number;
  nivelBot: NivelBot;
  /** Chance (0–1) de cada adversário ver um sinal. */
  chanceInterceptarSinal: number;
  /** Mesa privada (link de convite). */
  privada: boolean;
}

/** Opções do campo "Adversários podem interceptar sinais". */
export const OPCOES_INTERCEPTACAO = [
  { valor: 0, rotulo: 'Nunca' },
  { valor: 0.25, rotulo: 'Às vezes' },
  { valor: 0.5, rotulo: 'Fácil' },
] as const;

/** O que vai em `joinOrCreate('mesa', ...)`: opções de criação (lidas por `opcoesDaSala`) + `nome` do join. */
export interface OpcoesEntrada {
  nome: string;
  variante: Variante;
  humanos: number;
  nivelBot: NivelBot;
  regras: Omit<RegrasMesa, 'variante'>;
  chanceInterceptarSinal: number;
  /**
   * `chaveRegras(regras, chance)`: o servidor só junta numa sala quem manda a mesma chave
   * (quem omite aceita qualquer sala), então o cliente oficial sempre manda.
   */
  chaveRegras: string;
  modo: 'classica' | 'desafio' | 'privada';
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
    maoLimpa: r.maoLimpa,
    humanos: 1,
    nivelBot: 'facil',
    chanceInterceptarSinal: 0,
    privada: false,
  };
}

export function trocarVariante(f: FormLobby, variante: Variante): FormLobby {
  return {
    ...formPadrao(variante, f.nome),
    humanos: f.humanos,
    nivelBot: f.nivelBot,
    chanceInterceptarSinal: f.chanceInterceptarSinal,
    privada: f.privada,
  };
}

export function opcoesDeEntrada(f: FormLobby): OpcoesEntrada {
  const regras = {
    pontuacao: f.pontuacao,
    maoDe10: f.maoDe10,
    maoDe11: f.maoDe11,
    familia: f.familia,
    maoLimpa: f.variante === 'mineiro' && f.maoLimpa,
  };
  const chance = Math.min(1, Math.max(0, f.chanceInterceptarSinal));
  return {
    nome: f.nome.trim() || 'Jogador',
    variante: f.variante,
    humanos: Math.min(4, Math.max(1, Math.round(f.humanos))),
    nivelBot: f.nivelBot,
    regras,
    chanceInterceptarSinal: chance,
    chaveRegras: chaveRegras({ variante: f.variante, ...regras }, chance),
    modo: f.privada ? 'privada' : f.nivelBot === 'dificil' ? 'desafio' : 'classica',
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
