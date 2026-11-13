import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';
import { hashToken } from '../src/auth/tokens';
import { linksMagicos, sessoes, usuarios } from '../src/banco/schema';
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
  emailCanonico,
  ErroEmailCanonico,
  ErroGoogleOutraConta,
  limparExpirados,
  normalizarEmail,
  restricaoViolada,
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

  test('apelido é único sem diferenciar maiúsculas', async () => {
    await criarUsuario(b.db, { apelidoBase: 'ana' });
    expect((await criarUsuario(b.db, { apelidoBase: 'Ana' })).apelido).toBe('Ana2');
    const erro = await b.db.insert(usuarios).values({ apelido: 'ANA' }).catch((e: unknown) => e);
    expect(restricaoViolada(erro)).toBe('usuarios_apelido_lower_idx');
    const c = await criarUsuario(b.db, { apelidoBase: 'caio' });
    expect(await trocarApelido(b.db, c.id, 'ANA2')).toBe('em-uso');
    expect(await trocarApelido(b.db, c.id, 'Caio')).toBe('ok');
  });

  test('entrarComEmail normaliza o e-mail e recusa inválido', async () => {
    const u1 = await entrarComEmail(b.db, '  Ana@X.com ');
    expect(u1.email).toBe('ana@x.com');
    expect((await entrarComEmail(b.db, 'ana@x.com')).id).toBe(u1.id);
    await expect(entrarComEmail(b.db, 'sem-arroba')).rejects.toThrow(/e-mail inválido/);
  });

  test('criarUsuario não tenta de novo quando o conflito é de e-mail', async () => {
    await criarUsuario(b.db, { apelidoBase: 'ana', email: 'a@x.com' });
    const erro = await criarUsuario(b.db, { apelidoBase: 'zeca', email: 'a@x.com' }).catch((e: unknown) => e);
    expect(restricaoViolada(erro)).toBe('usuarios_email_unique');
  });

  test('logins simultâneos do mesmo e-mail ou Google viram uma conta só', async () => {
    const [a, c] = await Promise.all([entrarComEmail(b.db, 'dup@x.com'), entrarComEmail(b.db, 'dup@x.com')]);
    expect(a.id).toBe(c.id);
    const g = { sub: 'g9', email: 'g9@x.com', emailVerificado: true, nome: 'Gil' };
    const [g1, g2] = await Promise.all([entrarComGoogle(b.db, g), entrarComGoogle(b.db, g)]);
    expect(g1.id).toBe(g2.id);
    expect(await b.db.select().from(usuarios)).toHaveLength(2);
  });

  test('Google não sobrescreve outro sub já ligado ao e-mail', async () => {
    const bia = await entrarComGoogle(b.db, { sub: 'g1', email: 'bia@x.com', emailVerificado: true, nome: 'Bia' });
    await expect(entrarComGoogle(b.db, { sub: 'g2', email: 'bia@x.com', emailVerificado: true, nome: 'Bia' })).rejects.toBeInstanceOf(
      ErroGoogleOutraConta,
    );
    const [linha] = await b.db.select().from(usuarios).where(eq(usuarios.id, bia.id));
    expect(linha.googleSub).toBe('g1');
  });

  test('trocarApelido', async () => {
    const a = await criarUsuario(b.db, { apelidoBase: 'ana' });
    await criarUsuario(b.db, { apelidoBase: 'bia' });
    expect(await trocarApelido(b.db, a.id, 'ab')).toBe('invalido');
    expect(await trocarApelido(b.db, a.id, 'bia')).toBe('em-uso');
    expect(await trocarApelido(b.db, a.id, 'Aninha')).toBe('ok');
  });
});

