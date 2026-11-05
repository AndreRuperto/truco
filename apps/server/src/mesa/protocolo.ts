import { type AcaoJogador, type Cadeira, REGRAS_RANQUEADA, type RegrasMesa, type Visao } from '@truco/engine';

export const SINAIS = ['zap', 'copas', 'espadilha', 'picafumo', 'tres', 'dois', 'as', 'nada'] as const;
export type Sinal = (typeof SINAIS)[number];

export const FALAS = ['truco', 'seis', 'nove', 'doze', 'desce', 'corro', 'boa', 'vixe', 'bora'] as const;
export type Fala = (typeof FALAS)[number];

export type NivelBot = 'facil' | 'dificil';

export const ehSinal = (x: unknown): x is Sinal => (SINAIS as readonly unknown[]).includes(x);
export const ehFala = (x: unknown): x is Fala => (FALAS as readonly unknown[]).includes(x);

/**
 * Nome exibido de um humano: sem caracteres de controle/invisíveis, aparado,
 * até 20 caracteres e sem o prefixo "Bot " (reservado aos bots).
 */
export function limparNome(cru: unknown): string {
  if (typeof cru !== 'string') return 'Jogador';
  const nome = cru
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
    .replace(/^(bot(\s+|$))+/iu, '')
    .slice(0, 20)
    .trim();
  return nome || 'Jogador';
}

export interface InfoCadeira {
  tipo: 'vazia' | 'humano' | 'bot';
  nome: string | null;
  conectado: boolean;
}

export interface MsgEstado {
  minhaCadeira: Cadeira;
  cadeiras: InfoCadeira[];
  /** Regras da mesa (vêm desde a sala de espera, antes de haver `visao`). */
  regras: RegrasMesa;
  /** Chance (0–1) de cada adversário ver um sinal; 0 = sinais são só do parceiro. */
  chanceInterceptarSinal: number;
  visao: Visao | null;
  /** Quem precisa agir e até quando (epoch ms). */
  prazo: { cadeiras: Cadeira[]; ate: number } | null;
  minhasAcoes: AcaoJogador[];
}

export interface MsgAcao {
  cadeira: Cadeira;
  tipo: AcaoJogador['tipo'];
}
export interface MsgSinal {
  de: Cadeira;
  sinal: Sinal;
  interceptado?: boolean;
}
export interface MsgFala {
  de: Cadeira;
  fala: Fala;
}
export interface MsgErro {
  mensagem: string;
}

export interface OpcoesSala {
  regras: RegrasMesa;
  humanos: number;
  nivelBot: NivelBot;
  /** Chance (0–1) de cada adversário ver um sinal. */
  chanceInterceptarSinal: number;
}

/**
 * Chave achatada das regras que importam para juntar jogadores na mesma sala
 * (o `filterBy` do Colyseus só compara valores simples). A variante fica de fora:
 * ela já tem filtro próprio. O cliente oficial sempre manda esta chave em
 * `joinOrCreate`; a sala a recalcula a partir das opções validadas (ver `MesaRoom.onCreate`).
 */
export function chaveRegras(regras: RegrasMesa, chanceInterceptarSinal: number): string {
  return [
    regras.pontuacao,
    `m10:${regras.maoDe10 ? 1 : 0}`,
    `m11:${regras.maoDe11}`,
    `fam:${regras.familia}`,
    `int:${chanceInterceptarSinal}`,
  ].join('|');
}

function um<T extends string>(v: unknown, permitidos: readonly T[], padrao: T): T {
  return (permitidos as readonly unknown[]).includes(v) ? (v as T) : padrao;
}

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});

/** Converte as opções cruas de criação de sala (vindas do cliente) em configuração válida. */
export function opcoesDaSala(cru: unknown): OpcoesSala {
  const o = obj(cru);
  const variante = um(o.variante, ['paulista', 'mineiro'] as const, 'paulista');
  const base = REGRAS_RANQUEADA[variante];
  const r = obj(o.regras);
  const regras: RegrasMesa = {
    variante,
    pontuacao: um(r.pontuacao, ['1-3-6-9-12', '2-4-8-10-12'] as const, base.pontuacao),
    maoDe10: typeof r.maoDe10 === 'boolean' ? r.maoDe10 : base.maoDe10,
    maoDe11: um(r.maoDe11, ['off', 'qualquerDupla', 'onzeAOnze'] as const, base.maoDe11),
    familia: um(r.familia, ['off', 'aberta', 'fechada'] as const, base.familia),
  };
  const h = o.humanos;
  const humanos = typeof h === 'number' && Number.isInteger(h) && h >= 1 && h <= 4 ? h : 1;
  const ch = o.chanceInterceptarSinal;
  const chanceInterceptarSinal = typeof ch === 'number' && ch >= 0 && ch <= 1 ? ch : 0;
  return { regras, humanos, nivelBot: um(o.nivelBot, ['facil', 'dificil'] as const, 'facil'), chanceInterceptarSinal };
}
