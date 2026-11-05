import { baralhoDaMesa, type Carta, idCarta, NAIPES } from './cartas';
import {
  type Acao,
  type AcaoJogador,
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
import { ESCADAS, NIVEL_MAXIMO, PONTOS_VITORIA, type RegrasMesa } from './regras';

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

/** Motivo pelo qual `x` não tem o formato de uma ação, ou null se tem. */
function problemaDeFormato(x: unknown): string | null {
  if (typeof x !== 'object' || x === null) return 'ação malformada';
  const a = x as Record<string, unknown>;
  switch (a.tipo) {
    case 'distribuir':
      return Array.isArray(a.baralho) ? null : 'baralho malformado';
    case 'jogar':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      if (!Number.isInteger(a.indice)) return 'índice inválido';
      if (a.coberta !== undefined && typeof a.coberta !== 'boolean') return 'coberta deve ser booleano';
      return null;
    case 'mao10':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return typeof a.jogar === 'boolean' ? null : 'jogar deve ser booleano';
    case 'truco':
    case 'aceitar':
    case 'correr':
    case 'aumentar':
    case 'familia':
      return ehCadeira(a.cadeira) ? null : 'cadeira inválida';
    default:
      return `ação desconhecida: ${String(a.tipo)}`;
  }
}

/** Garante o formato da ação (a entrada pode vir crua de um cliente). */
function validarAcao(acao: unknown): asserts acao is Acao {
  const problema = problemaDeFormato(acao);
  if (problema) falha(problema);
}

/**
 * Verifica se uma mensagem crua (ex.: vinda de um cliente) é uma ação de jogador
 * bem formada. Rejeita `distribuir`, que só o servidor pode emitir. Não verifica
 * se a ação é legal no estado atual — isso é papel do `reduce`.
 */
export function ehAcaoJogador(x: unknown): x is AcaoJogador {
  return problemaDeFormato(x) === null && (x as Acao).tipo !== 'distribuir';
}

function idSeCarta(x: unknown): string | null {
  if (typeof x !== 'object' || x === null) return null;
  const { valor, naipe } = x as Record<string, unknown>;
  if (typeof valor !== 'string' || typeof naipe !== 'string') return null;
  if (!(NAIPES as readonly string[]).includes(naipe)) return null;
  return idCarta({ valor, naipe } as Carta);
}

/** Exige exatamente as cartas distintas de `baralhoDaMesa(regras)` (40, ou 29 na mão limpa). */
function validarBaralho(baralho: unknown[], regras: RegrasMesa): asserts baralho is Carta[] {
  const esperado = baralhoDaMesa(regras);
  if (baralho.length !== esperado.length) falha(`baralho deve ter ${esperado.length} cartas`);
  const ids = new Set(esperado.map(idCarta));
  const vistas = new Set<string>();
  for (const x of baralho) {
    const id = idSeCarta(x);
    if (id === null || !ids.has(id)) falha('baralho contém carta inválida');
    if (vistas.has(id)) falha(`baralho contém carta repetida: ${id}`);
    vistas.add(id);
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
  validarBaralho(baralho, s.regras);

  const maos: Carta[][] = [[], [], [], []];
  let i = 0;
  for (let rodada = 0; rodada < 3; rodada++) {
    for (let k = 1; k <= 4; k++) maos[(s.pe + k) % 4].push({ ...baralho[i++] });
  }
  const tipo = tipoDaMao(s);
  const mao: EstadoMao = {
    tipo,
    vira: s.regras.variante === 'paulista' ? { ...baralho[12] } : null,
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
  const m = maoAtual(s);
  if (vencedor !== null) s.placar[vencedor] += pontos;
  s.ultimaMao = {
    vencedor,
    pontos: vencedor === null ? 0 : pontos,
    motivo,
    rodadas: m.rodadas,
    rodadasJogadas: m.mesa.length > 0 ? [...m.rodadasJogadas, m.mesa] : m.rodadasJogadas,
    vira: m.vira,
  };
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
