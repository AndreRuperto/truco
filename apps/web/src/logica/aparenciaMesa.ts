/**
 * Aparência individual da mesa. Não entra em regras/estado do servidor:
 * cada jogador pode ver um acabamento diferente sem afetar as cartas.
 *
 * O feltro é uma PRÉVIA de um futuro item Premium para contas.
 * Não existe cobrança ou assinatura no projeto nesta fase.
 */
export type AparenciaMesa = 'madeira' | 'feltro' | 'plastico';

export const CHAVE_APARENCIA_MESA = 'truco:aparencia-mesa';

export function lerAparenciaMesa(): AparenciaMesa {
  try {
    const valor = localStorage.getItem(CHAVE_APARENCIA_MESA);
    return valor === 'feltro' || valor === 'plastico' ? valor : 'madeira';
  } catch {
    return 'madeira';
  }
}

/** Sem conta: feltro bloqueado, madeira e plástico disponíveis. */
export function aparenciaPermitida(escolhida: AparenciaMesa, temConta: boolean): AparenciaMesa {
  return escolhida === 'feltro' && !temConta ? 'madeira' : escolhida;
}

export function salvarAparenciaMesa(valor: AparenciaMesa): void {
  try {
    localStorage.setItem(CHAVE_APARENCIA_MESA, valor);
  } catch {
    // Sem armazenamento (janela privada etc.): funciona durante a sessão.
  }
}

/** Quebra física decidida pelo servidor sempre prevalece sobre a aparência local. */
export function superficieAtual(escolhida: AparenciaMesa, mesaQuebrada: boolean): AparenciaMesa {
  return mesaQuebrada ? 'plastico' : escolhida;
}
