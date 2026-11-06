import type { AcaoJogador, Cadeira, EstadoPartida, Fase } from './estado';
import { ErroJogada, reduce } from './reducer';
import { completarSorte } from './ritual';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

function candidatas(cadeira: Cadeira): AcaoJogador[] {
  return [
    { tipo: 'jogar', cadeira, indice: 0 },
    { tipo: 'jogar', cadeira, indice: 1 },
    { tipo: 'jogar', cadeira, indice: 2 },
    { tipo: 'jogar', cadeira, indice: 0, coberta: true },
    { tipo: 'jogar', cadeira, indice: 1, coberta: true },
    { tipo: 'jogar', cadeira, indice: 2, coberta: true },
    { tipo: 'truco', cadeira },
    { tipo: 'aceitar', cadeira },
    { tipo: 'correr', cadeira },
    { tipo: 'aumentar', cadeira },
    { tipo: 'familia', cadeira },
    { tipo: 'mao10', cadeira, jogar: true },
    { tipo: 'mao10', cadeira, jogar: false },
    { tipo: 'embaralhar', cadeira },
    { tipo: 'passarCorte', cadeira },
    { tipo: 'cortar', cadeira },
    { tipo: 'abrir3', cadeira },
    { tipo: 'dar3', cadeira },
    { tipo: 'devolver', cadeira },
    { tipo: 'distribuir', cadeira, modo: 'porCima' },
    { tipo: 'distribuir', cadeira, modo: 'porBaixo' },
    { tipo: 'distribuir', cadeira, modo: 'subindo' },
    { tipo: 'conferir', cadeira, conferir: true },
    { tipo: 'conferir', cadeira, conferir: false },
  ];
}

/**
 * Tipos que o `reduce` pode aceitar em cada fase (as demais falham logo na checagem de fase).
 * Só um atalho de desempenho: a legalidade de verdade continua sendo decidida pelo `reduce`.
 */
const TIPOS_DA_FASE: Record<Fase, readonly AcaoJogador['tipo'][]> = {
  aguardandoMonte: [],
  embaralhando: ['embaralhar', 'passarCorte'],
  cortando: ['embaralhar', 'cortar', 'abrir3', 'dar3', 'devolver'],
  escolhendoDistribuicao: ['distribuir'],
  decisaoMao10: ['mao10'],
  jogando: ['jogar', 'truco', 'familia'],
  respondendoTruco: ['aceitar', 'correr', 'aumentar'],
  conferindoFamilia: ['conferir'],
  fimPartida: [],
};

/** Testa cada candidata; embaralhar/cortar são testados com uma sorte qualquer e devolvidos sem ela. */
function legais(s: EstadoPartida, acoes: AcaoJogador[]): AcaoJogador[] {
  const daFase = TIPOS_DA_FASE[s.fase];
  return acoes.filter((a) => {
    if (!daFase.includes(a.tipo)) return false;
    try {
      reduce(s, completarSorte(a, s, () => 0));
      return true;
    } catch (e) {
      if (e instanceof ErroJogada) return false;
      throw e;
    }
  });
}

/** Ações legais da cadeira informada (exceto monte). Seguro para enviar a esse jogador. */
export function acoesValidas(s: EstadoPartida, cadeira: Cadeira): AcaoJogador[] {
  if (!CADEIRAS.includes(cadeira)) throw new ErroJogada('cadeira inválida');
  return legais(s, candidatas(cadeira));
}

/**
 * Ações legais de todas as cadeiras (exceto monte).
 *
 * ATENÇÃO: server/test only — never send to clients. Revela, por exemplo,
 * quem tem família ou quantas cartas cada um pode jogar.
 */
export function todasAcoesValidas(s: EstadoPartida): AcaoJogador[] {
  return legais(s, CADEIRAS.flatMap(candidatas));
}
