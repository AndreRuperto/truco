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
}

/** Valor da mão por nível de aposta: [mão, truco, seis, nove, doze]. */
export const ESCADAS: Record<Pontuacao, readonly number[]> = {
  '1-3-6-9-12': [1, 3, 6, 9, 12],
  '2-4-8-10-12': [2, 4, 8, 10, 12],
};

export const NIVEL_MAXIMO = 4;
export const PONTOS_VITORIA = 12;

export const REGRAS_RANQUEADA: Record<Variante, RegrasMesa> = {
  paulista: {
    variante: 'paulista',
    pontuacao: '1-3-6-9-12',
    maoDe10: false,
    maoDe11: 'qualquerDupla',
    familia: 'off',
  },
  mineiro: {
    variante: 'mineiro',
    pontuacao: '2-4-8-10-12',
    maoDe10: true,
    maoDe11: 'off',
    familia: 'fechada',
  },
};
