import type { MsgEstado } from '@truco/protocolo';
import { placarRelativo } from './textos';

/**
 * Depois de uma queda de conexão: o que aconteceu enquanto o jogador esteve fora, numa frase só
 * (a mais importante), comparando o último estado visto com o novo. null = nada que valha contar.
 * Quem cai tem o prazo normal; quando ele acaba, o servidor faz a ação padrão (Mesa.ts).
 */
export function resumoDaVolta(antes: MsgEstado, depois: MsgEstado): string | null {
  const a = antes.visao;
  const d = depois.visao;
  if (!a || !d) return null;
  if (d.fase === 'fimPartida' && a.fase !== 'fimPartida') return 'A partida terminou enquanto você esteve fora.';
  const pa = placarRelativo(a);
  const pd = placarRelativo(d);
  if (pa.nos !== pd.nos || pa.eles !== pd.eles) {
    return `Enquanto você esteve fora: Nós ${pa.nos} → ${pd.nos}, Eles ${pa.eles} → ${pd.eles}.`;
  }
  // Mesmo placar e mão ainda em curso: cartas a menos na sua mão foram jogadas pelo prazo.
  const jogadas = (a.mao?.minhaMao.length ?? 0) - (d.mao?.minhaMao.length ?? 0);
  if (a.mao && d.mao && jogadas > 0) {
    return `Enquanto você esteve fora, o prazo da sua vez acabou e ${jogadas} ${jogadas === 1 ? 'carta foi jogada' : 'cartas foram jogadas'} por você.`;
  }
  return null;
}
