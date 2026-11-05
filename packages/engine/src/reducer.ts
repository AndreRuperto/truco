import type { Carta } from './cartas';
import {
  type Acao,
  type Cadeira,
  type Dupla,
  type EstadoMao,
  type EstadoPartida,
  type ResultadoMao,
  type TipoMao,
  duplaDe,
  proximaCadeira,
} from './estado';
import { ehFamilia } from './familia';
import { forca } from './forca';
import { resolverRodada, vencedorMao } from './mao';
import { ESCADAS, NIVEL_MAXIMO, PONTOS_VITORIA } from './regras';

export class ErroJogada extends Error {
  /** Permite reconhecer o erro sem instanceof (ex.: depois de serializar). */
  readonly codigo = 'ERRO_JOGADA' as const;

  constructor(message?: string) {
    super(message);
    this.name = 'ErroJogada';
  }
}

function falha(msg: string): never {
  throw new ErroJogada(msg);
}

const ehCadeira = (x: unknown): x is Cadeira => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 3;

/** Garante o formato da ação (a entrada pode vir crua de um cliente). */
function validarAcao(acao: unknown): asserts acao is Acao {
  if (typeof acao !== 'object' || acao === null) falha('ação malformada');
  const a = acao as Record<string, unknown>;
  switch (a.tipo) {
    case 'distribuir':
      if (!Array.isArray(a.baralho)) falha('baralho malformado');
      return;
    case 'jogar':
      if (!ehCadeira(a.cadeira)) falha('cadeira inválida');
      if (!Number.isInteger(a.indice)) falha('índice inválido');
      if (a.coberta !== undefined && typeof a.coberta !== 'boolean') falha('coberta deve ser booleano');
      return;
    case 'mao10':
      if (!ehCadeira(a.cadeira)) falha('cadeira inválida');
      if (typeof a.jogar !== 'boolean') falha('jogar deve ser booleano');
      return;
    case 'truco':
    case 'aceitar':
    case 'correr':
    case 'aumentar':
    case 'familia':
      if (!ehCadeira(a.cadeira)) falha('cadeira inválida');
      return;
    default:
      falha(`ação desconhecida: ${String(a.tipo)}`);
  }
}

export function reduce(estado: EstadoPartida, acao: Acao): EstadoPartida {
  validarAcao(acao);
  const s = structuredClone(estado);
  switch (acao.tipo) {
    case 'distribuir':
      distribuir(s, acao.baralho);
      break;
    case 'jogar':
      jogar(s, acao.cadeira, acao.indice, acao.coberta ?? false);
      break;
    case 'truco':
      pedirTruco(s, acao.cadeira);
      break;
    case 'aceitar':
    case 'correr':
    case 'aumentar':
      responderTruco(s, acao.cadeira, acao.tipo);
      break;
    case 'mao10':
      decidirMao10(s, acao.cadeira, acao.jogar);
      break;
    case 'familia':
      pedirFamilia(s, acao.cadeira);
      break;
    default:
      falha(`ação desconhecida: ${(acao as Acao).tipo}`);
  }
  return s;
}

export function escada(s: EstadoPartida): readonly number[] {
  return ESCADAS[s.regras.pontuacao];
}

export function tipoDaMao(s: EstadoPartida): TipoMao {
  const [a, b] = s.placar;
  const { maoDe10, maoDe11 } = s.regras;
  if (maoDe11 === 'qualquerDupla' && (a === 11 || b === 11)) return 'mao11';
  if (maoDe11 === 'onzeAOnze' && a === 11 && b === 11) return 'mao11';
  if (maoDe10 && (a === 10) !== (b === 10)) return 'mao10';
  return 'normal';
}

function distribuir(s: EstadoPartida, baralho: Carta[]): void {
  if (s.fase !== 'aguardandoDistribuicao') falha('não é hora de distribuir');
  if (baralho.length !== 40) falha('baralho deve ter 40 cartas');

  const maos: Carta[][] = [[], [], [], []];
  let i = 0;
  for (let rodada = 0; rodada < 3; rodada++) {
    for (let k = 1; k <= 4; k++) maos[(s.pe + k) % 4].push(baralho[i++]);
  }
  const tipo = tipoDaMao(s);
  const mao: EstadoMao = {
    tipo,
    vira: s.regras.variante === 'paulista' ? baralho[12] : null,
    maos,
    mesa: [],
    rodadasJogadas: [],
    rodadas: [],
    vez: proximaCadeira(s.pe),
    nivel: 0,
    ultimoAumento: null,
    trucoPendente: null,
    duplaNoDez: tipo === 'mao10' ? (s.placar[0] === 10 ? 0 : 1) : null,
  };
  s.mao = mao;
  s.fase = tipo === 'mao10' ? 'decisaoMao10' : 'jogando';
}

