import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Sem workspace:* (exFAT não tem symlinks): os pacotes locais entram por alias.
    alias: {
      '@truco/engine': caminho('../../packages/engine/src/index.ts'),
      '@truco/protocolo': caminho('../server/src/mesa/protocolo.ts'),
    },
  },
  // host: true expõe na rede local para testar no celular (o servidor é procurado em <mesmo-host>:2567).
  server: { port: 5173, host: true },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
    // Node 25+ tem um `localStorage` global experimental (undefined sem --localstorage-file)
    // que esconde o do jsdom; desligado, o jsdom fornece localStorage/sessionStorage.
    pool: 'forks',
    poolOptions: { forks: { execArgv: ['--no-experimental-webstorage'] } },
  },
});
