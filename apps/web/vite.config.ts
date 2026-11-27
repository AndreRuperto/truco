import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { temaManual } from './tema-css';
import { cacheDoServiceWorker } from './sw-cache';

import { resolver } from './vite-resolve';

const alvoApi = process.env.TRUCO_PROXY_API ?? 'http://localhost:2567';

export default defineConfig({
  plugins: [react(), cacheDoServiceWorker()],
  // Tema escolhido no cabeçalho vale por cima do tema do aparelho (ver tema-css.ts).
  css: { postcss: { plugins: [temaManual()] } },
  resolve: resolver,
  // host: true expõe na rede local para testar no celular (o WebSocket vai a <mesmo-host>:2567).
  // /api e /saude passam pelo proxy: o cookie de sessão fica na origem da página.
  server: { port: 5173, host: true, proxy: { '/api': alvoApi, '/saude': alvoApi } },
});
