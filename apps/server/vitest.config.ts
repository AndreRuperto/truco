import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Lista em ordem: o caminho mais específico vem antes (o alias casa por prefixo).
    alias: [
      { find: '@truco/engine/testes', replacement: fileURLToPath(new URL('../../packages/engine/src/testes.ts', import.meta.url)) },
      { find: '@truco/engine', replacement: fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)) },
    ],
  },
  // O pool 'forks' do Vitest conflita com o IPC/handlers de processo do Colyseus
  // (provavelmente o @pm2/io que @colyseus/core carrega; @colyseus/tools também faz
  // process.send('ready')). 'threads' evita o problema.
  // Todos os testes de integração ficam em test/integracao.test.ts: boot() usa porta
  // fixa, então dois arquivos de integração em paralelo colidiriam.
  test: { include: ['test/**/*.test.ts'], pool: 'threads' },
});
