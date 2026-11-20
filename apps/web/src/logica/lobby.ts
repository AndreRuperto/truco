import { type Pontuacao, REGRAS_RANQUEADA, type RegrasMesa, type Variante } from '@truco/engine';
import type { PreferenciasMesa } from '@truco/api';
import { chaveRegras, type NivelBot, sinaisPadrao, TEMPOS_FAMILIA_S, type TempoFamiliaS } from '@truco/protocolo';

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
  /** Segundos para pedir família depois de dar as cartas. */
  tempoFamiliaS: TempoFamiliaS;
  /** Sinais entre parceiros (padrão: desligados no mineiro, ligados no paulista). */
  sinais: boolean;
  /** Provocações com a moldura (padrão: ligadas). */
  provocacoes: boolean;
  /** Mesa privada (link de convite). */
  privada: boolean;
  /** Fichas por cabeça (0 = sem cacife). Não fica nas preferências: cada mesa escolhe. */
  cacife?: number;
  /** Mesa privada sem limite de tempo por jogada. Não fica nas preferências: cada mesa escolhe. */
  semLimiteDeTempo?: boolean;
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
  tempoFamiliaS: TempoFamiliaS;
  sinais: boolean;
  provocacoes: boolean;
  /**
   * `chaveRegras(regras, chance, tempoFamiliaS, sinais, provocacoes)`: o servidor só junta numa sala quem manda a mesma chave
   * (quem omite aceita qualquer sala), então o cliente oficial sempre manda.
   */
  chaveRegras: string;
  modo: 'classica' | 'desafio' | 'privada';
  /** Foto de quem entra sem conta (`pronto:<id>` ou `data:`); logado, o servidor usa a da conta. */
  avatar?: string | null;
  /** Fichas por cabeça (0/ausente = sem cacife; o servidor valida e só aceita com conta). */
  cacife?: number;
  /** Só na mesa privada (o servidor ignora nas outras): ninguém conectado tem prazo para agir. */
  semLimiteDeTempo?: boolean;
  /** Partida guiada: sozinho, bots fáceis, e o servidor libera o "sem limite de tempo" na clássica. */
  tutorial?: true;
}

export const CHAVE_APELIDO = 'truco:apelido';
export const CHAVE_PREFERENCIAS = 'truco:regras';
export const CHAVE_AVATAR = 'truco:avatar';

/** Foto escolhida por quem joga sem conta, guardada no aparelho. */
export function lerAvatarLocal(): string | null {
  try {
    const v = localStorage.getItem(CHAVE_AVATAR);
    return v && (v.startsWith('pronto:') || v.startsWith('data:image/')) && v.length <= 60_000 ? v : null;
  } catch {
    return null;
  }
}

export function gravarAvatarLocal(v: string | null): void {
  try {
    if (v) localStorage.setItem(CHAVE_AVATAR, v);
    else localStorage.removeItem(CHAVE_AVATAR);
  } catch {
    // modo privado / storage cheio: vale só nesta visita
  }
}

/** Como a tela inicial abre na primeira visita (sem nada salvo). */
export const PREFERENCIAS_PADRAO: Readonly<PreferenciasMesa> = Object.freeze({
  variante: 'mineiro',
  pontuacao: '1-3-6-9-12',
  maoDe10: true,
  maoDe11: 'onzeAOnze',
  familia: 'fechada',
  maoLimpa: true,
  humanos: 1,
  nivelBot: 'dificil',
  chanceInterceptarSinal: 0.25,
  tempoFamiliaS: 20,
  sinais: false,
});

/** Formulário inicial: o padrão da casa com o que estiver salvo por cima. */
export function formInicial(nome: string, salvas: Partial<PreferenciasMesa> | null = null): FormLobby {
  const f = { tempoFamiliaS: 20 as TempoFamiliaS, ...PREFERENCIAS_PADRAO, ...(salvas ?? {}), nome, privada: false };
  // Preferência antiga (sem o campo): o padrão da variante salva.
  return { ...f, sinais: salvas?.sinais ?? sinaisPadrao(f.variante), provocacoes: salvas?.provocacoes ?? true };
}

/** O que do formulário vale lembrar (sem apelido e sem "mesa privada", que é por partida). */
export function preferenciasDe(f: FormLobby): PreferenciasMesa {
  return {
    variante: f.variante,
    pontuacao: f.pontuacao,
    maoDe10: f.maoDe10,
    maoDe11: f.maoDe11,
    familia: f.familia,
    maoLimpa: f.maoLimpa,
    humanos: f.humanos,
    nivelBot: f.nivelBot,
    chanceInterceptarSinal: f.chanceInterceptarSinal,
    tempoFamiliaS: f.tempoFamiliaS,
    sinais: f.sinais,
    provocacoes: f.provocacoes,
  };
}

const umDe = <T>(v: unknown, ok: readonly T[]): v is T => (ok as readonly unknown[]).includes(v);

