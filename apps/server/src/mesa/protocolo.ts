import {
  type AcaoJogador,
  type Cadeira,
  type EstadoPartida,
  type ModoDistribuicao,
  ordemDistribuicao,
  parceiroDe,
  REGRAS_RANQUEADA,
  type RegrasMesa,
  tipoDaProximaFamilia,
  type Variante,
  type Visao,
} from '@truco/engine';
import type { MesaFisica } from './mesaFisica';

export type { MesaFisica, MsgBatida, Rachadura, TipoMesa } from './mesaFisica';

export const SINAIS = ['zap', 'copas', 'espadilha', 'picafumo', 'coringa', 'tres', 'dois', 'as', 'nada'] as const;
export type Sinal = (typeof SINAIS)[number];

export const FALAS = ['truco', 'seis', 'nove', 'doze', 'desce', 'corro', 'boa', 'vixe', 'bora'] as const;
export type Fala = (typeof FALAS)[number];

export type NivelBot = 'facil' | 'dificil';

export const MODOS_MESA = ['classica', 'desafio', 'privada', 'ranqueada'] as const;
export type ModoMesa = (typeof MODOS_MESA)[number];

/**
 * Close code (4000–4999 são da aplicação): mesa ranqueada cancelada antes de começar.
 * Não pode ser um `CloseCode` do Colyseus 0.18 (4000–4003, 4010): 4010 é `MAY_TRY_RECONNECT`,
 * e o SDK tentaria reconectar em vez de entregar o código ao `onLeave`.
 */
export const SAIDA_PARTIDA_CANCELADA = 4020;
/** Close code: o mesmo usuário entrou na fila por outra aba (a entrada antiga é derrubada). */
export const SAIDA_FILA_SUBSTITUIDA = 4011;

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

export const MAX_CHAT = 200;

export interface MsgChat {
  de: Cadeira;
  nome: string;
  texto: string;
}

/** Texto de chat: sem caracteres de controle/invisíveis, espaços juntados, até 200. */
export function limparChat(cru: unknown): string {
  if (typeof cru !== 'string') return '';
  return cru
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHAT)
    .trim();
}

export interface InfoCadeira {
  tipo: 'vazia' | 'humano' | 'bot';
  nome: string | null;
  conectado: boolean;
}

export interface MsgEstado {
  minhaCadeira: Cadeira;
  cadeiras: InfoCadeira[];
  /** Tipo da mesa (a tela usa para chat, convite e avisos da ranqueada). */
  modo: ModoMesa;
  /** Regras da mesa (vêm desde a sala de espera, antes de haver `visao`). */
  regras: RegrasMesa;
  /** Chance (0–1) de cada adversário ver um sinal; 0 = sinais são só do parceiro. */
  chanceInterceptarSinal: number;
  /** Quantos humanos a mesa espera antes de começar sozinha (o resto vira bot). */
  humanosEsperados: number;
  visao: Visao | null;
  /** Quem precisa agir e até quando (epoch ms). */
  prazo: { cadeiras: Cadeira[]; ate: number } | null;
  minhasAcoes: AcaoJogador[];
  /** Tampo ("bater na mesa"): rachaduras e se já quebrou e virou plástico. Sempre enviado pelo servidor. */
  mesaFisica?: MesaFisica;
}

export interface MsgAcao {
  cadeira: Cadeira;
  tipo: AcaoJogador['tipo'];
  /** Só em `mao10`: true = jogou a mão, false = correu. */
  jogar?: boolean;
  /** `distribuir`: como o pé deu. */
  modo?: ModoDistribuicao;
  /** `distribuir`: quem recebeu, na ordem (sem quem ganhou o "dar 3"). */
  ordem?: Cadeira[];
  /** `dar3`: quem recebeu as 3 de cima. */
  para?: Cadeira;
  /** `cortar`: fração do monte que passou para cima (3 níveis: 0.3 pouco, 0.5 meio, 0.7 muito; não revela o ponto exato). Só para a animação. */
  fracao?: number;
  /** `familia`: true = aberta (as cartas aparecem no `estado`). */
  aberta?: boolean;
  /** `conferir`: true = conferiu. */
  conferir?: boolean;
}

