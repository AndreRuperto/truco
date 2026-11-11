import { describe, expect, test } from 'vitest';
import { configDoAmbiente } from '../src/servicos';

const PADROES = { pastaPglite: '/dados/pglite' };

describe('configDoAmbiente', () => {
  test('dev sem nada: PGlite em disco, console, sem Google, sem avisos', () => {
    expect(configDoAmbiente({}, PADROES)).toEqual({
      producao: false,
      databaseUrl: null,
      pastaPglite: '/dados/pglite',
      resend: null,
      googleClientId: null,
      urlPublica: null,
      emailTeste: false,
      kElo: 32,
      origens: [],
      admins: [],
      confiarProxy: false,
      pagamento: { modo: 'desligado', handle: null, apiKey: null },
      avisos: [],
    });
  });

  test('LOJA_PAGAMENTO: on exige handle; simulado só fora de produção', () => {
    expect(configDoAmbiente({ LOJA_PAGAMENTO: 'on', INFINITEPAY_HANDLE: '$boteco', INFINITEPAY_API_KEY: 'inchk_1' }, PADROES).pagamento).toEqual({
      modo: 'infinitepay',
      handle: 'boteco',
      apiKey: 'inchk_1',
    });
    const semHandle = configDoAmbiente({ LOJA_PAGAMENTO: 'on' }, PADROES);
    expect(semHandle.pagamento.modo).toBe('desligado');
    expect(semHandle.avisos.join()).toMatch(/INFINITEPAY_HANDLE/);
    expect(configDoAmbiente({ LOJA_PAGAMENTO: 'simulado' }, PADROES).pagamento.modo).toBe('simulado');
    const prod = configDoAmbiente({ NODE_ENV: 'production', TRUCO_URL_PUBLICA: 'https://t.app', LOJA_PAGAMENTO: 'simulado' }, PADROES);
    expect(prod.pagamento.modo).toBe('desligado');
    expect(prod.avisos.join()).toMatch(/simulado/);
  });

  test('TRUCO_PGLITE=memoria e caminho próprio', () => {
    expect(configDoAmbiente({ TRUCO_PGLITE: 'memoria' }, PADROES).pastaPglite).toBeNull();
    expect(configDoAmbiente({ TRUCO_PGLITE: 'C:/x' }, PADROES).pastaPglite).toBe('C:/x');
  });

  test('produção completa (Railway)', () => {
    const c = configDoAmbiente(
      {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://u:p@h/db',
        RESEND_API_KEY: 're_1',
        TRUCO_EMAIL_REMETENTE: 'Truco <oi@truco.app>',
        GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com',
        RAILWAY_PUBLIC_DOMAIN: 'truco.up.railway.app',
        TRUCO_ORIGENS: 'https://truco.app, https://www.truco.app',
        TRUCO_K_ELO: '24',
      },
      PADROES,
    );
    expect(c).toMatchObject({
      producao: true,
      databaseUrl: 'postgres://u:p@h/db',
      pastaPglite: null,
      resend: { chave: 're_1', remetente: 'Truco <oi@truco.app>' },
      googleClientId: 'cid.apps.googleusercontent.com',
      urlPublica: 'https://truco.up.railway.app',
      kElo: 24,
      origens: ['https://truco.app', 'https://www.truco.app'],
      avisos: [],
    });
  });

  test('ADMIN_EMAILS: lista separada por vírgula, minúscula, sem vazios', () => {
    expect(configDoAmbiente({ ADMIN_EMAILS: ' Ana@X.com, ,bia@y.com ' }, PADROES).admins).toEqual(['ana@x.com', 'bia@y.com']);
  });

  test('TRUCO_URL_PUBLICA vence o domínio do Railway e perde a barra final', () => {
    expect(configDoAmbiente({ TRUCO_URL_PUBLICA: 'https://truco.app/', RAILWAY_PUBLIC_DOMAIN: 'x' }, PADROES).urlPublica).toBe('https://truco.app');
  });

  test('caixa de teste: liga com TRUCO_EMAIL_TESTE=1 ou NODE_ENV=test; nunca em produção', () => {
    expect(configDoAmbiente({ TRUCO_EMAIL_TESTE: '1' }, PADROES).emailTeste).toBe(true);
    expect(configDoAmbiente({ NODE_ENV: 'test' }, PADROES).emailTeste).toBe(true);
    const p = configDoAmbiente({ NODE_ENV: 'production', TRUCO_EMAIL_TESTE: '1', DATABASE_URL: 'x', TRUCO_URL_PUBLICA: 'https://a' }, PADROES);
    expect(p.emailTeste).toBe(false);
    expect(p.avisos).toContainEqual(expect.stringContaining('TRUCO_EMAIL_TESTE'));
  });

  test('produção sem banco gera avisos; K inválido volta a 32', () => {
    const c = configDoAmbiente({ NODE_ENV: 'production', TRUCO_K_ELO: '500', RAILWAY_PUBLIC_DOMAIN: 'x.up.railway.app' }, PADROES);
    expect(c.kElo).toBe(32);
    expect(c.avisos).toEqual([expect.stringContaining('DATABASE_URL'), expect.stringContaining('RESEND_API_KEY')]);
  });

  test('produção sem URL pública não sobe (o link mágico nunca sai do Host do pedido)', () => {
    expect(() => configDoAmbiente({ NODE_ENV: 'production', DATABASE_URL: 'x' }, PADROES)).toThrow(/TRUCO_URL_PUBLICA ou RAILWAY_PUBLIC_DOMAIN/);
  });

  test('proxy confiável: em produção ou com TRUCO_TRUST_PROXY', () => {
    expect(configDoAmbiente({}, PADROES).confiarProxy).toBe(false);
    expect(configDoAmbiente({ TRUCO_TRUST_PROXY: '1' }, PADROES).confiarProxy).toBe(true);
    expect(configDoAmbiente({ NODE_ENV: 'production', TRUCO_URL_PUBLICA: 'https://a' }, PADROES).confiarProxy).toBe(true);
  });
});