/** Confere o formato (pode vir velho ou mexido do localStorage); campo estranho cai fora. */
export function limparPreferencias(cru: unknown): Partial<PreferenciasMesa> | null {
  if (!cru || typeof cru !== 'object') return null;
  const o = cru as Record<string, unknown>;
  const p: Partial<PreferenciasMesa> = {};
  if (umDe(o.variante, ['paulista', 'mineiro'] as const)) p.variante = o.variante;
  if (umDe(o.pontuacao, ['1-3-6-9-12', '2-4-8-10-12'] as const)) p.pontuacao = o.pontuacao;
  if (typeof o.maoDe10 === 'boolean') p.maoDe10 = o.maoDe10;
  // 'qualquerDupla' saiu (todos às cegas com só uma dupla no 11): preferência antiga vira o 11 a 11.
  if (o.maoDe11 === 'qualquerDupla') p.maoDe11 = 'onzeAOnze';
  else if (umDe(o.maoDe11, ['off', 'onzeAOnze'] as const)) p.maoDe11 = o.maoDe11;
  if (umDe(o.familia, ['off', 'aberta', 'fechada'] as const)) p.familia = o.familia;
  if (typeof o.maoLimpa === 'boolean') p.maoLimpa = o.maoLimpa;
  if (umDe(o.humanos, [1, 2, 3, 4] as const)) p.humanos = o.humanos;
  if (umDe(o.nivelBot, ['facil', 'dificil'] as const)) p.nivelBot = o.nivelBot;
  if (umDe(o.chanceInterceptarSinal, OPCOES_INTERCEPTACAO.map((x) => x.valor))) p.chanceInterceptarSinal = o.chanceInterceptarSinal;
  if (umDe(o.tempoFamiliaS, TEMPOS_FAMILIA_S)) p.tempoFamiliaS = o.tempoFamiliaS;
  if (typeof o.sinais === 'boolean') p.sinais = o.sinais;
  if (typeof o.provocacoes === 'boolean') p.provocacoes = o.provocacoes;
  return Object.keys(p).length ? p : null;
}

export function lerPreferenciasLocais(): Partial<PreferenciasMesa> | null {
  try {
    const t = localStorage.getItem(CHAVE_PREFERENCIAS);
    return t ? limparPreferencias(JSON.parse(t)) : null;
  } catch {
    return null;
  }
}

export function gravarPreferenciasLocais(p: PreferenciasMesa): void {
  try {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(p));
  } catch {
    // modo privado / storage cheio: segue sem lembrar
  }
}

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
    tempoFamiliaS: 20,
    sinais: sinaisPadrao(variante),
    provocacoes: true,
    privada: false,
  };
}

export function trocarVariante(f: FormLobby, variante: Variante): FormLobby {
  return {
    ...formPadrao(variante, f.nome),
    humanos: f.humanos,
    nivelBot: f.nivelBot,
    chanceInterceptarSinal: f.chanceInterceptarSinal,
    tempoFamiliaS: f.tempoFamiliaS,
    provocacoes: f.provocacoes,
    privada: f.privada,
    semLimiteDeTempo: f.semLimiteDeTempo,
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
    // Privada com "só eu" começaria na hora, sem sala de espera nem link: espera até 4 (o dono pode começar antes).
    humanos: f.privada && f.humanos < 2 ? 4 : Math.min(4, Math.max(1, Math.round(f.humanos))),
    nivelBot: f.nivelBot,
    regras,
    chanceInterceptarSinal: chance,
    tempoFamiliaS: f.tempoFamiliaS,
    sinais: f.sinais,
    provocacoes: f.provocacoes,
    chaveRegras: chaveRegras({ variante: f.variante, ...regras }, chance, f.tempoFamiliaS, f.sinais, f.provocacoes),
    modo: f.privada ? 'privada' : f.nivelBot === 'dificil' ? 'desafio' : 'classica',
    // Sozinho contra bots não há aposta.
    cacife: f.privada || f.humanos >= 2 ? (f.cacife ?? 0) : 0,
    ...(f.privada && f.semLimiteDeTempo ? { semLimiteDeTempo: true } : {}),
  };
}


/** Configuração rápida dos cards de criação na página de salas. */
export type TipoMesaVitrine = 'classica' | 'desafio';
export type AcessoMesaVitrine = 'publica' | 'privada';

/**
 * As mesas criadas pelo clube começam aguardando 4 humanos: assim o anfitrião
 * pode convidar gente ou iniciar com bots pela sala de espera. Usa as regras
 * salvas do jogador, mas força o nível de bots anunciado pelo card.
 */
export function opcoesDeVitrine(
  tipo: TipoMesaVitrine,
  acesso: AcessoMesaVitrine,
  nome: string,
  preferidas: Partial<PreferenciasMesa> | null,
): OpcoesEntrada {
  const f = formInicial(nome, preferidas);
  return opcoesDeEntrada({
    ...f,
    humanos: 4,
    nivelBot: tipo === 'desafio' ? 'dificil' : 'facil',
    privada: acesso === 'privada',
  });
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

/**
 * A mesa do tutorial: paulista como vem, sozinho contra bots fáceis, sem relógio, sem família e sem
 * sinais (o treinador explica o básico: ritual, carta, truco). O resto das regras fica no Manual.
 */
export function opcoesTutorial(nome: string): OpcoesEntrada {
  const f: FormLobby = {
    ...formPadrao('paulista', nome),
    humanos: 1,
    nivelBot: 'facil',
    familia: 'off',
    sinais: false,
    provocacoes: false,
    privada: false,
  };
  return { ...opcoesDeEntrada(f), modo: 'classica', tutorial: true, semLimiteDeTempo: true };
}
