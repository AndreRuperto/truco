import { eq, inArray } from 'drizzle-orm';
import type { VisualJogador } from '../api/tipos';
import type { Banco } from '../banco/banco';
import { inventario, usuarios } from '../banco/schema';
import { ehSlot, gratisDoSlot, itemPorId, type Slot, type VisualMoldura, type VisualRoupa, type VisualVerso } from '../loja/catalogo';
import { type Exec, movimentar, SaldoInsuficiente } from './carteira';

export type Equipados = Partial<Record<Exclude<Slot, 'avatar'>, string>>;

/** Prefixo do avatar comprado na loja em `usuarios.avatar` (os prontos usam `pronto:`). */
export const PREFIXO_AVATAR_LOJA = 'loja:';

export type ResultadoCompra = 'ok' | 'inexistente' | 'gratis' | 'ja-tem' | 'saldo';

export async function comprarItem(db: Banco, usuarioId: number, itemId: unknown): Promise<ResultadoCompra> {
  const item = itemPorId(itemId);
  if (!item) return 'inexistente';
  if (!item.preco) return 'gratis';
  const preco = item.preco;
  try {
    return await db.transaction(async (tx) => {
      const novo = await tx.insert(inventario).values({ usuarioId, itemId: item.id }).onConflictDoNothing().returning();
      if (novo.length === 0) return 'ja-tem' as const;
      await movimentar(tx, usuarioId, preco.moeda, -preco.valor, 'compra_item', item.id);
      return 'ok' as const;
    });
  } catch (e) {
    if (e instanceof SaldoInsuficiente) return 'saldo';
    throw e;
  }
}

export async function inventarioDe(db: Exec, usuarioId: number): Promise<string[]> {
  const r = await db.select({ id: inventario.itemId }).from(inventario).where(eq(inventario.usuarioId, usuarioId));
  return r.map((x) => x.id);
}

export async function equipadosDe(db: Exec, usuarioId: number): Promise<Equipados> {
  const [u] = await db.select({ e: usuarios.equipados }).from(usuarios).where(eq(usuarios.id, usuarioId));
  return u?.e ?? {};
}

export type ResultadoEquipar = 'ok' | 'invalido' | 'nao-tem';

/** Equipa um item do slot (de série ou do inventário); `null` volta ao de série. */
export async function equipar(db: Banco, usuarioId: number, slot: unknown, itemId: unknown): Promise<ResultadoEquipar> {
  if (!ehSlot(slot)) return 'invalido';
  if (itemId !== null) {
    const item = itemPorId(itemId);
    if (!item || item.slot !== slot) return 'invalido';
    if (item.preco && !(await inventarioDe(db, usuarioId)).includes(item.id)) return 'nao-tem';
  }
  const id = itemId as string | null;
  if (slot === 'avatar') {
    // Desequipar o avatar da loja: sem foto (o jogador escolhe outra no perfil).
    await db.update(usuarios).set({ avatar: id ? `${PREFIXO_AVATAR_LOJA}${id}` : null }).where(eq(usuarios.id, usuarioId));
    return 'ok';
  }
  const atual = await equipadosDe(db, usuarioId);
  const novo: Equipados = { ...atual };
  if (id === null || itemPorId(id)?.preco === null) delete novo[slot];
  if (id !== null) novo[slot] = id;
  await db.update(usuarios).set({ equipados: novo }).where(eq(usuarios.id, usuarioId));
  return 'ok';
}

const visualDoSlot = <T>(slot: Slot, id: string | undefined): T => ((id ? itemPorId(id) : null) ?? gratisDoSlot(slot))!.visual as T;

/** Visual padrão (quem não tem conta ou não equipou nada). */
export function visualPadrao(): VisualJogador {
  return { verso: visualDoSlot<VisualVerso>('verso', undefined), roupa: {}, moldura: 'nenhuma' };
}

export function visualDosEquipados(e: Equipados): VisualJogador {
  return {
    verso: visualDoSlot<VisualVerso>('verso', e.verso),
    roupa: visualDoSlot<VisualRoupa>('roupa', e.roupa),
    moldura: visualDoSlot<VisualMoldura>('moldura', e.moldura).estilo,
  };
}

export async function visualDe(db: Exec, ids: readonly number[]): Promise<Map<number, VisualJogador>> {
  const out = new Map<number, VisualJogador>();
  if (ids.length === 0) return out;
  const r = await db.select({ id: usuarios.id, e: usuarios.equipados }).from(usuarios).where(inArray(usuarios.id, [...ids]));
  for (const x of r) out.set(x.id, visualDosEquipados(x.e ?? {}));
  return out;
}
