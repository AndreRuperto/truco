import type { Cadeira, Visao } from '@truco/engine';
import type { InfoCadeira, MsgEstado } from '@truco/protocolo';
import type { Estado3D, Jogador3D } from '../componentes/mesa3d/tipos';
import type { Exibicao } from './jogadas';
import { cadeiraNaPosicao, type Posicao, posicaoRelativa } from './posicoes';
import { donoDoMonte } from './ritual';

const POSICOES: Posicao[] = ['baixo', 'direita', 'cima', 'esquerda'];
/** Pedidos de aposta: braço erguido e batida na mesa. */
const GRITOS = new Set(['TRUCO!', 'SEIS!', 'NOVE!', 'DOZE!']);

export interface EntradaMesa3D {
  visao: Visao;
  minha: Cadeira;
  cadeiras: InfoCadeira[];
  prazo: MsgEstado['prazo'];
  mesaFisica?: MsgEstado['mesaFisica'];
  /** Balões ativos por cadeira (`baloesAtivos`). */
  baloes: Map<Cadeira, string>;
  /** Centro com a rodada recolhida já limpa (`useRodadaNaMesa`). */
  exibicao: Exibicao;
  naPilha: number;
  agora: number;
}

/** O estado da partida, como a cena 3D precisa: tudo relativo a quem olha. */
export function estadoMesa3D(e: EntradaMesa3D): Estado3D {
  const { visao: v, minha } = e;
  const m = v.mao;
  const vez = new Set<Cadeira>(quemAge(v));
  const jogadores: Jogador3D[] = POSICOES.map((pos) => {
    const c = cadeiraNaPosicao(minha, pos);
    const info = e.cadeiras[c];
    const fala = e.baloes.get(c) ?? null;
    const temPrazo = e.prazo?.cadeiras.includes(c) ?? false;
    return {
      pos,
      nome: info?.nome ?? `Cadeira ${c + 1}`,
      qtdCartas: m ? (pos === 'baixo' ? m.minhaMao.length : (m.qtdCartas[c] ?? 0)) : 0,
      daVez: vez.has(c),
      segundos: temPrazo && e.prazo ? Math.max(0, Math.ceil((e.prazo.ate - e.agora) / 1000)) : null,
      fala,
      gritando: fala !== null && GRITOS.has(fala),
      caiu: !!info && !info.conectado,
      roupa: info?.visual?.roupa ?? null,
    };
  });
  const dono = donoDoMonte(v);
  return {
    jogadores,
    jogadas: e.exibicao.jogadas.map(({ chave, jogada }) => ({
      chave,
      pos: posicaoRelativa(minha, jogada.cadeira),
      carta: jogada.coberta ? null : jogada.carta,
    })),
    pilha: e.naPilha,
    vira: m?.vira ?? null,
    monte: v.qtdMonte > 0 && dono !== null ? { qtd: v.qtdMonte, pos: posicaoRelativa(minha, dono) } : null,
    plastico: e.mesaFisica?.tipo === 'plastico',
    // Como no 2D (telas/Mesa.tsx): o baralho é de quem dá as cartas, o pé.
    verso: (() => { const vv = e.cadeiras[v.pe]?.visual?.verso; return vv ? { cor: vv.cor, linha: vv.linha } : null; })(),
    variante: v.regras.variante,
  };
}

/** Quem é da vez para o anel: só na hora de jogar carta ou no ritual (uma cadeira). */
function quemAge(v: Visao): Cadeira[] {
  const m = v.mao;
  if (v.fase === 'jogando' && m) return [m.vez];
  const r = v.ritual;
  if (r && (v.fase === 'embaralhando' || v.fase === 'escolhendoDistribuicao')) return [r.embaralhador];
  if (r && v.fase === 'cortando') return [r.cortador];
  return [];
}
