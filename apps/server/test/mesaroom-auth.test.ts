import type { AuthContext } from '@colyseus/core';
import { describe, expect, test } from 'vitest';
import { MesaRoom } from '../src/MesaRoom';

const ctx = {} as AuthContext;

describe('MesaRoom.onAuth', () => {
  test('preenche o filtro nas opções', async () => {
    const o: Record<string, unknown> = {};
    await MesaRoom.onAuth('', o, ctx);
    expect(o).toMatchObject({ modo: 'classica', variante: 'paulista', humanos: 1, nivelBot: 'facil' });
  });

  // Não dá para escrever o filtro num valor que não é objeto: o Colyseus filtraria por
  // nada e casaria com qualquer sala. Recusa.
  test.each([['texto'], [42], [null], [true]])('opções não-objeto (%s) são recusadas', async (cru) => {
    await expect(MesaRoom.onAuth('', cru, ctx)).rejects.toThrow(/opções/);
  });
});
