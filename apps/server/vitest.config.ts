import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@truco/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)) },
  },
  // @colyseus/tools chama process.send('ready'), que quebra o IPC do pool 'forks' do Vitest.
  test: { include: ['test/**/*.test.ts'], pool: 'threads' },
});
