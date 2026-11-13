// F6.3: no app instalado (standalone, `viewport-fit=cover`) a página vai até a borda do aparelho.
// O cabeçalho e a mesa precisam respeitar o entalhe e a barra de gestos (env(safe-area-inset-*)).
// O Chromium do E2E não simula essas áreas, então o teste confere as regras no próprio CSS.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const css = (arquivo: string) => readFileSync(join(__dirname, '..', 'src', arquivo), 'utf8');
/** Corpo da primeira regra cujo seletor é exatamente `seletor` (no nível de cima do arquivo). */
function regra(texto: string, seletor: string): string {
  const escapado = seletor.replace(/\./g, '\\.');
  const i = texto.search(new RegExp('(^|\\n)' + escapado + ' \\{'));
  if (i < 0) throw new Error(`regra ${seletor} não encontrada`);
  const ini = texto.indexOf('{', i);
  return texto.slice(ini, texto.indexOf('}', ini));
}

describe('áreas seguras (F6.3)', () => {
  test('index.html cobre a tela toda (viewport-fit=cover), senão env() vale sempre 0', () => {
    expect(readFileSync(join(__dirname, '..', 'index.html'), 'utf8')).toMatch(/viewport-fit=cover/);
  });

  test('cabeçalho: entalhe em cima e laterais (paisagem)', () => {
    const r = regra(css('estilos.css'), '.cabecalho');
    expect(r).toContain('env(safe-area-inset-top)');
    expect(r).toContain('env(safe-area-inset-left)');
    expect(r).toContain('env(safe-area-inset-right)');
  });

  test('mesa: em cima e embaixo, no computador/tablet e no celular', () => {
    const geral = regra(css('estilos.css'), '.tela-mesa');
    expect(geral).toContain('env(safe-area-inset-top)');
    expect(geral).toContain('env(safe-area-inset-bottom)');
    const celular = css('mesa-mobile.css');
    expect(celular).toContain('calc(4px + env(safe-area-inset-top))');
    expect(celular).toContain('calc(8px + env(safe-area-inset-bottom))');
  });
});
