import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { temaManual } from './tema-css';
import { cacheDoServiceWorker } from './sw-cache';

const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const alvoApi = process.env.TRUCO_PROXY_API ?? 'http://localhost:2567';

export default defineConfig({
  plugins: [react(), cacheDoServiceWorker()],
  // Tema escolhido no cabeçalho vale por cima do tema do aparelho (ver tema-css.ts).
  css: { postcss: { plugins: [temaManual()] } },
  resolve: {
    // Sem workspace:* (exFAT não tem symlinks): os pacotes locais entram por alias.
    // Lista em ordem: o caminho mais específico vem antes (o alias casa por prefixo).
    // @truco/engine/testes (atalhos sem ritual) só é importado pelos testes.
    alias: [
      { find: '@truco/engine/testes', replacement: caminho('../../packages/engine/src/testes.ts') },
      { find: '@truco/engine', replacement: caminho('../../packages/engine/src/index.ts') },
      { find: '@truco/protocolo', replacement: caminho('../server/src/mesa/protocolo.ts') },
      { find: '@truco/api', replacement: caminho('../server/src/api/tipos.ts') },
    ],
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
