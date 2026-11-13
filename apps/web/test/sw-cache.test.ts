import { describe, expect, test } from 'vitest';
import { MARCADOR_CACHE, nomeDoCache, trocarNomeDoCache } from '../sw-cache';

/** F5.1 do plano MVP: o cache de /assets do service worker troca de nome a cada build. */
describe('nome do cache do service worker por build', () => {
  const build = (arquivos: Record<string, string>) => Object.entries(arquivos).map(([nome, conteudo]) => ({ nome, conteudo }));

  test('dois builds com conteúdo diferente geram nomes diferentes; o mesmo build, o mesmo nome', () => {
    const a = build({ 'index-a1.js': 'console.log(1)', 'index-b2.css': 'body{}' });
    const b = build({ 'index-a1.js': 'console.log(2)', 'index-b2.css': 'body{}' });
    expect(nomeDoCache(a)).toMatch(/^truco-assets-[0-9a-f]{8}$/);
    expect(nomeDoCache(a)).not.toBe(nomeDoCache(b));
    expect(nomeDoCache([...a].reverse())).toBe(nomeDoCache(a));
  });

  test('troca o marcador do sw.js uma vez; sem marcador, falha (o build não pode sair com o nome fixo)', () => {
    const sw = `const CACHE_ATIVOS = '${MARCADOR_CACHE}';\nconst PREFIXO = 'truco-assets-';`;
    const novo = trocarNomeDoCache(sw, 'truco-assets-0badc0de');
    expect(novo).toContain("const CACHE_ATIVOS = 'truco-assets-0badc0de';");
    expect(novo).not.toContain(MARCADOR_CACHE);
    expect(() => trocarNomeDoCache('sem marcador', 'truco-assets-x')).toThrow(/marcador/);
  });
});