describe('e-mail canônico: sem conta nova com +tag (F4.2, D1b)', () => {
  test('emailCanonico: minúsculas e sem o +tag da parte local; pontos ficam', () => {
    expect(emailCanonico('Ana+Truco@Exemplo.com')).toBe('ana@exemplo.com');
    expect(emailCanonico('a.n.a+1+2@x.com')).toBe('a.n.a@x.com');
    expect(emailCanonico('ana@x.com')).toBe('ana@x.com');
  });

  test('a+1@x.com depois de a@x.com: criação recusada pelo link mágico', async () => {
    await entrarComEmail(b.db, 'a@x.com');
    await expect(entrarComEmail(b.db, 'a+1@x.com')).rejects.toBeInstanceOf(ErroEmailCanonico);
    await expect(entrarComEmail(b.db, 'a+1@x.com')).rejects.toThrow('Já existe uma conta com este e-mail. Entre com o endereço original.');
    expect(await b.db.select().from(usuarios)).toHaveLength(1);
  });

  test('conta antiga com +tag continua entrando; outra variação dela é recusada', async () => {
    // Conta criada antes da regra (sem passar pelo filtro): entra normalmente.
    await criarUsuario(b.db, { apelidoBase: 'velha', email: 'b+velha@x.com' });
    const u = await entrarComEmail(b.db, 'b+velha@x.com');
    expect(u.email).toBe('b+velha@x.com');
    await expect(entrarComEmail(b.db, 'b@x.com')).rejects.toBeInstanceOf(ErroEmailCanonico);
  });

  test('Google com e-mail verificado também não cria conta paralela por +tag', async () => {
    await entrarComEmail(b.db, 'c@x.com');
    await expect(entrarComGoogle(b.db, { sub: 'g-1', email: 'c+g@x.com', emailVerificado: true, nome: 'C' })).rejects.toBeInstanceOf(ErroEmailCanonico);
  });

  test('a migração 0007 preenche o canônico das contas que já existiam (igual a emailCanonico)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { sql } = await import('drizzle-orm');
    for (const email of ['Ana+x@Ex.com'.toLowerCase(), 'b.o.b@x.com', 'c+1+2@y.org']) {
      await b.db.insert(usuarios).values({ apelido: email.replace(/[^a-z]/g, '').slice(0, 10), email, emailCanonico: null });
    }
    const arquivo = readFileSync(join(__dirname, '..', 'drizzle', '0007_email_canonico.sql'), 'utf8');
    const update = arquivo.split('--> statement-breakpoint').map((x) => x.trim()).find((x) => x.includes('UPDATE'))!;
    await b.db.execute(sql.raw(update.split(/\r?\n/).filter((l) => !l.startsWith('--')).join('\n')));
    const linhas = await b.db.select().from(usuarios);
    for (const l of linhas) expect(l.emailCanonico).toBe(emailCanonico(l.email!));
    expect(linhas.map((l) => l.emailCanonico).sort()).toEqual(['ana@ex.com', 'b.o.b@x.com', 'c@y.org']);
  });

  test('criarUsuario grava o canônico', async () => {
    const u = await criarUsuario(b.db, { apelidoBase: 'd', email: 'D+1@x.com'.toLowerCase() });
    const [linha] = await b.db.select().from(usuarios).where(eq(usuarios.id, u.id));
    expect(linha.emailCanonico).toBe('d@x.com');
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

  test('normaliza o e-mail', async () => {
    const t = await criarLinkMagico(b.db, ' ANA@x.com', T0);
    expect(await consumirLinkMagico(b.db, t, depois(1000))).toBe('ana@x.com');
    await expect(criarLinkMagico(b.db, 'nada', T0)).rejects.toThrow(/e-mail inválido/);
  });

  test('pedir outro link invalida os anteriores daquele e-mail e apaga os expirados', async () => {
    const velho = await criarLinkMagico(b.db, 'bia@x.com', T0);
    const t1 = await criarLinkMagico(b.db, 'ana@x.com', depois(DURACAO_LINK_MS));
    const t2 = await criarLinkMagico(b.db, 'ana@x.com', depois(DURACAO_LINK_MS + 1));
    expect(await consumirLinkMagico(b.db, t1, depois(DURACAO_LINK_MS + 2))).toBeNull();
    expect(await consumirLinkMagico(b.db, t2, depois(DURACAO_LINK_MS + 2))).toBe('ana@x.com');
    const restantes = await b.db.select().from(linksMagicos);
    expect(restantes.map((l) => l.tokenHash)).toEqual([hashToken(t2)]);
    expect(velho).toBeTruthy();
  });
});

describe('limparExpirados', () => {
  test('apaga sessões vencidas e links vencidos ou usados', async () => {
    const u = await criarUsuario(b.db, { apelidoBase: 'ana' });
    const viva = await criarSessao(b.db, u.id, depois(DURACAO_SESSAO_MS));
    await criarSessao(b.db, u.id, T0);
    const vivo = await criarLinkMagico(b.db, 'c@x.com', depois(DURACAO_SESSAO_MS));
    const usado = await criarLinkMagico(b.db, 'a@x.com', T0);
    await consumirLinkMagico(b.db, usado, depois(1));
    await criarLinkMagico(b.db, 'b@x.com', T0);
    expect(await limparExpirados(b.db, depois(DURACAO_SESSAO_MS + 1))).toEqual({ sessoes: 1, links: 2 });
    expect((await b.db.select().from(sessoes)).map((x) => x.tokenHash)).toEqual([hashToken(viva)]);
    expect((await b.db.select().from(linksMagicos)).map((x) => x.tokenHash)).toEqual([hashToken(vivo)]);
  });
});
