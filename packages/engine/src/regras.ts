export type Variante = 'paulista' | 'mineiro';
export type Pontuacao = '1-3-6-9-12' | '2-4-8-10-12';

export interface RegrasMesa {
  variante: Variante;
  pontuacao: Pontuacao;
  /**
   * Mão de 11 (de 10 na escala 2-4-8-10-12): só uma dupla no limite (`limiteMaoEspecial`) vê as
   * cartas do parceiro e decide jogar (a mão já vale truco) ou correr (o adversário ganha o valor
   * inicial). O nome do campo é antigo: vale para o limite da escala, não só para o 10.
   */
  maoDe10: boolean;
  /** Mão de ferro: as duas duplas no limite (11 a 11; 10 a 10 na escala de 2 em 2), todos às cegas. */
  maoDe11: 'off' | 'onzeAOnze';
  familia: 'off' | 'aberta' | 'fechada';
  /** Mão limpa (só no mineiro): sem 4 a 7 comuns, com 2 coringas. Ver `baralhoDaMesa`. */
  maoLimpa: boolean;
}

/** Valor da mão por nível de aposta: [mão, truco, seis, nove, doze]. */
export const ESCADAS: Readonly<Record<Pontuacao, readonly number[]>> = Object.freeze({
  '1-3-6-9-12': Object.freeze([1, 3, 6, 9, 12]),
  '2-4-8-10-12': Object.freeze([2, 4, 8, 10, 12]),
});

export const NIVEL_MAXIMO = 4;
export const PONTOS_VITORIA = 12;

export const REGRAS_RANQUEADA: Readonly<Record<Variante, Readonly<RegrasMesa>>> = Object.freeze({
  paulista: Object.freeze({
    variante: 'paulista',
    pontuacao: '1-3-6-9-12',
    maoDe10: true,
    maoDe11: 'onzeAOnze',
    familia: 'off',
    maoLimpa: false,
  }),
  mineiro: Object.freeze({
    variante: 'mineiro',
    pontuacao: '2-4-8-10-12',
    maoDe10: true,
    maoDe11: 'onzeAOnze',
    familia: 'fechada',
    maoLimpa: false,
  }),
});

/** Placar da mão especial: 11 na escala 1-3-6-9-12; 10 na de 2 em 2 (a próxima vitória fecha o jogo). */
export function limiteMaoEspecial(pontuacao: Pontuacao): number {
  return pontuacao === '2-4-8-10-12' ? 10 : 11;
}

/**
 * Tipo de mão que o placar `[a, b]` pede. Internamente, `mao10` é a mão de decisão (só uma dupla
 * no limite) e `mao11` a mão de ferro (as duas no limite). Serve na distribuição e no meio da mão
 * (pontos de família podem levar ao limite antes da 1ª carta).
 */
export function tipoPeloPlacar(
  placar: readonly [number, number],
  regras: Pick<RegrasMesa, 'maoDe10' | 'maoDe11' | 'pontuacao'>,
): 'normal' | 'mao10' | 'mao11' {
  const [a, b] = placar;
  const limite = limiteMaoEspecial(regras.pontuacao);
  if (a === limite && b === limite) return regras.maoDe11 === 'onzeAOnze' ? 'mao11' : 'normal';
  if (regras.maoDe10 && (a === limite) !== (b === limite)) return 'mao10';
  return 'normal';
}
