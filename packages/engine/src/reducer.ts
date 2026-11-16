import { baralhoDaMesa, type Carta, idCarta, NAIPES } from './cartas';
import {
  type Acao,
  type AcaoJogador,
  type Cadeira,
  type Dupla,
  type EstadoMao,
  type EstadoPartida,
  type EstadoRitual,
  type ResultadoMao,
  type TipoMao,
  duplaDe,
  parceiroDe,
  proximaCadeira,
} from './estado';
import { ehFamilia, janelaDeFamilia, tipoDaProximaFamilia } from './familia';
import { forca } from './forca';
import { resolverRodada, vencedorMao } from './mao';
import { ESCADAS, limiteMaoEspecial, NIVEL_MAXIMO, PONTOS_VITORIA, type RegrasMesa, tipoPeloPlacar } from './regras';
import {
  cortarMonte,
  darCartas,
  LIMITE_EMBARALHADAS,
  limitesCorte,
  type ModoDistribuicao,
  MODOS_DISTRIBUICAO,
  MOVIMENTOS_CORTE,
  ordemDistribuicao,
  recolher,
  riffle,
} from './ritual';

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
    case 'monte':
      return Array.isArray(a.baralho) ? null : 'baralho malformado';
    case 'jogar':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      if (!Number.isInteger(a.indice)) return 'índice inválido';
      if (a.coberta !== undefined && typeof a.coberta !== 'boolean') return 'coberta deve ser booleano';
      return null;
    case 'empilhar':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return Number.isInteger(a.indice) ? null : 'índice inválido';
    case 'mao10':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return typeof a.jogar === 'boolean' ? null : 'jogar deve ser booleano';
    case 'embaralhar':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      if (a.bits === undefined) return null;
      return Array.isArray(a.bits) && a.bits.every((b) => b === 0 || b === 1) ? null : 'bits do embaralho malformados';
    case 'cortar':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return a.ponto === undefined || Number.isInteger(a.ponto) ? null : 'ponto de corte inválido';
    case 'distribuir':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return (MODOS_DISTRIBUICAO as readonly unknown[]).includes(a.modo) ? null : 'modo de distribuir inválido';
    case 'conferir':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return typeof a.conferir === 'boolean' ? null : 'conferir deve ser booleano';
    case 'truco':
    case 'aceitar':
    case 'correr':
    case 'aumentar':
    case 'familia':
    case 'mostrar':
    case 'passarCorte':
    case 'abrir3':
    case 'dar3':
    case 'devolver':
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
 * bem formada. Rejeita `monte`, que só o servidor pode emitir. Não verifica
 * se a ação é legal no estado atual — isso é papel do `reduce`.
 */
export function ehAcaoJogador(x: unknown): x is AcaoJogador {
  // A sorte (bits do riffle, ponto do corte) só entra por `completarSorte` no servidor: vinda do
  // cliente, a ação é recusada sem percorrer o que veio (pode ser um array enorme).
  if (typeof x === 'object' && x !== null && ('bits' in x || 'ponto' in x)) return false;
  return problemaDeFormato(x) === null && (x as Acao).tipo !== 'monte';
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
    case 'monte':
      porMonte(s, acao.baralho);
      break;
    case 'embaralhar':
      embaralharMonte(s, acao.cadeira, acao.bits);
      break;
    case 'passarCorte':
      passarCorte(s, acao.cadeira);
      break;
    case 'cortar':
      cortar(s, acao.cadeira, acao.ponto);
      break;
    case 'devolver':
      devolver(s, acao.cadeira);
      break;
    case 'abrir3':
    case 'dar3':
      cortarDe3(s, acao.cadeira, acao.tipo);
      break;
    case 'distribuir':
      distribuir(s, acao.cadeira, acao.modo);
      break;
    case 'jogar':
      jogar(s, acao.cadeira, acao.indice, acao.coberta ?? false);
      break;
    case 'empilhar':
      empilhar(s, acao.cadeira, acao.indice);
      break;
    case 'mostrar':
      mostrar(s, acao.cadeira);
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
    case 'conferir':
      conferirFamilia(s, acao.cadeira, acao.conferir);
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
  return tipoPeloPlacar(s.placar, s.regras);
}

function novoRitual(pe: Cadeira): EstadoRitual {
  return { embaralhador: pe, cortador: ((pe + 3) % 4) as Cadeira, embaralhadas: 0, movimentos: 0, abertas: [], dadas: null };
}

