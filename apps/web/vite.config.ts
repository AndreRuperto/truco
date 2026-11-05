import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const alvoApi = process.env.TRUCO_PROXY_API ?? 'http://localhost:2567';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Sem workspace:* (exFAT não tem symlinks): os pacotes locais entram por alias.
    alias: {
      '@truco/engine': caminho('../../packages/engine/src/index.ts'),
      '@truco/protocolo': caminho('../server/src/mesa/protocolo.ts'),
      '@truco/api': caminho('../server/src/api/tipos.ts'),
    },
  },
  // host: true expõe na rede local para testar no celular (o WebSocket vai a <mesmo-host>:2567).
  // /api e /saude passam pelo proxy: o cookie de sessão fica na origem da página.
  server: { port: 5173, host: true, proxy: { '/api': alvoApi, '/saude': alvoApi } },
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
