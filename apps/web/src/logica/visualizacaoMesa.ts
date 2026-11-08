/** Vista escolhida por aparelho; não interfere nas cartas nem nas regras da partida. */
export type VisualizacaoMesa = 'personagens' | 'cadeiras' | '3d';
export const CHAVE_VISUALIZACAO_MESA = 'truco:visualizacao-mesa';
/** Mantida para quem já tinha ativado a vista 3D nas versões anteriores. */
export const CHAVE_VISTA_3D = 'truco:vista3d';

export function lerVisualizacaoMesa(): VisualizacaoMesa {
  try {
    const valor = localStorage.getItem(CHAVE_VISUALIZACAO_MESA);
    if (valor === 'personagens' || valor === 'cadeiras' || valor === '3d') return valor;
    return localStorage.getItem(CHAVE_VISTA_3D) === '1' ? '3d' : 'personagens';
  } catch {
    return 'personagens';
  }
}

export function gravarVisualizacaoMesa(valor: VisualizacaoMesa): void {
  try {
    localStorage.setItem(CHAVE_VISUALIZACAO_MESA, valor);
    // Compatibilidade com preferências anteriores do botão 3D.
    localStorage.setItem(CHAVE_VISTA_3D, valor === '3d' ? '1' : '0');
  } catch {
    // Sem armazenamento: a escolha continua válida enquanto o componente existir.
  }
}
