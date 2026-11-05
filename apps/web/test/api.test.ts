import { describe, expect, test, vi } from 'vitest';
import { criarApi, ErroApi } from '../src/rede/api';

function fetchFalso(respostas: Response[]) {
  const f = vi.fn(async (_url: string, _init?: RequestInit) => respostas.shift()!);
  return f;
}

describe('cliente da API', () => {
  test('GET com credenciais da mesma origem', async () => {
    const f = fetchFalso([new Response(JSON.stringify({ usuario: null }), { status: 200 })]);
    expect(await criarApi(f as unknown as typeof fetch).eu()).toEqual({ usuario: null });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/eu');
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  test('POST manda JSON; 204 devolve undefined', async () => {
    const f = fetchFalso([new Response(null, { status: 204 })]);
    expect(await criarApi(f as unknown as typeof fetch).pedirLink('ana@x.com')).toBeUndefined();
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/auth/link');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe('{"email":"ana@x.com"}');
  });

  test('erro HTTP vira ErroApi com a mensagem do servidor', async () => {
    const f = fetchFalso([new Response(JSON.stringify({ erro: 'link inválido ou expirado; peça outro' }), { status: 400 })]);
    const e = await criarApi(f as unknown as typeof fetch).confirmarLink('x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroApi);
    expect(e).toMatchObject({ status: 400, message: 'link inválido ou expirado; peça outro' });
  });

  test('caminhos', async () => {
    const corpo = () => new Response('{}', { status: 200 });
    const f = fetchFalso([corpo(), corpo(), corpo(), corpo(), corpo(), corpo(), corpo()]);
    const api = criarApi(f as unknown as typeof fetch);
    await api.perfil();
    await api.perfil(7);
    await api.historico();
    await api.ranking('mineiro');
    await api.salas();
    await api.trocarApelido('Zé');
    await api.sair();
    expect(f.mock.calls.map(([u, i]) => `${i?.method} ${u}`)).toEqual([
      'GET /api/perfil',
      'GET /api/perfil/7',
      'GET /api/historico',
      'GET /api/ranking/mineiro',
      'GET /api/salas',
      'PATCH /api/eu',
      'POST /api/auth/sair',
    ]);
  });
});
