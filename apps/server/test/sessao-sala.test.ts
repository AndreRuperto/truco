import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { COOKIE_SESSAO } from '../src/auth/tokens';
import { criarSessao, entrarComEmail } from '../src/repo/usuarios';
import { servicosDeTeste } from '../src/servicos';
import { usuarioDaConexao } from '../src/sessaoSala';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

const comCookie = (valor: string) => new Headers({ cookie: `${COOKIE_SESSAO}=${valor}` });

describe('usuarioDaConexao', () => {
  test('cookie válido vale', async () => {
    const s = servicosDeTeste(b.db);
    const u = await entrarComEmail(b.db, 'ana@x.com');
    const t = await criarSessao(b.db, u.id, new Date());
    expect(await usuarioDaConexao(s, undefined, comCookie(t))).toEqual({ usuarioId: u.id, apelido: 'ana', avatar: null });
  });

  test('cookie vencido ou inventado não descarta um Bearer válido', async () => {
    const s = servicosDeTeste(b.db);
    const u = await entrarComEmail(b.db, 'ana@x.com');
    const t = await criarSessao(b.db, u.id, new Date());
    expect(await usuarioDaConexao(s, t, comCookie('vencido'))).toEqual({ usuarioId: u.id, apelido: 'ana', avatar: null });
  });

  test('Bearer inválido não descarta um cookie válido; nenhum válido = null', async () => {
    const s = servicosDeTeste(b.db);
    const u = await entrarComEmail(b.db, 'ana@x.com');
    const t = await criarSessao(b.db, u.id, new Date());
    expect(await usuarioDaConexao(s, 'inventado', comCookie(t))).toEqual({ usuarioId: u.id, apelido: 'ana', avatar: null });
    expect(await usuarioDaConexao(s, 'inventado', comCookie('outro'))).toBeNull();
    expect(await usuarioDaConexao(null, t, undefined)).toBeNull();
  });
});
