/**
 * Tema escolhido à mão (Automático / Claro / Escuro) sem reescrever o CSS.
 *
 * O CSS continua escrito com `@media (prefers-color-scheme: light|dark)`. Este plugin do PostCSS
 * transforma cada bloco desses em dois:
 *   - o original, que só vale no automático (sem `data-tema` no <html>);
 *   - uma cópia fora da media query, que vale quando `<html data-tema="claro|escuro">` pede.
 * Os prefixos vão dentro de `:where()`, então a especificidade de cada regra fica igual à de antes.
 */

import type { AtRule, Container, Node, Plugin } from 'postcss';

const ESQUEMA = /\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/i;

/** Põe o seletor sob a condição do tema (no `:root`/`html` direto; nos outros, como ancestral). */
export function prefixar(seletor: string, condicao: string): string {
  const s = seletor.trim();
  const raiz = /^(:root|html)(?![\w-])/.exec(s);
  if (raiz) return `${raiz[1]}:where(${condicao})${s.slice(raiz[1].length)}`;
  return `:where(:root${condicao}) ${s}`;
}

/** O que sobra da media query sem o `prefers-color-scheme` ("" = nada). */
export function semEsquema(params: string): string {
  return params
    .replace(ESQUEMA, '')
    .replace(/\band\s+and\b/i, 'and')
    .replace(/^\s*and\b/i, '')
    .replace(/\band\s*$/i, '')
    .trim();
}

function dentroDeKeyframes(n: Node): boolean {
  for (let p = n.parent as Node | undefined; p; p = p.parent as Node | undefined) {
    if (p.type === 'atrule' && /keyframes$/i.test((p as AtRule).name)) return true;
  }
  return false;
}

function prefixarRegras(bloco: Container, condicao: string): void {
  bloco.walkRules((r) => {
    if (dentroDeKeyframes(r)) return;
    r.selectors = r.selectors.map((s) => prefixar(s, condicao));
  });
}

export function temaManual(): Plugin {
  return {
    postcssPlugin: 'truco-tema-manual',
    Once(raiz) {
      const blocos: AtRule[] = [];
      raiz.walkAtRules('media', (m) => {
        if (ESQUEMA.test(m.params)) blocos.push(m);
      });
      for (const m of blocos) {
        const tema = ESQUEMA.exec(m.params)![1].toLowerCase() === 'light' ? 'claro' : 'escuro';
        const resto = semEsquema(m.params);
        const copia = m.clone();
        prefixarRegras(copia, `[data-tema='${tema}']`);
        prefixarRegras(m, ':not([data-tema])');
        m.after(copia);
        if (resto) copia.params = resto;
        else copia.replaceWith(...(copia.nodes ?? []));
      }
    },
  };
}
temaManual.postcss = true;
