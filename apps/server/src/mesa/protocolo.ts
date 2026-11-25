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
import type { VisualJogador } from '../api/tipos';
import { cacifeRanqueadaValido, cacifeValido } from '../loja/regras';
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
/** Close code: a conta foi suspensa pelo admin; a cadeira não fica guardada (vira abandono). */
export const SAIDA_CONTA_SUSPENSA = 4021;

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

/** Efeito da provocação: vem da moldura de quem provoca (sem moldura ou convidado: guardanapo). */
export const EFEITOS_PROVOCACAO = ['guardanapo', 'laco', 'farpa', 'ofusca', 'po-de-giz'] as const;
export type EfeitoProvocacao = (typeof EFEITOS_PROVOCACAO)[number];
const EFEITO_DA_MOLDURA: Record<string, EfeitoProvocacao> = { corda: 'laco', madeira: 'farpa', neon: 'ofusca', giz: 'po-de-giz' };
export const efeitoDaMoldura = (moldura: string | null | undefined): EfeitoProvocacao => EFEITO_DA_MOLDURA[moldura ?? ''] ?? 'guardanapo';

/** Mensagem `provocacao` (servidor → humanos): `id` só cresce, para a animação tocar uma vez. */
export interface MsgProvocacao {
  id: number;
  de: Cadeira;
  para: Cadeira;
  efeito: EfeitoProvocacao;
}

/** Mensagem `avatares`: fotos enviadas (`data:`) por id, mandadas uma vez a cada cliente antes do `estado`. */
export type MsgAvatares = Record<string, string>;

export interface InfoCadeira {
  tipo: 'vazia' | 'humano' | 'bot';
  nome: string | null;
  conectado: boolean;
  /** Foto pronta (`pronto:<id>`); null = sem. Foto enviada (`data:`) vem por `avatarId` (SEC-09). */
  avatar?: string | null;
  /** Foto enviada (`data:`, até 60 kB): só o id; a imagem chega uma vez na mensagem `avatares`. */
  avatarId?: string | null;
  /** Voz pessoal da conta (ex.: 'andre'): as falas dessa cadeira saem com ela. Só para contas logadas. */
  voz?: string | null;
  /** Itens da loja equipados (verso, roupa, moldura). Ausente = visual padrão (convidado/bot). */
  visual?: VisualJogador | null;
}

/** Fichas em jogo: `pedido` é o da mesa; `efetivo`/`pote` só depois que a partida começou. */
export interface CacifeMesa {
  pedido: number;
  efetivo: number | null;
  pote: number;
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
  /** Sinais liberados nesta mesa (false = ninguém sinaliza; o botão some). Ausente = ligados. */
  sinais?: boolean;
  /** Provocações com a moldura liberadas (nunca na ranqueada). Ausente = desligadas (servidor antigo). */
  provocacoes?: boolean;
  /**
   * Mesa privada sem limite de tempo: quem está conectado não tem prazo (o `prazo` fica null na
   * vez dele). Quem caiu continua com o prazo normal. Ausente = com limite (servidor antigo).
   */
  semLimiteDeTempo?: boolean;
  /** Ritmo da mesa (bots e animações). Ausente = calmo. */
  ritmo?: Ritmo;
  /** Segundos por jogada escolhidos na criação. Ausente = 20. */
  tempoJogadaS?: number;
  /** Quantos humanos a mesa espera antes de começar sozinha (o resto vira bot). */
  humanosEsperados: number;
  visao: Visao | null;
  /** Quem precisa agir e até quando (epoch ms). */
  prazo: { cadeiras: Cadeira[]; ate: number } | null;
  /** Mesa pausada: quem pausou e quando volta sozinha (epoch ms). null/ausente = rodando. */
  pausa?: { por: Cadeira; ate: number } | null;
  /** Esta cadeira pode pausar e retomar (sozinha contra bots; na privada, o admin). */
  podePausar?: boolean;
  /**
   * Hora de pedir família, logo depois de dar: ninguém joga carta até `ate` ou até todos os
   * humanos decidirem (pedir ou "sem família"). `decidiram`: humanos que já decidiram.
   */
  janelaFamilia?: { ate: number; decidiram: Cadeira[] } | null;
  /**
   * Fim de partida fora da ranqueada: quem quer revanche na mesma mesa (mesma turma, mesmas
   * regras). Com todos os humanos conectados nela, começa outra partida. null = não há.
   */
  revanche?: { votos: Cadeira[]; faltam: Cadeira[] } | null;
  minhasAcoes: AcaoJogador[];
  /** Tampo ("bater na mesa"): rachaduras e se já quebrou e virou plástico. Sempre enviado pelo servidor. */
  mesaFisica?: MesaFisica;
  /** Mesa valendo Fichas; null/ausente = sem cacife. */
  cacife?: CacifeMesa | null;
  /** Ranqueada repetida entre o mesmo grupo de contas em 24 h: a partida não mudou o ranking. */
  eloCongelado?: boolean;
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
  /** Segundos para pedir família depois de dar as cartas (iguais para todos). */
  tempoFamiliaS: TempoFamiliaS;
  /** Sinais entre parceiros liberados. Padrão: desligados no mineiro, ligados no paulista. */
  sinais: boolean;
  /** Provocações com a moldura (padrão: ligadas; ranqueada: sempre desligadas). */
  provocacoes: boolean;
  /** Fichas que cada humano com conta põe no pote (0 = sem cacife). */
  cacife: number;
  /** Sem prazo para quem está conectado (só na mesa privada; ver `MsgEstado.semLimiteDeTempo`). */
  semLimiteDeTempo: boolean;
  ritmo: Ritmo;
  tempoJogadaS: TempoJogadaS;
}

