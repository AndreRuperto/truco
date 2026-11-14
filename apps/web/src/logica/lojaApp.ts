import type { CarteiraApi, CatalogoApi, VisualMoldura } from '@truco/api';

/** Estilo da moldura equipada (o catálogo diz o `estilo` de cada item). */
export function itemPorIdDoCatalogo(catalogo: CatalogoApi | null, id: string | undefined): string | null {
  if (!id) return null;
  const item = catalogo?.itens.find((i) => i.id === id);
  if (item?.slot === 'moldura') return (item.visual as VisualMoldura).estilo;
  // Catálogo ainda não carregou: o id segue o padrão `moldura-<estilo>`.
  return id.startsWith('moldura-') ? id.slice('moldura-'.length) : null;
}

/** Aviso dos bônus (componentes/AvisoBonus.tsx): o tipo escolhe o título e o desenho; `fichas` é o número grande. */
export interface AvisoBonusDados {
  tipo: 'boas-vindas' | 'diario' | 'resgate';
  fichas: number;
}

/** Saldo de Fichas para onde o resgate do dia devolve quem zerou. */
const SALDO_RESGATE = 500;

/** Aviso dos bônus que o servidor aplicou ao abrir a carteira. */
export function avisoDosBonus(bonus: CarteiraApi['bonus']): AvisoBonusDados | null {
  if (bonus.length === 0) return null;
  const total = bonus.reduce((s, b) => s + b.delta, 0);
  if (bonus.some((b) => b.motivo === 'cadastro')) return { tipo: 'boas-vindas', fichas: total };
  if (bonus.some((b) => b.motivo === 'resgate')) return { tipo: 'resgate', fichas: SALDO_RESGATE };
  return { tipo: 'diario', fichas: total };
}