export function finalizarMao(
  s: EstadoPartida,
  vencedor: Dupla | null,
  pontos: number,
  motivo: ResultadoMao['motivo'],
): void {
  if (vencedor !== null) s.placar[vencedor] += pontos;
  s.ultimaMao = { vencedor, pontos: vencedor === null ? 0 : pontos, motivo };
  s.mao = null;
  if (vencedor !== null && s.placar[vencedor] >= PONTOS_VITORIA) {
    s.vencedor = vencedor;
    s.fase = 'fimPartida';
    return;
  }
  s.pe = proximaCadeira(s.pe) as Cadeira;
  s.fase = 'aguardandoDistribuicao';
}

function maoAtual(s: EstadoPartida): EstadoMao {
  if (!s.mao) falha('nenhuma mão em andamento');
  return s.mao;
}

function jogar(s: EstadoPartida, cadeira: Cadeira, indice: number, coberta: boolean): void {
  const m = maoAtual(s);
  if (s.fase !== 'jogando') falha('não é hora de jogar carta');
  if (m.vez !== cadeira) falha('não é sua vez');
  const mao = m.maos[cadeira];
  if (!Number.isInteger(indice) || indice < 0 || indice >= mao.length) falha('carta inválida');
  if (coberta && (m.rodadas.length === 0 || m.tipo === 'mao11')) falha('carta coberta só a partir da 2ª rodada');

  const [carta] = mao.splice(indice, 1);
  m.mesa.push({
    cadeira,
    carta,
    coberta,
    forca: coberta ? 0 : forca(carta, s.regras.variante, m.vira),
  });
  s.ultimaFamilia = null;

  if (m.mesa.length < 4) {
    m.vez = proximaCadeira(cadeira);
    return;
  }

  const { resultado, proximo } = resolverRodada(m.mesa);
  m.rodadas.push(resultado);
  m.rodadasJogadas.push(m.mesa);
  m.mesa = [];
  const v = vencedorMao(m.rodadas);
  if (v === 'continua') {
    m.vez = proximo;
    return;
  }
  finalizarMao(s, v, escada(s)[m.nivel], 'rodadas');
}

function pedirTruco(s: EstadoPartida, cadeira: Cadeira): void {
  const m = maoAtual(s);
  if (s.fase !== 'jogando') falha('não é hora de trucar');
  if (m.vez !== cadeira) falha('só pode trucar na sua vez');
  if (m.tipo !== 'normal') falha('não se truca nesta mão');
  const dupla = duplaDe(cadeira);
  if (m.ultimoAumento === dupla) falha('sua dupla não pode aumentar agora');
  if (m.nivel >= NIVEL_MAXIMO) falha('aposta já está no máximo');
  m.trucoPendente = { dupla, proposto: m.nivel + 1 };
  s.fase = 'respondendoTruco';
}

function responderTruco(s: EstadoPartida, cadeira: Cadeira, resposta: 'aceitar' | 'correr' | 'aumentar'): void {
  const m = maoAtual(s);
  const p = m.trucoPendente;
  if (s.fase !== 'respondendoTruco' || !p) falha('não há truco para responder');
  const dupla = duplaDe(cadeira);
  if (dupla === p.dupla) falha('quem pediu não responde');

  if (resposta === 'correr') {
    finalizarMao(s, p.dupla, escada(s)[m.nivel], 'correu');
    return;
  }
  if (resposta === 'aceitar') {
    m.nivel = p.proposto;
    m.ultimoAumento = p.dupla;
    m.trucoPendente = null;
    s.fase = 'jogando';
    return;
  }
  if (p.proposto >= NIVEL_MAXIMO) falha('aposta já está no máximo');
  m.nivel = p.proposto;
  m.trucoPendente = { dupla, proposto: p.proposto + 1 };
}

function decidirMao10(s: EstadoPartida, cadeira: Cadeira, jogarMao: boolean): void {
  const m = maoAtual(s);
  if (s.fase !== 'decisaoMao10') falha('não há mão de 10 para decidir');
  const dupla = duplaDe(cadeira);
  if (dupla !== m.duplaNoDez) falha('só a dupla com 10 decide');
  if (!jogarMao) {
    finalizarMao(s, (1 - dupla) as Dupla, escada(s)[0], 'mao10Correu');
    return;
  }
  m.nivel = 1;
  s.fase = 'jogando';
}

function pedirFamilia(s: EstadoPartida, cadeira: Cadeira): void {
  const m = maoAtual(s);
  if (s.regras.familia === 'off') falha('família desligada nesta mesa');
  if (s.fase !== 'jogando' || m.tipo !== 'normal') falha('não é hora de pedir família');
  if (m.rodadas.length > 0 || m.mesa.length > 0 || m.nivel > 0) falha('família só antes da 1ª carta');
  const mao = m.maos[cadeira];
  if (!ehFamilia(mao)) falha('isso não é família');
  s.ultimaFamilia = { cadeira, cartas: s.regras.familia === 'aberta' ? [...mao] : null };
  s.mao = null;
  s.fase = 'aguardandoDistribuicao';
}