function comecarRitual(s: EstadoPartida): void {
  s.ritual = novoRitual(s.pe);
  s.fase = 'embaralhando';
}

function ritualAtual(s: EstadoPartida): EstadoRitual {
  if (!s.ritual) falha('não há ritual em andamento');
  return s.ritual;
}

function porMonte(s: EstadoPartida, baralho: Carta[]): void {
  if (s.fase !== 'aguardandoMonte') falha('o monte já está na mesa');
  validarBaralho(baralho, s.regras);
  s.monte = baralho.map((c) => ({ ...c }));
  comecarRitual(s);
}

function gastarMovimento(s: EstadoPartida, r: EstadoRitual): void {
  r.movimentos++;
  if (r.movimentos >= MOVIMENTOS_CORTE) s.fase = 'escolhendoDistribuicao';
}

function embaralharMonte(s: EstadoPartida, cadeira: Cadeira, bits: (0 | 1)[] | undefined): void {
  if (s.fase !== 'embaralhando' && s.fase !== 'cortando') falha('não é hora de embaralhar');
  const r = ritualAtual(s);
  if (s.fase === 'embaralhando' && cadeira !== r.embaralhador) falha('só quem dá as cartas embaralha');
  if (s.fase === 'cortando' && cadeira !== r.cortador) falha('agora quem mexe no monte é quem corta');
  if (s.fase === 'embaralhando' && r.embaralhadas >= LIMITE_EMBARALHADAS) falha('já embaralhou demais');
  if (bits === undefined) falha('embaralhar precisa da sorte do servidor');
  if (bits.length !== s.monte.length) falha('sorte do embaralho com tamanho errado');
  s.monte = riffle(s.monte, bits);
  if (s.fase === 'embaralhando') r.embaralhadas++;
  else gastarMovimento(s, r);
}

function passarCorte(s: EstadoPartida, cadeira: Cadeira): void {
  if (s.fase !== 'embaralhando') falha('não é hora de passar pra cortar');
  const r = ritualAtual(s);
  if (cadeira !== r.embaralhador) falha('só quem embaralha passa o monte');
  s.fase = 'cortando';
}

function exigirCortador(s: EstadoPartida, cadeira: Cadeira): EstadoRitual {
  if (s.fase !== 'cortando') falha('não é hora de cortar');
  const r = ritualAtual(s);
  if (cadeira !== r.cortador) falha('não é você quem corta');
  return r;
}

function cortar(s: EstadoPartida, cadeira: Cadeira, ponto: number | undefined): void {
  const r = exigirCortador(s, cadeira);
  if (ponto === undefined) falha('cortar precisa da sorte do servidor');
  const [min, max] = limitesCorte(s.monte.length);
  if (!Number.isInteger(ponto) || ponto < min || ponto > max) falha('ponto de corte inválido');
  s.monte = cortarMonte(s.monte, ponto);
  gastarMovimento(s, r);
}

function devolver(s: EstadoPartida, cadeira: Cadeira): void {
  exigirCortador(s, cadeira);
  s.fase = 'escolhendoDistribuicao';
}

/** Abrir 3 / dar 3: gastam os 3 movimentos de uma vez (só como primeiro movimento) e encerram o corte. */
function cortarDe3(s: EstadoPartida, cadeira: Cadeira, tipo: 'abrir3' | 'dar3'): void {
  const r = exigirCortador(s, cadeira);
  if (r.movimentos > 0) falha(`${tipo === 'abrir3' ? 'abrir' : 'dar'} 3 gasta os 3 movimentos: só no começo do corte`);
  const tres = s.monte.splice(0, 3);
  if (tipo === 'abrir3') r.abertas = tres;
  else r.dadas = { cadeira: parceiroDe(cadeira), cartas: tres };
  r.movimentos = MOVIMENTOS_CORTE;
  s.fase = 'escolhendoDistribuicao';
}

