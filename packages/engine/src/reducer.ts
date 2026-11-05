import type { Carta } from './cartas';
import {
  type Acao,
  type Cadeira,
  type Dupla,
  type EstadoMao,
  type EstadoPartida,
  type ResultadoMao,
  type TipoMao,
  proximaCadeira,
} from './estado';
import { ESCADAS, PONTOS_VITORIA } from './regras';

export class ErroJogada extends Error {}

function falha(msg: string): never {
  throw new ErroJogada(msg);
}

export function reduce(estado: EstadoPartida, acao: Acao): EstadoPartida {
  const s = structuredClone(estado);
  switch (acao.tipo) {
    case 'distribuir':
      distribuir(s, acao.baralho);
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
