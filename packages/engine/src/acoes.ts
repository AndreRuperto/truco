import type { AcaoJogador, Cadeira, EstadoPartida } from './estado';
import { ErroJogada, reduce } from './reducer';

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
  ];
}

function legais(s: EstadoPartida, acoes: AcaoJogador[]): AcaoJogador[] {
  return acoes.filter((a) => {
    try {
      reduce(s, a);
      return true;
    } catch (e) {
      if (e instanceof ErroJogada) return false;
      throw e;
    }
  });
}

/** Ações legais da cadeira informada (exceto distribuir). Seguro para enviar a esse jogador. */
export function acoesValidas(s: EstadoPartida, cadeira: Cadeira): AcaoJogador[] {
  if (!CADEIRAS.includes(cadeira)) throw new ErroJogada('cadeira inválida');
  return legais(s, candidatas(cadeira));
}

/**
 * Ações legais de todas as cadeiras (exceto distribuir).
 *
 * ATENÇÃO: server/test only — never send to clients. Revela, por exemplo,
 * quem tem família ou quantas cartas cada um pode jogar.
 */
export function todasAcoesValidas(s: EstadoPartida): AcaoJogador[] {
  return legais(s, CADEIRAS.flatMap(candidatas));
}
