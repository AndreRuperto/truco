import type { CarteiraApi, CatalogoApi, VisualMoldura } from '@truco/api';
import { formatarSaldo } from './lojaItens';

/** Estilo da moldura equipada (o catálogo diz o `estilo` de cada item). */
export function itemPorIdDoCatalogo(catalogo: CatalogoApi | null, id: string | undefined): string | null {
  if (!id) return null;
  const item = catalogo?.itens.find((i) => i.id === id);
  if (item?.slot === 'moldura') return (item.visual as VisualMoldura).estilo;
  // Catálogo ainda não carregou: o id segue o padrão `moldura-<estilo>`.
  return id.startsWith('moldura-') ? id.slice('moldura-'.length) : null;
}

/** Aviso dos bônus que o servidor aplicou ao abrir a carteira. */
export function textoDosBonus(bonus: CarteiraApi['bonus']): string | null {
  if (bonus.length === 0) return null;
  const total = bonus.reduce((s, b) => s + b.delta, 0);
  if (bonus.some((b) => b.motivo === 'cadastro')) return `Bem-vindo ao boteco: você ganhou ${formatarSaldo(total)} Fichas para jogar valendo.`;
  if (bonus.some((b) => b.motivo === 'resgate')) return `Resgate do dia: suas Fichas voltaram para ${formatarSaldo(500)}.`;
  return `Bônus do dia: +${formatarSaldo(total)} Fichas.`;
}
