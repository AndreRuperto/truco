import { type Cadeira, duplaDe, type Visao } from '@truco/engine';
import type { MsgAcao } from '@truco/protocolo';
import { PASSO_DADA, PASSO_DADA_UMA } from '../componentes/animacaoMesa';
import { passosDistribuicao } from '../logica/ritual';
import type { NomeSom } from './sintese';

export interface SomAgendado {
  nome: NomeSom;
  /** Segundos a partir de agora. */
  atraso: number;
}

/** Som de cada ação que chega do servidor (a distribuição vira um "tec" por carta, no ritmo da animação). */
export function sonsDaAcao(a: MsgAcao, minha: Cadeira): SomAgendado[] {
  switch (a.tipo) {
    case 'jogar':
      return [{ nome: 'carta', atraso: 0 }];
    case 'mostrar':
      return [0, 0.06, 0.12, 0.18].map((atraso) => ({ nome: 'carta', atraso }));
    case 'embaralhar':
      return [{ nome: 'embaralhar', atraso: 0 }];
    case 'cortar':
    case 'abrir3':
    case 'dar3':
      return [{ nome: 'corte', atraso: 0 }];
    case 'distribuir': {
      let t = 0;
      return passosDistribuicao(a, minha).map((p) => {
        const s = { nome: 'carta' as const, atraso: t / 1000 };
        t += p.qtd === 1 ? PASSO_DADA_UMA : PASSO_DADA;
        return s;
      });
    }
    case 'truco':
    case 'aumentar':
      return [{ nome: 'truco', atraso: 0 }];
    case 'aceitar':
      return [{ nome: 'aceito', atraso: 0 }];
    case 'correr':
      return [{ nome: 'corre', atraso: 0 }];
    case 'familia':
      return [{ nome: 'familia', atraso: 0 }];
    default:
      return [];
  }
}

/** Identidade da mão que acabou (para saber se é uma nova). */
const chaveMao = (v: Visao | null) => {
  const u = v?.ultimaMao;
  return u ? `${v!.placar.join('-')}|${u.rodadas.join(',')}|${u.pontos}|${u.motivo}` : null;
};

/** Sons que saem da mudança de estado: rodada, mão e partida decididas (sempre do meu lado da mesa). */
export function sonsDoEstado(antes: Visao | null, depois: Visao, minha: Cadeira): SomAgendado[] {
  if (!antes) return [];
  const nos = duplaDe(minha);
  if (depois.fase === 'fimPartida' && antes.fase !== 'fimPartida') {
    return [{ nome: depois.vencedor === nos ? 'vitoria' : 'derrota', atraso: 0.3 }];
  }
  const k = chaveMao(depois);
  if (k !== null && k !== chaveMao(antes)) {
    const v = depois.ultimaMao!.vencedor;
    if (v === null) return [{ nome: 'cangou', atraso: 0.25 }];
    return [{ nome: v === nos ? 'maoNossa' : 'maoDeles', atraso: 0.25 }];
  }
  const ra = antes.mao?.rodadas ?? [];
  const rd = depois.mao?.rodadas ?? [];
  if (depois.mao && rd.length > ra.length) {
    const r = rd.at(-1)!;
    return [{ nome: r === 'empate' ? 'cangou' : r === nos ? 'rodadaNossa' : 'rodadaDeles', atraso: 0.2 }];
  }
  return [];
}
