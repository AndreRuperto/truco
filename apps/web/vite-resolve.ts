import { fileURLToPath } from 'node:url';

const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export const resolver = {
  // Sem workspace:* (exFAT não tem symlinks): os pacotes locais entram por alias.
  // Lista em ordem: o caminho mais específico vem antes (o alias casa por prefixo).
  // @truco/engine/testes (atalhos sem ritual) só é importado pelos testes.
  alias: [
    { find: '@truco/engine/testes', replacement: caminho('../../packages/engine/src/testes.ts') },
    { find: '@truco/engine', replacement: caminho('../../packages/engine/src/index.ts') },
    { find: '@truco/protocolo', replacement: caminho('../server/src/mesa/protocolo.ts') },
    { find: '@truco/api', replacement: caminho('../server/src/api/tipos.ts') },
  ],
};