/**
 * Fração do corte reduzida a 3 níveis visuais (pouco/meio/muito: 0.3/0.5/0.7). O ponto vai de 30%
 * a 70% do monte (`limitesCorte`); cada terço dessa faixa vira um nível, e o ponto exato não sai.
 */
function nivelDoCorte(f: number): 0.3 | 0.5 | 0.7 {
  if (f < 0.3 + 0.4 / 3) return 0.3;
  if (f <= 0.7 - 0.4 / 3) return 0.5;
  return 0.7;
}

/**
 * O aviso público de uma ação (sem índice/carta: a jogada em si chega pelo `estado`).
 * `antes` = estado em que a ação foi aplicada (para a ordem da distribuição, a fração do
 * corte e o tipo da família). Nunca leva a sorte (`bits`, `ponto`).
 */
export function msgDaAcao(a: AcaoJogador, antes: EstadoPartida | null = null): MsgAcao {
  const base: MsgAcao = { cadeira: a.cadeira, tipo: a.tipo };
  switch (a.tipo) {
    case 'mao10':
      return { ...base, jogar: a.jogar };
    case 'distribuir':
      return antes
        ? { ...base, modo: a.modo, ordem: ordemDistribuicao(antes.pe, antes.ritual?.dadas?.cadeira ?? null) }
        : { ...base, modo: a.modo };
    case 'dar3':
      return { ...base, para: parceiroDe(a.cadeira) };
    case 'cortar': {
      const n = antes?.monte.length ?? 0;
      return a.ponto !== undefined && n > 0 ? { ...base, fracao: nivelDoCorte(a.ponto / n) } : base;
    }
    case 'familia':
      return antes ? { ...base, aberta: tipoDaProximaFamilia(antes) === 'aberta' } : base;
    case 'conferir':
      return { ...base, conferir: a.conferir };
    default:
      return base;
  }
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
  modo: ModoMesa;
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
    `lim:${regras.maoLimpa === true ? 1 : 0}`,
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
    // Mão limpa só existe no mineiro.
    maoLimpa: variante === 'mineiro' && r.maoLimpa === true,
  };
  const h = o.humanos;
  const humanos = typeof h === 'number' && Number.isInteger(h) && h >= 1 && h <= 4 ? h : 1;
  const ch = o.chanceInterceptarSinal;
  const chanceInterceptarSinal = typeof ch === 'number' && ch >= 0 && ch <= 1 ? ch : 0;
  const nivelPedido = um(o.nivelBot, ['facil', 'dificil'] as const, 'facil');
  const modo = um(o.modo, MODOS_MESA, nivelPedido === 'dificil' ? 'desafio' : 'classica');
  if (modo === 'ranqueada') {
    return { modo, regras: { ...REGRAS_RANQUEADA[variante] }, humanos: h === 4 ? 4 : 2, nivelBot: 'dificil', chanceInterceptarSinal: 0 };
  }
  const nivelBot: NivelBot = modo === 'classica' ? 'facil' : modo === 'desafio' ? 'dificil' : nivelPedido;
  return { modo, regras, humanos, nivelBot, chanceInterceptarSinal };
}

/** Campos do `filterBy` da sala `mesa`, sempre preenchidos com valores validados. */
export interface FiltroSala {
  modo: ModoMesa;
  variante: Variante;
  humanos: number;
  nivelBot: NivelBot;
  chaveRegras: string;
}

export function filtroDaSala(o: OpcoesSala): FiltroSala {
  return {
    modo: o.modo,
    variante: o.regras.variante,
    humanos: o.humanos,
    nivelBot: o.nivelBot,
    chaveRegras: chaveRegras(o.regras, o.chanceInterceptarSinal),
  };
}