/** Sinais vêm ligados no paulista e desligados no mineiro (quem quiser liga na mesa). */
export const sinaisPadrao = (variante: Variante) => variante !== 'mineiro';

/**
 * Ritmo da mesa, escolhido ao criar: "calmo" dá tempo de acompanhar os bots (padrão desde
 * 2026-11-20); "rapido" é o ritmo de antes. Muda o tempo do bot pensar e do fim da mão (e, na tela,
 * a duração das animações); os prazos dos humanos vêm de `tempoJogadaS`.
 */
export const RITMOS = ['calmo', 'rapido'] as const;
export type Ritmo = (typeof RITMOS)[number];
export const TEMPOS_DO_RITMO: Record<Ritmo, { botMs: number; pausaMaoMs: number }> = {
  calmo: { botMs: 1_400, pausaMaoMs: 2_600 },
  rapido: { botMs: 900, pausaMaoMs: 1_800 },
};
/** Segundos para cada jogada (e para responder truco, conferir, empilhar), escolhidos ao criar a mesa. */
export const TEMPOS_JOGADA_S = [15, 20, 30] as const;
export type TempoJogadaS = (typeof TEMPOS_JOGADA_S)[number];

export const TEMPOS_FAMILIA_S = [20, 25, 30] as const;
export type TempoFamiliaS = (typeof TEMPOS_FAMILIA_S)[number];

/**
 * Chave achatada das regras que importam para juntar jogadores na mesma sala
 * (o `filterBy` do Colyseus só compara valores simples). A variante fica de fora:
 * ela já tem filtro próprio. O cliente oficial sempre manda esta chave em
 * `joinOrCreate`; a sala a recalcula a partir das opções validadas (ver `MesaRoom.onCreate`).
 */
