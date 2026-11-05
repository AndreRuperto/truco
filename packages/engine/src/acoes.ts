import type { Acao, Cadeira, EstadoPartida } from './estado';
import { ErroJogada, reduce } from './reducer';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

function candidatas(cadeira: Cadeira): Acao[] {
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

/** Todas as ações legais (exceto distribuir). Opcionalmente filtra por cadeira. */
export function acoesValidas(s: EstadoPartida, cadeira?: Cadeira): Acao[] {
  const cadeiras = cadeira === undefined ? CADEIRAS : [cadeira];
  return cadeiras.flatMap(candidatas).filter((a) => {
    try {
      reduce(s, a);
      return true;
    } catch (e) {
      if (e instanceof ErroJogada) return false;
      throw e;
    }
  });
}
