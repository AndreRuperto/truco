export type Variante = 'paulista' | 'mineiro';
export type Pontuacao = '1-3-6-9-12' | '2-4-8-10-12';

export interface RegrasMesa {
  variante: Variante;
  pontuacao: Pontuacao;
  /** Dupla com 10 vê as cartas do parceiro e decide jogar ou correr. */
  maoDe10: boolean;
  /** Mão de ferro: todos jogam às cegas, sem truco. */
  maoDe11: 'off' | 'qualquerDupla' | 'onzeAOnze';
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
    maoDe10: false,
    maoDe11: 'qualquerDupla',
    familia: 'off',
    maoLimpa: false,
  }),
  mineiro: Object.freeze({
    variante: 'mineiro',
    pontuacao: '2-4-8-10-12',
    maoDe10: true,
    maoDe11: 'off',
    familia: 'fechada',
    maoLimpa: false,
  }),
});