export function chaveRegras(
  regras: RegrasMesa,
  chanceInterceptarSinal: number,
  tempoFamiliaS: number = 20,
  sinais: boolean = sinaisPadrao(regras.variante),
  provocacoes: boolean = true,
  ritmo: Ritmo = 'calmo',
  tempoJogadaS: number = 20,
): string {
  return [
    regras.pontuacao,
    `m10:${regras.maoDe10 ? 1 : 0}`,
    `m11:${regras.maoDe11}`,
    `fam:${regras.familia}`,
    `lim:${regras.maoLimpa === true ? 1 : 0}`,
    `int:${chanceInterceptarSinal}`,
    ...(regras.familia === 'off' ? [] : [`tf:${tempoFamiliaS}`]),
    `sin:${sinais ? 1 : 0}`,
    // Só quando desligadas: as chaves das mesas de antes (e do PWA antigo) não mudam.
    ...(provocacoes ? [] : ['prov:0']),
    // Ritmo e tempo só fora do padrão, pelo mesmo motivo.
    ...(ritmo === 'calmo' ? [] : [`rit:${ritmo}`]),
    ...(tempoJogadaS === 20 ? [] : [`tj:${tempoJogadaS}`]),
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
    // 'qualquerDupla' (todos às cegas com só uma dupla no 11) saiu: cliente antigo cai no 11 a 11.
    maoDe11: r.maoDe11 === 'qualquerDupla' ? 'onzeAOnze' : um(r.maoDe11, ['off', 'onzeAOnze'] as const, base.maoDe11),
    // Família só existe no mineiro (no paulista, com a vira, Q, J e K podem ser manilha).
    familia: variante === 'mineiro' ? um(r.familia, ['off', 'aberta', 'fechada'] as const, base.familia) : 'off',
    // Mão limpa só existe no mineiro.
    maoLimpa: variante === 'mineiro' && r.maoLimpa === true,
  };
  const h = o.humanos;
  const humanos = typeof h === 'number' && Number.isInteger(h) && h >= 1 && h <= 4 ? h : 1;
  const ch = o.chanceInterceptarSinal;
  const chanceInterceptarSinal = typeof ch === 'number' && ch >= 0 && ch <= 1 ? ch : 0;
  const tf = o.tempoFamiliaS;
  const tempoFamiliaS: TempoFamiliaS = (TEMPOS_FAMILIA_S as readonly unknown[]).includes(tf) ? (tf as TempoFamiliaS) : 20;
  const sinais = typeof o.sinais === 'boolean' ? o.sinais : sinaisPadrao(variante);
  const provocacoes = o.provocacoes !== false;
  const nivelPedido = um(o.nivelBot, ['facil', 'dificil'] as const, 'facil');
  const modo = um(o.modo, MODOS_MESA, nivelPedido === 'dificil' ? 'desafio' : 'classica');
  if (modo === 'ranqueada') {
    return {
      modo,
      regras: { ...REGRAS_RANQUEADA[variante] },
      humanos: h === 4 ? 4 : 2,
      nivelBot: 'dificil',
      chanceInterceptarSinal: 0,
      tempoFamiliaS: 20,
      sinais: sinaisPadrao(variante),
      provocacoes: false,
      // Vem só da fila (que calcula pela patente); o cliente não cria ranqueada.
      cacife: cacifeRanqueadaValido(o.cacife),
      semLimiteDeTempo: false,
      ritmo: 'calmo',
      tempoJogadaS: 20,
    };
  }
  const nivelBot: NivelBot = modo === 'classica' ? 'facil' : modo === 'desafio' ? 'dificil' : nivelPedido;
  // Mesa privada é para chamar gente pelo link: com 1 humano ela começaria na hora, sem sala de
  // espera (e sem link). Espera até 4; o dono pode começar com bots quando quiser.
  const humanosMesa = modo === 'privada' && humanos < 2 ? 4 : humanos;
  // Sozinho contra bots não há com quem apostar.
  const cacife = humanosMesa >= 2 ? cacifeValido(o.cacife) : 0;
  // Sem limite de tempo é coisa de mesa entre amigos: nas públicas o relógio segura a mesa. A
  // exceção é o tutorial: sozinho contra bots fáceis, ninguém espera por quem está aprendendo.
  const tutorial = o.tutorial === true && modo === 'classica' && humanosMesa === 1;
  const semLimiteDeTempo = (modo === 'privada' || tutorial) && o.semLimiteDeTempo === true;
  const ritmo = um(o.ritmo, RITMOS, 'calmo');
  const tj = o.tempoJogadaS;
  const tempoJogadaS: TempoJogadaS = (TEMPOS_JOGADA_S as readonly unknown[]).includes(tj) ? (tj as TempoJogadaS) : 20;
  return { modo, regras, humanos: humanosMesa, nivelBot, chanceInterceptarSinal, tempoFamiliaS, sinais, provocacoes, cacife, semLimiteDeTempo, ritmo, tempoJogadaS };
}

/** Campos do `filterBy` da sala `mesa`, sempre preenchidos com valores validados. */
export interface FiltroSala {
  modo: ModoMesa;
  variante: Variante;
  humanos: number;
  nivelBot: NivelBot;
  chaveRegras: string;
  /** Mesas de cacifes diferentes nunca se misturam no `joinOrCreate`. */
  cacife: number;
}

export function filtroDaSala(o: OpcoesSala): FiltroSala {
  return {
    modo: o.modo,
    variante: o.regras.variante,
    humanos: o.humanos,
    nivelBot: o.nivelBot,
    chaveRegras: chaveRegras(o.regras, o.chanceInterceptarSinal, o.tempoFamiliaS, o.sinais, o.provocacoes, o.ritmo, o.tempoJogadaS),
    cacife: o.cacife,
  };
}

/** Os tempos que a mesa ganha pelo ritmo e pelo tempo por jogada escolhidos. */
export function temposDaMesa(o: Pick<OpcoesSala, 'ritmo' | 'tempoJogadaS'>): { botMs: number; pausaMaoMs: number; jogadaMs: number } {
  return { ...TEMPOS_DO_RITMO[o.ritmo], jogadaMs: o.tempoJogadaS * 1000 };
}
