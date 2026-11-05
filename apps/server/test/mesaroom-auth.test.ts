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

  // Com pedido HTTP, só os métodos que o controller do Colyseus expõe e que chamam onAuth
  // passam; um método desconhecido (ou URL fora de /matchmake) não ganha o "pode tudo".
  const comUrl = (url: string) => ({ req: { url } }) as unknown as AuthContext;
  test.each([['create'], ['joinOrCreate'], ['join'], ['joinById']])('método %s reconhecido passa', async (m) => {
    await expect(MesaRoom.onAuth('', {}, comUrl(`http://x/matchmake/${m}/mesa`))).resolves.toBe(true);
  });
  test.each([['http://x/matchmake/outroMetodo/mesa'], ['http://x/qualquer/coisa'], ['%%%']])('pedido HTTP com método desconhecido (%s) é recusado', async (url) => {
    await expect(MesaRoom.onAuth('', {}, comUrl(url))).rejects.toThrow(/método/);
  });
  test('privada por joinOrCreate é recusada; por create passa', async () => {
    await expect(MesaRoom.onAuth('', { modo: 'privada' }, comUrl('http://x/matchmake/joinOrCreate/mesa'))).rejects.toThrow(/privada/);
    await expect(MesaRoom.onAuth('', { modo: 'privada' }, comUrl('http://x/matchmake/create/mesa'))).resolves.toBe(true);
  });

  // Não dá para escrever o filtro num valor que não é objeto: o Colyseus filtraria por
  // nada e casaria com qualquer sala. Recusa.
  test.each([['texto'], [42], [null], [true]])('opções não-objeto (%s) são recusadas', async (cru) => {
    await expect(MesaRoom.onAuth('', cru, ctx)).rejects.toThrow(/opções/);
  });
});
