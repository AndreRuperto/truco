/**
 * Aparência individual da mesa. Não entra em regras/estado do servidor:
 * cada jogador pode ver um acabamento diferente sem afetar as cartas.
 *
 * O feltro é uma PRÉVIA de um futuro item Premium para contas.
 * Não existe cobrança ou assinatura no projeto nesta fase.
 */
export type AparenciaMesa = 'madeira' | 'feltro' | 'plastico' | 'marmore' | 'formica';

/** Tampos vendidos na loja: só aparecem para quem tem o item. */
export const TAMPOS_DA_LOJA: Partial<Record<AparenciaMesa, string>> = { marmore: 'tampo-marmore', formica: 'tampo-formica' };
const VALIDAS: readonly AparenciaMesa[] = ['madeira', 'feltro', 'plastico', 'marmore', 'formica'];

export const CHAVE_APARENCIA_MESA = 'truco:aparencia-mesa';

export function lerAparenciaMesa(): AparenciaMesa {
  try {
    const valor = localStorage.getItem(CHAVE_APARENCIA_MESA);
    return (VALIDAS as readonly (string | null)[]).includes(valor) ? (valor as AparenciaMesa) : 'madeira';
  } catch {
    return 'madeira';
  }
}

/** Sem conta: feltro bloqueado. Tampo da loja: só com o item no inventário. */
export function aparenciaPermitida(escolhida: AparenciaMesa, temConta: boolean, inventario: readonly string[] = []): AparenciaMesa {
  if (escolhida === 'feltro' && !temConta) return 'madeira';
  const item = TAMPOS_DA_LOJA[escolhida];
  if (item && (!temConta || !inventario.includes(item))) return 'madeira';
  return escolhida;
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
