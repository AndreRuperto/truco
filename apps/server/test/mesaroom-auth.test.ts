import type { AuthContext } from '@colyseus/core';
import { beforeEach, describe, expect, test } from 'vitest';
import { LimiteTaxa } from '../src/auth/limite';
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

describe('limite de criação de mesa por IP (F4.5, SEC-09)', () => {
  beforeEach(() => {
    MesaRoom.limiteCriacao = new LimiteTaxa(20, 10 * 60_000);
  });
  const pedido = (metodo: string, ip: string, xff?: string) =>
    ({ ip, headers: new Headers(xff ? { 'x-forwarded-for': xff } : {}), req: { url: `http://x/matchmake/${metodo}/mesa` } }) as unknown as AuthContext;

  test('20 criações do mesmo IP em 10 min passam; a 21ª é recusada; outro IP passa', async () => {
    for (let i = 0; i < 20; i++) {
      await expect(MesaRoom.onAuth('', {}, pedido(i % 2 ? 'create' : 'joinOrCreate', '203.0.113.7'))).resolves.toBe(true);
    }
    await expect(MesaRoom.onAuth('', {}, pedido('create', '203.0.113.7'))).rejects.toThrow(/muitas mesas/);
    await expect(MesaRoom.onAuth('', {}, pedido('create', '203.0.113.8'))).resolves.toBe(true);
  });

  test('entrar (join, joinById) e chamadas internas da fila não contam', async () => {
    for (let i = 0; i < 30; i++) {
      await expect(MesaRoom.onAuth('', {}, pedido(i % 2 ? 'join' : 'joinById', '203.0.113.9'))).resolves.toBe(true);
      await expect(MesaRoom.onAuth('', {}, ctx)).resolves.toBe(true);
    }
    await expect(MesaRoom.onAuth('', {}, pedido('create', '203.0.113.9'))).resolves.toBe(true);
  });

  test('atrás do proxy confiável, o IP é o último do X-Forwarded-For (como o trust proxy 1 do Express)', async () => {
    const antes = MesaRoom.servicos;
    MesaRoom.servicos = { ...(antes ?? {}), confiarProxy: true } as typeof MesaRoom.servicos;
    try {
      for (let i = 0; i < 20; i++) await MesaRoom.onAuth('', {}, pedido('create', '10.0.0.1', `1.1.1.1, 198.51.100.${i}`));
      // 20 clientes diferentes atrás do mesmo proxy: nenhum foi barrado pelo IP do proxy.
      await expect(MesaRoom.onAuth('', {}, pedido('create', '10.0.0.1', '1.1.1.1, 198.51.100.200'))).resolves.toBe(true);
    } finally {
      MesaRoom.servicos = antes;
    }
  });
});

