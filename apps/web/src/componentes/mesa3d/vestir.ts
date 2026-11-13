import type { VisualRoupa } from '@truco/api';
import type { Visual } from './personagens';

/**
 * Roupa da loja sobre o visual 3D do personagem (equivalente ao `vestir` do 2D, em lojaItens.ts).
 * Puro e sem three.js: a cena chama ao criar o personagem. Só muda o que a roupa define.
 * - estampa: xadrez e listra viram as texturas da cena; regata não existe no 3D (fica a cor lisa).
 * - chapéu: palha → chapéu de palha; boné → boné na cor do item; feltro → boina na cor do item.
 */
export function vestir3D(base: Visual, roupa: VisualRoupa | null | undefined): Visual {
  if (!roupa) return base;
  const v: Visual = { ...base };
  if (roupa.estampa === 'xadrez') v.camisa = 'xadrez';
  else if (roupa.estampa === 'listra') v.camisa = 'listras';
  else if (roupa.camisa) v.camisa = roupa.camisa;
  if (roupa.chapeu === 'palha') v.estilo = 'palha';
  else if (roupa.chapeu === 'bone') v.estilo = 'bone';
  else if (roupa.chapeu === 'feltro') v.estilo = 'boina';
  if (roupa.chapeu && roupa.chapeu !== 'palha' && roupa.chapeuCor) v.bone = roupa.chapeuCor;
  return v;
}
