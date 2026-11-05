import type { Carta } from './cartas';
import type { Fase, FamiliaPedida, TipoMao } from './estado';
import { type RegrasMesa, tipoPeloPlacar } from './regras';
import { LIMITE_FAMILIAS_FECHADAS } from './ritual';

const FIGURAS = new Set(['Q', 'J', 'K', 'A']);

/** Família: 3 cartas só de Q, J, K, A (inclusive A♠, se o jogador quiser). */
export function ehFamilia(mao: readonly Carta[]): boolean {
  return mao.length === 3 && mao.every((c) => FIGURAS.has(c.valor));
}

/** O mínimo para decidir sobre família: serve para `EstadoPartida` e para `Visao`. */
export interface SituacaoFamilia {
  regras: Pick<RegrasMesa, 'familia' | 'maoDe10' | 'maoDe11'>;
  placar: readonly [number, number];
  fase: Fase;
  mao: {
    tipo: TipoMao;
    rodadas: readonly unknown[];
    mesa: readonly unknown[];
    nivel: number;
    abertasNoCorte: readonly unknown[];
    familias: readonly Pick<FamiliaPedida, 'tipo'>[];
  } | null;
}

/** Fechadas já usadas na mão (o "abrir 3" do corte conta como uma). */
export function fechadasUsadas(m: NonNullable<SituacaoFamilia['mao']>): number {
  return m.familias.filter((f) => f.tipo === 'fechada').length + (m.abertasNoCorte.length > 0 ? 1 : 0);
}

/** Como sai o próximo pedido: mesa aberta → aberta; mesa fechada → fechada até o limite, depois aberta. */
export function tipoDaProximaFamilia(s: Pick<SituacaoFamilia, 'regras' | 'mao'>): 'fechada' | 'aberta' | null {
  if (!s.mao || s.regras.familia === 'off') return null;
  if (s.regras.familia === 'aberta') return 'aberta';
  return fechadasUsadas(s.mao) < LIMITE_FAMILIAS_FECHADAS ? 'fechada' : 'aberta';
}

/**
 * Janela: família ligada, mão normal (e o placar atual ainda pede mão normal: pontos de família
 * podem ter levado a 10/11 no meio da mão), nenhuma carta jogada e sem truco aceito.
 */
export function janelaDeFamilia(s: SituacaoFamilia): boolean {
  const m = s.mao;
  return (
    s.regras.familia !== 'off' &&
    s.fase === 'jogando' &&
    !!m &&
    m.tipo === 'normal' &&
    tipoPeloPlacar(s.placar, s.regras) === 'normal' &&
    m.rodadas.length === 0 &&
    m.mesa.length === 0 &&
    m.nivel === 0
  );
}
