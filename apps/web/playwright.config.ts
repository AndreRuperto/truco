import { defineConfig, devices } from '@playwright/test';

// Portas próprias: o dev usa 2567/5173 e o @colyseus/testing dos testes do server usa 2568.
const PORTA_SERVIDOR = 2570;
const PORTA_WEB = 5180;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 300_000,
  use: { baseURL: `http://127.0.0.1:${PORTA_WEB}`, trace: 'retain-on-failure' },
  // Largura de celular: é o layout principal.
  projects: [{ name: 'celular', use: { ...devices['Pixel 7'] } }],
  // O `env` de cada webServer é somado ao process.env (PATH etc. continuam valendo) — conferido
  // no WebServerPlugin do playwright 1.63: `{ ...DEFAULT_ENVIRONMENT_VARIABLES, ...process.env, ...env }`.
  webServer: [
    {
      name: 'server',
      command: 'pnpm --filter @truco/server start',
      port: PORTA_SERVIDOR,
      env: { PORT: String(PORTA_SERVIDOR), TRUCO_TEMPOS: 'rapido' },
      stdout: 'pipe',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: 'web',
      command: `pnpm exec vite --port ${PORTA_WEB} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PORTA_WEB}`,
      env: { VITE_SERVIDOR: `ws://127.0.0.1:${PORTA_SERVIDOR}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
