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
      env: {
        PORT: String(PORTA_SERVIDOR),
        TRUCO_TEMPOS: 'rapido',
        // Banco descartável (PGlite em memória, mesmo se a máquina tiver DATABASE_URL) e caixa
        // de saída de teste (GET /api/teste/emails); os links apontam para o Vite do E2E.
        DATABASE_URL: '',
        TRUCO_PGLITE: 'memoria',
        TRUCO_EMAIL_TESTE: '1',
        // IPs dos clientes simulados chegam pelo proxy do Vite. Só no servidor descartável
        // do E2E; os limites de produção permanecem iguais.
        TRUCO_TRUST_PROXY: '1',
        // Admin só para o E2E das telas (responsividade.spec.ts); conta de teste da caixa de saída.
        ADMIN_EMAILS: 'admin.qa@teste.dev',
        // Loja: o checkout volta pago na hora (nunca cobra; ignorado em produção).
        LOJA_PAGAMENTO: 'simulado',
        TRUCO_URL_PUBLICA: `http://127.0.0.1:${PORTA_WEB}`,
      },
      stdout: 'pipe',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: 'web',
      command: `pnpm exec vite --port ${PORTA_WEB} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PORTA_WEB}`,
      // /api pelo proxy do Vite: o cookie de sessão fica em 127.0.0.1 e vai junto no WebSocket (mesmo host).
      env: { VITE_SERVIDOR: `ws://127.0.0.1:${PORTA_SERVIDOR}`, TRUCO_PROXY_API: `http://127.0.0.1:${PORTA_SERVIDOR}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
