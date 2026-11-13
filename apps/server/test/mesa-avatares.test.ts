import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { criarMesa } from './mesa-helpers';

/**
 * F4.4 do plano MVP (SEC-09): a foto de convidado (data URL de até 60 kB) ia dentro de TODO
 * `estado`, para todos. Agora o `estado` leva só um `avatarId` curto; a foto vai uma vez, na
 * mensagem `avatares`, antes do primeiro `estado` que a usa.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const foto = (letra: string) => `data:image/webp;base64,${letra.repeat(59_900)}`;

describe('avatares fora do estado', () => {
  test('mesa com 4 fotos de 60 kB: o estado serializado tem menos de 8 kB', () => {
    const t = criarMesa({ humanosEsperados: 4 });
    ['a', 'b', 'c', 'd'].forEach((id, i) => t.mesa.sentar(id, `J${i}`, undefined, foto(id.toUpperCase())));
    const e = t.estado('a')!;
    expect(JSON.stringify(e).length).toBeLessThan(8_000);
    for (const c of e.cadeiras) {
      expect(c.avatar ?? null).toBeNull();
      expect(c.avatarId).toMatch(/^[0-9a-f]{12}$/);
    }
  });

  test('cada foto chega uma vez, antes do estado que a usa; ids batem com as cadeiras', () => {
    const t = criarMesa({ humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana', undefined, foto('A'));
    t.mesa.sentar('b', 'Bia', undefined, foto('B'));
    const tipos = (t.caixa.get('a') ?? []).map((m) => m.tipo);
    expect(tipos.indexOf('avatares')).toBeLessThan(tipos.indexOf('estado'));
    const recebidas = Object.assign({}, ...t.de('a', 'avatares')) as Record<string, string>;
    const ids = t.estado('a')!.cadeiras.map((c) => c.avatarId).filter(Boolean) as string[];
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(recebidas[id]).toMatch(/^data:image\/webp/);
    // A mesma foto não é mandada de novo para quem já tem.
    const vezes = t.de('a', 'avatares').flatMap((m) => Object.keys(m)).filter((k) => k === ids[0]).length;
    expect(vezes).toBe(1);
  });

  test('quem entra depois recebe as fotos de quem já estava', () => {
    const t = criarMesa({ humanosEsperados: 3 });
    t.mesa.sentar('a', 'Ana', undefined, foto('A'));
    t.mesa.sentar('b', 'Bia', undefined, foto('B'));
    t.mesa.sentar('c', 'Cid', undefined, null);
    const recebidas = Object.assign({}, ...t.de('c', 'avatares')) as Record<string, string>;
    expect(Object.values(recebidas).sort()).toEqual([foto('A'), foto('B')]);
  });

  test('sincronizar e reconectar reenviam as fotos (o cliente pode ter recarregado)', () => {
    const t = criarMesa({ humanosEsperados: 1 });
    t.mesa.sentar('a', 'Ana', undefined, foto('A'));
    const antes = t.de('a', 'avatares').length;
    t.mesa.sincronizar('a');
    expect(t.de('a', 'avatares').length).toBe(antes + 1);
    t.mesa.desconectar('a');
    t.mesa.reconectar('a');
    expect(t.de('a', 'avatares').length).toBe(antes + 2);
  });

  test('avatar pronto (pronto:<id>) continua dentro do estado, sem mensagem à parte', () => {
    const t = criarMesa({ humanosEsperados: 1 });
    t.mesa.sentar('a', 'Ana', undefined, 'pronto:galo');
    expect(t.estado('a')!.cadeiras[0].avatar).toBe('pronto:galo');
    expect(t.de('a', 'avatares')).toHaveLength(0);
  });
});
