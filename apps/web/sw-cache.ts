import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Nome do cache de /assets no `public/sw.js` em desenvolvimento. No build, o plugin abaixo troca
 * pelo nome com o hash do conteúdo de dist/assets: cada deploy ganha um cache novo, e o `activate`
 * do service worker apaga os antigos (mesmo prefixo). Antes era fixo ('truco-assets-v1') e só crescia.
 */
export const MARCADOR_CACHE = 'truco-assets-dev';

/** `truco-assets-<8 hex>` a partir dos nomes e conteúdos dos arquivos (ordem não importa). */
export function nomeDoCache(arquivos: readonly { nome: string; conteudo: string | Buffer }[]): string {
  const h = createHash('sha256');
  for (const a of [...arquivos].sort((x, y) => x.nome.localeCompare(y.nome))) {
    h.update(a.nome);
    h.update('\0');
    h.update(a.conteudo);
    h.update('\0');
  }
  return `truco-assets-${h.digest('hex').slice(0, 8)}`;
}

/** Troca o marcador no sw.js; sem o marcador, falha (não deixar o build sair com o nome fixo). */
export function trocarNomeDoCache(sw: string, nome: string): string {
  if (!sw.includes(`'${MARCADOR_CACHE}'`)) throw new Error(`sw.js sem o marcador '${MARCADOR_CACHE}'`);
  return sw.replaceAll(`'${MARCADOR_CACHE}'`, `'${nome}'`);
}

/** Plugin do Vite: no fim do build, grava em dist/sw.js o nome do cache deste build. */
export function cacheDoServiceWorker(): Plugin {
  let saida = 'dist';
  return {
    name: 'truco-cache-do-service-worker',
    apply: 'build',
    configResolved(c) {
      saida = c.build.outDir.startsWith('/') || /^[A-Za-z]:/.test(c.build.outDir) ? c.build.outDir : join(c.root, c.build.outDir);
    },
    closeBundle() {
      const pastaAssets = join(saida, 'assets');
      const arquivos = readdirSync(pastaAssets).map((nome) => ({ nome, conteudo: readFileSync(join(pastaAssets, nome)) }));
      const caminhoSw = join(saida, 'sw.js');
      writeFileSync(caminhoSw, trocarNomeDoCache(readFileSync(caminhoSw, 'utf8'), nomeDoCache(arquivos)));
    },
  };
}