function distribuir(s: EstadoPartida, cadeira: Cadeira, modo: ModoDistribuicao): void {
  if (s.fase !== 'escolhendoDistribuicao') falha('não é hora de distribuir');
  const r = ritualAtual(s);
  if (cadeira !== r.embaralhador) falha('só quem embaralhou dá as cartas');
  const pulada = r.dadas?.cadeira ?? null;
  const dadas = darCartas(s.monte, ordemDistribuicao(s.pe, pulada), modo, s.regras.variante === 'paulista');
  if (r.dadas) dadas.maos[r.dadas.cadeira] = r.dadas.cartas;
  s.monte = dadas.resto;
  const tipo = tipoDaMao(s);
  const mao: EstadoMao = {
    tipo,
    vira: dadas.vira,
    maos: dadas.maos,
    mesa: [],
    rodadasJogadas: [],
    rodadas: [],
    vez: proximaCadeira(s.pe),
    // Mão de 11 já começa valendo truco (3 pontos na escada paulista).
    nivel: tipo === 'mao11' ? 1 : 0,
    ultimoAumento: null,
    trucoPendente: null,
    duplaNoDez: tipo === 'mao10' ? (s.placar[0] === limiteMaoEspecial(s.regras.pontuacao) ? 0 : 1) : null,
    modo,
    pulada,
    abertasNoCorte: r.abertas,
    familias: [],
    familiaPendente: null,
    cangada: null,
  };
  s.mao = mao;
  s.ritual = null;
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
  s.monte = [...recolher(m), ...s.monte];
  s.mao = null;
  if (vencedor !== null && s.placar[vencedor] >= PONTOS_VITORIA) {
    s.vencedor = vencedor;
    s.fase = 'fimPartida';
    return;
  }
  s.pe = proximaCadeira(s.pe);
  comecarRitual(s);
}

function maoAtual(s: EstadoPartida): EstadoMao {
  if (!s.mao) falha('nenhuma mão em andamento');
  return s.mao;
}

function jogar(s: EstadoPartida, cadeira: Cadeira, indice: number, coberta: boolean): void {
  const m = maoAtual(s);
  if (s.fase !== 'jogando') falha('não é hora de jogar carta');
  if (m.vez !== cadeira) falha('não é sua vez');
  if (m.cangada) falha('cangou: as cartas saem empilhadas, mande mostrar');
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

  if (m.mesa.length < 4) {
    m.vez = proximaCadeira(cadeira);
    return;
  }
  fecharRodada(s, m);
}

/** Rodada com as 4 cartas: resolve, e a mão segue, cangou na 1ª (todos empilham) ou acabou. */
function fecharRodada(s: EstadoPartida, m: EstadoMao): void {
  const rodada = m.mesa;
  const { resultado, proximo } = resolverRodada(rodada);
  m.rodadas.push(resultado);
  m.rodadasJogadas.push(m.mesa);
  m.mesa = [];
  const v = vencedorMao(m.rodadas);
  if (v !== 'continua') {
    finalizarMao(s, v, escada(s)[m.nivel], 'rodadas');
    return;
  }
  m.vez = proximo;
  if (m.cangada) {
    // Cangou de novo nas de cima: abre as de baixo quem igualou agora.
    m.cangada.etapa = 'baixo';
    m.vez = quemCangou(rodada);
    return;
  }
  // Cangou a 1ª: cada um junta as 2 que sobraram e escolhe a de cima (na mão de ferro ninguém vê as cartas: segue normal).
  // Quem cangou (igualou a mais forte) abre primeiro.
  if (m.rodadas.length === 1 && resultado === 'empate' && m.tipo !== 'mao11') {
    m.cangada = { etapa: 'empilhando', empilhou: [false, false, false, false] };
    m.vez = quemCangou(rodada);
    s.fase = 'empilhando';
  }
}

function empilhar(s: EstadoPartida, cadeira: Cadeira, indice: number): void {
  const m = maoAtual(s);
  if (s.fase !== 'empilhando' || !m.cangada) falha('não é hora de empilhar');
  if (m.cangada.empilhou[cadeira]) falha('você já empilhou');
  const mao = m.maos[cadeira];
  if (!Number.isInteger(indice) || indice < 0 || indice >= mao.length) falha('carta inválida');
  const [cima] = mao.splice(indice, 1);
  mao.unshift(cima);
  m.cangada.empilhou[cadeira] = true;
  if (!m.cangada.empilhou.every(Boolean)) return;
  s.fase = 'jogando';
  if (s.regras.variante !== 'mineiro') {
    m.cangada.etapa = 'cima';
    return;
  }
  // Mineiro: as 4 de cima viram juntas, à mostra e sem valor (uma rodada cangada, a 2ª); a de
  // baixo decide, aberta uma por vez a partir de quem cangou (a vez, que não muda).
  const ordem = [0, 1, 2, 3].map((i) => ((m.vez + i) % 4) as Cadeira);
  m.rodadasJogadas.push(
    ordem.map((c) => {
      const carta = m.maos[c].shift()!;
      return { cadeira: c, carta, coberta: false, forca: forca(carta, s.regras.variante, m.vira) };
    }),
  );
  m.rodadas.push('empate');
  m.cangada.etapa = 'baixo';
}

