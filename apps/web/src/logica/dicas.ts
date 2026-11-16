import { FORCA_MANILHA_MIN, forca, limiteMaoEspecial, type Visao } from '@truco/engine';
import type { MsgEstado } from '@truco/protocolo';
import type { AcoesUI } from './acoes';
import { rotuloCarta } from './cartas';

/** Dicas da primeira partida: cada uma aparece uma vez, na hora em que faz sentido. */
export type IdDica = 'ritual' | 'familia' | 'primeira-carta' | 'manilha' | 'truco' | 'responder' | 'cangada' | 'mao10' | 'conferir';

export interface Dica {
  id: IdDica;
  texto: string;
}

export const CHAVE_DICAS = 'truco:dicas';

interface Guardado {
  vistas: IdDica[];
  desligadas: boolean;
}

export function lerDicas(): Guardado {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE_DICAS) ?? 'null') as Partial<Guardado> | null;
    return { vistas: Array.isArray(g?.vistas) ? g.vistas : [], desligadas: g?.desligadas === true };
  } catch {
    return { vistas: [], desligadas: false };
  }
}

export function gravarDicas(g: Guardado): void {
  try {
    localStorage.setItem(CHAVE_DICAS, JSON.stringify(g));
  } catch {
    // modo privado: vale só nesta visita
  }
}

/**
 * A dica para agora (a primeira ainda não vista que se aplica), ou null. Ordem = prioridade:
 * o que pede decisão imediata primeiro.
 */
export function dicaAgora(msg: MsgEstado, ui: AcoesUI, vistas: readonly IdDica[]): Dica | null {
  const v: Visao | null = msg.visao;
  if (!v) return null;
  const m = v.mao;
  const tem = (t: string) => msg.minhasAcoes.some((a) => a.tipo === t);
  const candidatas: (Dica | null)[] = [
    v.fase === 'decisaoMao10' && tem('mao10')
      ? {
          id: 'mao10',
          texto: `Mão de ${limiteMaoEspecial(v.regras.pontuacao)}: vocês veem as cartas do parceiro e decidem. Jogar vale truco (3 ou 4); correr dá ao adversário o valor inicial da mão. Ela já é trucada: quem pedir truco entrega a mão.`,
        }
      : null,
    v.fase === 'conferindoFamilia' && tem('conferir')
      ? { id: 'conferir', texto: 'Pediram família fechada, que pode ser blefe. Conferir: se era família, eles pontuam; se era blefe, vocês pontuam. Deixar passar: ninguém pontua.' }
      : null,
    v.fase === 'respondendoTruco' && tem('aceitar')
      ? { id: 'responder', texto: 'Pediram truco! Aceitar: a mão passa a valer mais. Aumentar: você sobe a aposta. Correr: eles levam o que a mão valia antes.' }
      : null,
    ui.empilhaveis.length > 0
      ? {
          id: 'cangada',
          texto:
            v.regras.variante === 'mineiro'
              ? 'Cangou (a 1ª rodada empatou)! Toque na carta que vai por cima: ela fica à mostra e não vale. Quem decide é a de baixo, aberta uma por vez.'
              : 'Cangou (a 1ª rodada empatou)! Toque na carta que vai por cima: ela decide a 2ª. A de baixo só abre se cangar de novo.',
        }
      : null,
    msg.janelaFamilia && !msg.janelaFamilia.decidiram.includes(msg.minhaCadeira)
      ? { id: 'familia', texto: 'Família é mão só de Q, J, K e Ás. Tem? Peça e troque as cartas. Não tem? Toque em "Sem família" para o jogo seguir.' }
      : null,
    ui.botoes.some((b) => b.chave === 'truco')
      ? { id: 'truco', texto: 'Já dá para pedir truco: a mão passa a valer 3 (ou 4 no mineiro). Se correrem, vocês levam o que ela valia.' }
      : null,
    m && ui.jogaveis.length > 0 && m.minhaMao.some((c) => c && forca(c, v.regras.variante, m.vira) >= FORCA_MANILHA_MIN)
      ? {
          id: 'manilha',
          texto: `Você tem manilha: ${m.minhaMao
            .filter((c) => c && forca(c, v.regras.variante, m.vira) >= FORCA_MANILHA_MIN)
            .map((c) => rotuloCarta(c!, v.regras.variante, m.vira))
            .join(' e ')}. Manilha ganha de qualquer carta comum. O botão Ordem mostra a escada inteira.`,
        }
      : null,
    m && ui.jogaveis.length > 0 && m.rodadas.length === 0
      ? { id: 'primeira-carta', texto: 'Sua vez: toque numa carta para jogar. A mais forte da rodada leva, e quem fizer 2 rodadas ganha a mão.' }
      : null,
    tem('embaralhar')
      ? { id: 'ritual', texto: 'Você dá as cartas: embaralhe quantas vezes quiser e passe para cortar. Quem corta pode até abrir ou dar 3 cartas.' }
      : null,
  ];
  return candidatas.find((d): d is Dica => d !== null && !vistas.includes(d.id)) ?? null;
}
