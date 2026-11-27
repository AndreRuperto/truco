import { defineConfig } from 'vitest/config';
import { resolver } from './vite-resolve';

// Vitest 2 usa Vite 5 internamente; não importa plugins tipados pelo Vite 6 do build.
export default defineConfig({
  resolve: resolver,
  esbuild: { jsx: 'automatic' },
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
