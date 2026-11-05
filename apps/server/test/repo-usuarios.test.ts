import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { hashToken } from '../src/auth/tokens';
import {
  apelidoValido,
  baseDeApelido,
  consumirLinkMagico,
  criarLinkMagico,
  criarSessao,
  criarUsuario,
  DURACAO_LINK_MS,
  DURACAO_SESSAO_MS,
  encerrarSessao,
  entrarComEmail,
  entrarComGoogle,
  normalizarEmail,
  trocarApelido,
  usuarioDaSessao,
} from '../src/repo/usuarios';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

const T0 = new Date('2026-11-05T12:00:00Z');
const depois = (ms: number) => new Date(T0.getTime() + ms);

describe('validações', () => {
  test('normalizarEmail', () => {
    expect(normalizarEmail('  Ana@Exemplo.COM ')).toBe('ana@exemplo.com');
    expect(normalizarEmail('sem-arroba')).toBeNull();
    expect(normalizarEmail(42)).toBeNull();
    expect(normalizarEmail(`${'a'.repeat(250)}@x.com`)).toBeNull();
  });

  test('apelidoValido: 3 a 20 caracteres limpos', () => {
    expect(apelidoValido('  Zé do Truco ')).toBe('Zé do Truco');
    expect(apelidoValido('ab')).toBeNull();
    expect(apelidoValido('   ')).toBeNull();
    expect(apelidoValido('Bot Malandro')).toBe('Malandro');
    expect(apelidoValido(null)).toBeNull();
  });

  test('baseDeApelido', () => {
    expect(baseDeApelido('ana.e2e@teste.dev')).toBe('anae2e');
    expect(baseDeApelido('Bia Souza')).toBe('BiaSouza');
    expect(baseDeApelido('x@y.z')).toBe('jogador');
  });
});

describe('usuários', () => {
  test('apelido ocupado ganha sufixo', async () => {
    const a = await criarUsuario(b.db, { apelidoBase: 'ana' });
    const c = await criarUsuario(b.db, { apelidoBase: 'ana' });
    expect([a.apelido, c.apelido]).toEqual(['ana', 'ana2']);
  });

  test('entrarComEmail cria uma vez e depois reaproveita', async () => {
    const u1 = await entrarComEmail(b.db, 'ana@x.com');
    const u2 = await entrarComEmail(b.db, 'ana@x.com');
    expect(u2).toEqual(u1);
    expect(u1).toMatchObject({ apelido: 'ana', email: 'ana@x.com' });
  });

  test('Google: acha por sub; liga ao e-mail existente só se verificado', async () => {
    const porEmail = await entrarComEmail(b.db, 'bia@x.com');
    const ligado = await entrarComGoogle(b.db, { sub: 'g1', email: 'bia@x.com', emailVerificado: true, nome: 'Bia' });
    expect(ligado.id).toBe(porEmail.id);
    expect((await entrarComGoogle(b.db, { sub: 'g1', email: null, emailVerificado: false, nome: null })).id).toBe(porEmail.id);
    const outro = await entrarComGoogle(b.db, { sub: 'g2', email: 'bia@x.com', emailVerificado: false, nome: 'Bia Souza' });
    expect(outro.id).not.toBe(porEmail.id);
    expect(outro).toMatchObject({ apelido: 'BiaSouza', email: null });
  });

  test('trocarApelido', async () => {
    const a = await criarUsuario(b.db, { apelidoBase: 'ana' });
    await criarUsuario(b.db, { apelidoBase: 'bia' });
    expect(await trocarApelido(b.db, a.id, 'ab')).toBe('invalido');
    expect(await trocarApelido(b.db, a.id, 'bia')).toBe('em-uso');
    expect(await trocarApelido(b.db, a.id, 'Aninha')).toBe('ok');
  });
});

describe('sessões', () => {
  test('cria, valida, expira e encerra; no banco só o hash', async () => {
    const u = await criarUsuario(b.db, { apelidoBase: 'ana' });
    const token = await criarSessao(b.db, u.id, T0);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(token)).not.toBe(token);
    expect(await usuarioDaSessao(b.db, token, depois(1000))).toEqual(u);
    expect(await usuarioDaSessao(b.db, token, depois(DURACAO_SESSAO_MS + 1))).toBeNull();
    expect(await usuarioDaSessao(b.db, 'inventado', T0)).toBeNull();
    await encerrarSessao(b.db, token);
    expect(await usuarioDaSessao(b.db, token, depois(1000))).toBeNull();
  });
});

describe('links mágicos', () => {
  test('uso único e expiração', async () => {
    const t1 = await criarLinkMagico(b.db, 'ana@x.com', T0);
    expect(await consumirLinkMagico(b.db, t1, depois(1000))).toBe('ana@x.com');
    expect(await consumirLinkMagico(b.db, t1, depois(2000))).toBeNull();
    const t2 = await criarLinkMagico(b.db, 'ana@x.com', T0);
    expect(await consumirLinkMagico(b.db, t2, depois(DURACAO_LINK_MS + 1))).toBeNull();
    expect(await consumirLinkMagico(b.db, '', T0)).toBeNull();
  });
});
