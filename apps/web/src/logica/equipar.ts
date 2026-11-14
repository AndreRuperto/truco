import type { ItemLoja, Slot, VisualTampo } from '@truco/api';
import { type AparenciaMesa, salvarAparenciaMesa } from './aparenciaMesa';

/**
 * Equipa um item na conta (loja e perfil usam a mesma regra). O de série volta a ser "nada equipado"
 * (null), menos a mesa, que é guardada pelo id. A mesa é desenhada só na sua tela: guarda também no aparelho.
 */
export async function equiparNaConta(api: { loja: { equipar: (slot: Slot, itemId: string | null) => Promise<void> } }, item: ItemLoja): Promise<void> {
  await api.loja.equipar(item.slot, item.preco === null && item.slot !== 'tampo' ? null : item.id);
  if (item.slot === 'tampo') salvarAparenciaMesa((item.visual as VisualTampo).superficie as AparenciaMesa);
}
