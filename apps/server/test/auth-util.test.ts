import { describe, expect, test, vi } from 'vitest';
import { CaixaDeTeste, emailDoLink, emailsConsole, emailsResend, extrairLink } from '../src/auth/emails';
import { chaveDeIp, LimiteTaxa } from '../src/auth/limite';
import { bearer, COOKIE_SESSAO, cookieApagado, cookieSessao, lerCookie } from '../src/auth/tokens';

describe('cookies', () => {
  test('lerCookie', () => {
    expect(lerCookie('a=1; truco_sessao=abc%2Dd; b=2', COOKIE_SESSAO)).toBe('abc-d');
    expect(lerCookie('a=1', COOKIE_SESSAO)).toBeNull();
    expect(lerCookie(undefined, COOKIE_SESSAO)).toBeNull();
    expect(lerCookie('truco_sessao=%E0%A4%A', COOKIE_SESSAO)).toBeNull();
  });

  test('cookieSessao e cookieApagado', () => {
    expect(cookieSessao('tok', { seguro: false, maxAgeS: 60 })).toBe('truco_sessao=tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=60');
    expect(cookieSessao('tok', { seguro: true, maxAgeS: 60 })).toMatch(/; Secure$/);
    expect(cookieApagado(false)).toBe('truco_sessao=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  });

  test('bearer', () => {
    expect(bearer('Bearer xyz')).toBe('xyz');
    expect(bearer('Basic xyz')).toBeNull();
    expect(bearer(undefined)).toBeNull();
  });
});

describe('LimiteTaxa', () => {
  test('máximo por janela, por chave', () => {
    let t = 0;
    const l = new LimiteTaxa(2, 1_000, () => t);
    expect([l.permitir('ip'), l.permitir('ip'), l.permitir('ip'), l.permitir('outro')]).toEqual([true, true, false, true]);
    t = 1_001;
    expect(l.permitir('ip')).toBe(true);
  });
});

describe('e-mails', () => {
  test('emailDoLink e extrairLink', () => {
    const e = emailDoLink('http://x.test/#/entrar?token=abc', 'ana@x.com');
    expect(e.para).toBe('ana@x.com');
    expect(e.assunto).toBe('Seu link para entrar no Truco');
    expect(e.html).toContain('href="http://x.test/#/entrar?token=abc"');
    expect(extrairLink(e.texto)).toBe('http://x.test/#/entrar?token=abc');
  });

  test('template HTML do link: botão, link por extenso, logo da mesma origem e escape', () => {
    const e = emailDoLink('https://truco.test/#/entrar?token=a"b<c', 'ana@x.com');
    expect(e.html).toContain('<!doctype html>');
    expect(e.html).toContain('Entrar no Truco');
    expect(e.html).toContain('src="https://truco.test/email-zap.png"');
    expect(e.html).toContain('href="https://truco.test/#/entrar?token=a&quot;b&lt;c"');
    expect(e.html).not.toContain('token=a"b<c');
    expect(e.html).toMatch(/15 minutos/);
    expect(e.html).toMatch(/Se não foi você/);
  });

  test('caixa de teste guarda em memória', async () => {
    const c = new CaixaDeTeste();
    await c.enviar(emailDoLink('http://l', 'a@x.com'));
    expect(c.enviados).toHaveLength(1);
  });

  // Auditoria de segurança 2026-11-10 (ID-01): em produção sem Resend, o link (com o token de login)
  // ia para o log do servidor; quem lesse o log entraria em qualquer conta, inclusive a de admin.
  test('em produção o console omite o link (o token de login nunca vai para o log)', async () => {
    const log = vi.fn();
    await emailsConsole(log, { omitirLink: true }).enviar(emailDoLink('https://truco.app/#/entrar?token=SEGREDO123', 'a@x.com'));
    const escrito = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(escrito).toContain('a@x.com');
    expect(escrito).not.toContain('SEGREDO123');
    expect(escrito).not.toContain('token=');
    expect(escrito).toMatch(/RESEND_API_KEY/);
  });

  test('console imprime o link (dev sem RESEND_API_KEY)', async () => {
    const log = vi.fn();
    await emailsConsole(log).enviar(emailDoLink('http://l/#/entrar?token=1', 'a@x.com'));
    expect(log.mock.calls[0][0]).toContain('http://l/#/entrar?token=1');
  });

  test('Resend: POST com Bearer e JSON; erro HTTP vira exceção', async () => {
    const f = vi.fn(async () => new Response('{"id":"1"}', { status: 200 }));
    await emailsResend({ chave: 're_x', remetente: 'Truco <t@x.com>', fetch: f }).enviar(emailDoLink('http://l', 'a@x.com'));
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_x');
    expect(JSON.parse(init.body as string)).toMatchObject({ from: 'Truco <t@x.com>', to: ['a@x.com'], subject: 'Seu link para entrar no Truco' });
    const ruim = vi.fn(async () => new Response('quota', { status: 429 }));
    await expect(emailsResend({ chave: 'k', remetente: 'r', fetch: ruim }).enviar(emailDoLink('http://l', 'a@x.com'))).rejects.toThrow('Resend 429');
  });
});

describe('chaveDeIp', () => {
  test('IPv4 inteiro; IPv6 agrupado por /64; IPv4 mapeado vira IPv4', () => {
    expect(chaveDeIp('1.2.3.4')).toBe('1.2.3.4');
    expect(chaveDeIp('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(chaveDeIp('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
    expect(chaveDeIp('2001:DB8:1:2:ffff::1')).toBe('2001:db8:1:2::/64');
    expect(chaveDeIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(chaveDeIp('::1')).toBe('0:0:0:0::/64');
    expect(chaveDeIp(undefined)).toBe('?');
  });
});