/**
 * Cangada: a vez mostra a carta de cima da própria pilha (ou, cangada de novo, a de baixo), uma
 * de cada vez. Entre uma e outra, quem está na vez pode trucar antes de mostrar (no blefe).
 */
function mostrar(s: EstadoPartida, cadeira: Cadeira): void {
  const m = maoAtual(s);
  if (s.fase !== 'jogando' || !m.cangada || m.cangada.etapa === 'empilhando') falha('não há cartas empilhadas para mostrar');
  if (m.vez !== cadeira) falha('quem mostra é a vez');
  const carta = m.maos[cadeira].shift();
  if (!carta) falha('mão vazia na cangada');
  m.mesa.push({ cadeira, carta, coberta: false, forca: forca(carta, s.regras.variante, m.vira) });
  if (m.mesa.length < 4) {
    m.vez = proximaCadeira(cadeira);
    return;
  }
  fecharRodada(s, m);
}

/** Quem igualou a carta mais forte de uma rodada empatada: o último a jogá-la. */
function quemCangou(rodada: readonly { cadeira: Cadeira; forca: number }[]): Cadeira {
  const max = Math.max(...rodada.map((j) => j.forca));
  return rodada.filter((j) => j.forca === max).at(-1)!.cadeira;
}

function pedirTruco(s: EstadoPartida, cadeira: Cadeira): void {
  const m = maoAtual(s);
  if (s.fase !== 'jogando') falha('não é hora de trucar');
  if (m.vez !== cadeira) falha('só pode trucar na sua vez');
  // Mão de 11 (ou de ferro) já é trucada: pedir truco nela é falta e o adversário leva a mão.
  if (m.tipo !== 'normal') {
    finalizarMao(s, (1 - duplaDe(cadeira)) as Dupla, escada(s)[Math.max(m.nivel, 1)], 'trucoNaMaoEspecial');
    return;
  }
  if (m.rodadas.length === 0) falha('truco só a partir da 2ª rodada');
  // Pontos de família no meio da mão podem ter levado o placar a 10/11: aí não se truca mais.
  if (tipoDaMao(s) !== 'normal') falha('não se truca nesta mão');
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
  if (dupla !== m.duplaNoDez) falha(`só a dupla com ${limiteMaoEspecial(s.regras.pontuacao)} decide`);
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
  if (!janelaDeFamilia(s)) falha('família só antes da 1ª carta, em mão normal');
  const tipo = tipoDaProximaFamilia(s)!;
  if (s.monte.length < 3) falha('o monte não tem cartas para repor a família');
  const mao = m.maos[cadeira];
  if (tipo === 'aberta' && !ehFamilia(mao)) falha('isso não é família');
  m.familias.push({ cadeira, tipo, cartas: mao.splice(0, mao.length), conferida: null });
  m.maos[cadeira] = s.monte.splice(0, 3);
  if (tipo === 'fechada') {
    m.familiaPendente = m.familias.length - 1;
    s.fase = 'conferindoFamilia';
  }
}

function conferirFamilia(s: EstadoPartida, cadeira: Cadeira, conferir: boolean): void {
  const m = maoAtual(s);
  if (s.fase !== 'conferindoFamilia' || m.familiaPendente === null) falha('não há família para conferir');
  const f = m.familias[m.familiaPendente];
  if (duplaDe(cadeira) === duplaDe(f.cadeira)) falha('só a dupla adversária confere');
  m.familiaPendente = null;
  s.fase = 'jogando';
  if (!conferir) return;
  const real = ehFamilia(f.cartas);
  f.conferida = { por: cadeira, real };
  pontuarFamilia(s, real ? duplaDe(f.cadeira) : duplaDe(cadeira));
}

/** Valor base da mão para a dupla; se fechar a partida, encerra pela via normal (recolhe tudo). */
function pontuarFamilia(s: EstadoPartida, dupla: Dupla): void {
  const base = escada(s)[0];
  if (s.placar[dupla] + base >= PONTOS_VITORIA) {
    finalizarMao(s, dupla, base, 'familia');
    return;
  }
  s.placar[dupla] += base;
}
