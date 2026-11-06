import { baralhoDaMesa, type Carta, ehCoringa, FORCA_CORINGA, FORCA_MANILHA_MIN, forca, type RegrasMesa, type Valor, VALORES } from '@truco/engine';

/*
 * Guia da ordem das cartas: da mais forte para a mais fraca, com as cartas da minha mão
 * marcadas. Não diz nomes (Zap, Espadilha...): mostra a carta e a posição, e quem joga
 * aprende qual é qual.
 */

export type GrupoOrdem = 'manilha' | 'coringa' | 'comum';

export interface DegrauOrdem {
  forca: number;
  grupo: GrupoOrdem;
  valor: Valor;
  /** Naipe só quando o degrau é uma carta só (manilha); nas comuns o naipe não conta. */
  naipe: Carta['naipe'] | null;
  /** Quantas cartas da minha mão estão neste degrau. */
  minhas: number;
}

export interface Ordem {
  degraus: DegrauOrdem[];
  /** Paulista antes da vira: as manilhas ainda não existem (vêm da carta seguinte à vira). */
  manilhasPendentes: boolean;
}

export function ordemDasCartas(
  regras: Pick<RegrasMesa, 'variante' | 'maoLimpa'>,
  vira: Carta | null,
  mao: readonly (Carta | null)[],
): Ordem {
  const manilhasPendentes = regras.variante === 'paulista' && !vira;
  // Sem vira no paulista, a força das comuns é a mesma de sempre: conta como mineiro sem manilhas.
  const f = (c: Carta): number => (manilhasPendentes ? forcaSemManilha(c) : forca(c, regras.variante, vira));
  const porForca = new Map<number, Carta[]>();
  for (const c of baralhoDaMesa(regras)) {
    if (manilhasPendentes && f(c) >= FORCA_MANILHA_MIN) continue;
    porForca.set(f(c), [...(porForca.get(f(c)) ?? []), c]);
  }
  const contagem = new Map<number, number>();
  for (const c of mao) if (c) contagem.set(f(c), (contagem.get(f(c)) ?? 0) + 1);

  const degraus = [...porForca.entries()]
    .sort(([a], [b]) => b - a)
    .map(([forcaDegrau, cartas]): DegrauOrdem => {
      const grupo: GrupoOrdem = ehCoringa(cartas[0]) ? 'coringa' : forcaDegrau >= FORCA_MANILHA_MIN ? 'manilha' : 'comum';
      return {
        forca: forcaDegrau,
        grupo,
        valor: cartas[0].valor,
        naipe: grupo === 'manilha' ? cartas[0].naipe : null,
        minhas: contagem.get(forcaDegrau) ?? 0,
      };
    });
  return { degraus, manilhasPendentes };
}

/** Força das comuns (1 = 4 … 10 = 3), coringa 11; sem manilhas. */
function forcaSemManilha(c: Carta): number {
  if (ehCoringa(c)) return FORCA_CORINGA;
  return (VALORES as readonly string[]).indexOf(c.valor) + 1;
}
