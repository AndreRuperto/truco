// Orçamento de carga (F6.2): o que o navegador baixa antes de qualquer interação.
// Só roda se existir `dist` (depois de `pnpm --filter @truco/web build`); sem build, fica pulado.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';

const DIST = join(__dirname, '..', 'dist');
const temBuild = existsSync(join(DIST, 'index.html'));

const LIMITE_JS_KB = 180;
const LIMITE_CSS_KB = 60;

const kbGzip = (arquivo: string) => gzipSync(readFileSync(join(DIST, arquivo))).length / 1024;

/** Arquivos que o index.html pede, mais os imports estáticos deles (os dinâmicos ficam de fora). */
function pedacosIniciais(): { js: string[]; css: string[] } {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const css = [...html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)].map((m) => m[1]);
  const fila = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const js = new Set<string>();
  while (fila.length) {
    const atual = fila.shift()!;
    if (js.has(atual)) continue;
    js.add(atual);
    const codigo = readFileSync(join(DIST, atual), 'utf8');
    for (const m of codigo.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) fila.push(`assets/${m[1]}`);
  }
  return { js: [...js], css };
}

describe.skipIf(!temBuild)('orçamento do bundle (F6.2)', () => {
  test(`JS inicial ≤ ${LIMITE_JS_KB} kB gzip`, () => {
    const { js } = pedacosIniciais();
    expect(js.length).toBeGreaterThan(0);
    const total = js.reduce((n, a) => n + kbGzip(a), 0);
    expect(total).toBeLessThanOrEqual(LIMITE_JS_KB);
  });

  test(`CSS inicial ≤ ${LIMITE_CSS_KB} kB gzip`, () => {
    const { css } = pedacosIniciais();
    expect(css.length).toBeGreaterThan(0);
    const total = css.reduce((n, a) => n + kbGzip(a), 0);
    expect(total).toBeLessThanOrEqual(LIMITE_CSS_KB);
  });

  test('three e o SDK do Colyseus ficam fora do pedaço inicial', () => {
    for (const arquivo of pedacosIniciais().js) {
      const codigo = readFileSync(join(DIST, arquivo), 'utf8');
      expect(codigo, `${arquivo} tem o three`).not.toContain('WebGLRenderer');
      expect(codigo, `${arquivo} tem o Colyseus`).not.toMatch(/colyseus/i);
    }
  });

  test('vozes não entram no build como import: são buscadas pelo caminho só quando tocam', () => {
    const { js } = pedacosIniciais();
    for (const arquivo of js) expect(readFileSync(join(DIST, arquivo), 'utf8')).not.toMatch(/data:audio\/mpeg/);
  });
});
