import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';
import { subirApp } from './http-helpers';

/**
 * Auditoria de segurança 2026-11-10 (WEB-07): o servidor não mandava nenhum cabeçalho de segurança
 * (CSP, proteção contra enquadramento, nosniff, Referrer-Policy, HSTS). Uma CSP estrita é a segunda
 * camada se um XSS aparecer, e frame-ancestors impede embutir o jogo num site de terceiros.
 */
const SCRIPT_INLINE = "try { var t = localStorage.getItem('truco:tema'); } catch (e) {}";
const HASH = `'sha256-${createHash('sha256').update(SCRIPT_INLINE).digest('base64')}'`;

let b: BancoDeTeste;
let pastaWeb: string;

beforeAll(async () => {
  b = await bancoDeTeste();
  pastaWeb = mkdtempSync(join(tmpdir(), 'truco-cab-'));
  writeFileSync(
    join(pastaWeb, 'index.html'),
    `<!doctype html><head><script>${SCRIPT_INLINE}</script><script type="module" src="/assets/a.js"></script></head><div id="raiz"></div>`,
  );
}, 30_000);
afterAll(() => b.fechar());

const diretivas = (csp: string | null) =>
  Object.fromEntries((csp ?? '').split(';').map((d) => d.trim()).filter(Boolean).map((d) => [d.split(/\s+/)[0], d.split(/\s+/).slice(1)]));

describe('cabeçalhos de segurança', () => {
  test('página: CSP estrita com o hash do script inline, sem eval, e proteção contra enquadramento', async () => {
    const app = await subirApp(servicosDeTeste(b.db), { pastaWeb });
    try {
      const r = await fetch(app.base + '/');
      const csp = diretivas(r.headers.get('content-security-policy'));
      expect(csp['default-src']).toEqual(["'self'"]);
      expect(csp['script-src']).toContain("'self'");
      expect(csp['script-src']).toContain(HASH);
      expect(csp['script-src']).toContain('https://accounts.google.com/gsi/client');
      expect(csp['script-src']).not.toContain("'unsafe-inline'");
      expect(csp['script-src']).not.toContain("'unsafe-eval'");
      expect(csp['object-src']).toEqual(["'none'"]);
      expect(csp['base-uri']).toEqual(["'none'"]);
      expect(csp['frame-ancestors']).toEqual(["'none'"]);
      expect(csp['form-action']).toEqual(["'self'"]);
      expect(csp['font-src']).toContain('https://fonts.gstatic.com');
      expect(csp['style-src']).toContain('https://fonts.googleapis.com');
      expect(csp['frame-src']).toContain('https://accounts.google.com/gsi/');
      expect(r.headers.get('x-frame-options')).toBe('DENY');
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(r.headers.get('permissions-policy')).toMatch(/camera=\(\)/);
      // Popup do login com Google precisa falar com a janela que o abriu.
      expect(r.headers.get('cross-origin-opener-policy')).toBe('same-origin-allow-popups');
      // Fora de produção não há HTTPS garantido: sem HSTS.
      expect(r.headers.get('strict-transport-security')).toBeNull();
    } finally {
      await app.fechar();
    }
  });

  test('API também leva os cabeçalhos (JSON não pode ser interpretado como outro tipo nem enquadrado)', async () => {
    const app = await subirApp(servicosDeTeste(b.db), { pastaWeb });
    try {
      const r = await fetch(app.base + '/api/config');
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('x-frame-options')).toBe('DENY');
      expect(r.headers.get('content-security-policy')).toMatch(/frame-ancestors 'none'/);
    } finally {
      await app.fechar();
    }
  });

  test('produção: HSTS e WebSocket liberado só para o domínio público', async () => {
    const app = await subirApp(servicosDeTeste(b.db, { producao: true, urlPublica: 'https://truco.exemplo.com' }), { pastaWeb });
    try {
      const r = await fetch(app.base + '/');
      expect(r.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
      const csp = diretivas(r.headers.get('content-security-policy'));
      expect(csp['connect-src']).toContain("'self'");
      expect(csp['connect-src']).toContain('wss://truco.exemplo.com');
      expect(csp['connect-src']).not.toContain('wss:');
      expect(csp['connect-src']).not.toContain('ws:');
    } finally {
      await app.fechar();
    }
  });
});
