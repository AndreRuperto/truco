import type { ItemLoja, Slot, UsuarioApi, VisualRoupa, VisualTampo, VisualVerso } from '@truco/api';
import { estiloVerso } from '../logica/lojaItens';
import { Avatar } from './Avatar';
import { Personagem } from './Personagem';

/** Prévia de um item da loja (cartões da loja e escolha do visual no perfil). Decorativa. */
export function PreviaItem({ item, usuario }: { item: ItemLoja; usuario: UsuarioApi | null }) {
  const slot: Slot = item.slot;
  if (slot === 'verso') {
    const v = estiloVerso(item.visual as VisualVerso)!;
    return (
      <span className="loja-previa previa-verso" data-verso={v.estampa} style={v.style} aria-hidden="true">
        <span className="carta verso" />
        <span className="carta verso" />
      </span>
    );
  }
  if (slot === 'roupa') {
    return (
      <span className="loja-previa previa-roupa" aria-hidden="true">
        <Personagem tipo={5} lado="cima" daVez={false} gritando={false} roupa={item.visual as VisualRoupa} />
      </span>
    );
  }
  if (slot === 'moldura') {
    return (
      <span className="loja-previa previa-moldura" aria-hidden="true">
        <Avatar apelido={usuario?.apelido ?? 'Você'} avatar={usuario?.avatar} tamanho={56} moldura={(item.visual as { estilo: string }).estilo} />
      </span>
    );
  }
  if (slot === 'avatar') {
    return (
      <span className="loja-previa previa-avatar" aria-hidden="true">
        <Avatar apelido={item.nome} avatar={`loja:${item.id}`} tamanho={64} />
      </span>
    );
  }
  const sup = (item.visual as VisualTampo).superficie;
  return (
    <span className="loja-previa previa-tampo" aria-hidden="true">
      <span className={`amostra-mesa amostra-${sup}`}>
        <span />
      </span>
    </span>
  );
}
