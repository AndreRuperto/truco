import { type Browser, devices, expect, type Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { agirNoRitual } from './apoio';

/**
 * Capturas do controle "Jogar coberta" (antes/depois do redesenho de 2026-11-26).
 * Só registra screenshots; não reprova. As asserções ficam em qa-visual-mesa.spec.ts.
 * Rodar sob demanda:
 *   TRUCO_CAPTURAS=antes pnpm exec playwright test e2e/capturas-coberta.spec.ts
 * Saída: docs/qa-frontend/capturas/jogar-coberta/<TRUCO_CAPTURAS>-<viewport>-<vista>-<n>cartas.png
 */
const FASE = process.env.TRUCO_CAPTURAS ?? '';
test.skip(!FASE, 'capturas sob demanda (TRUCO_CAPTURAS=antes|depois)');

// Fora de test-results: o Playwright apaga essa pasta a cada execução.
const SAIDA = join(process.cwd(), '..', '..', 'docs', 'qa-frontend', 'capturas', 'jogar-coberta');
const WEB = 'http://127.0.0.1:5180';

const TAMANHOS = [
  [320, 568, true],
  [360, 640, true],
  [390, 844, true],
  [430, 932, true],
  [1440, 900, false],
] as const;
const VISTAS = ['personagens', 'cadeiras', '3d'] as const;

async function abrir(browser: Browser, largura: number, altura: number, toque: boolean, vista: string): Promise<Page> {
  const base = toque ? devices['Pixel 7'] : devices['Desktop Chrome'];
  const ctx = await browser.newContext({ ...base, viewport: { width: largura, height: altura }, baseURL: WEB });
  await ctx.addInitScript((v) => {
    localStorage.setItem('truco:visualizacao-mesa', v);
    localStorage.setItem('truco:tutorial', 'pulado');
    // Sem as dicas da 1ª partida: o balão cobriria a mão nas capturas.
    localStorage.setItem('truco:dicas', JSON.stringify({ vistas: [], desligadas: true }));
  }, vista);
  return ctx.newPage();
}

/** Avança a partida até a minha vez com `n` cartas jogáveis e o "Jogar coberta" na tela (n=3: sem ele). */
async function ateMao(page: Page, n: number) {
  const coberta = page.getByRole('button', { name: 'Jogar coberta' });
  const jogavel = page.getByTestId('minha-mao').locator('button.carta-botao:enabled');
  const deNovo = page.getByRole('button', { name: 'Jogar de novo' });
  await expect(async () => {
    if (await deNovo.isVisible()) await deNovo.click({ timeout: 1_000 }).catch(() => {});
    await agirNoRitual(page).catch(() => false);
    const cartas = await jogavel.count();
    if (cartas > n) await jogavel.first().click({ timeout: 1_000 }).catch(() => {});
    expect(await jogavel.count()).toBe(n);
    if (n < 3) await expect(coberta).toBeVisible({ timeout: 300 });
  }).toPass({ timeout: 150_000, intervals: [300] });
  await expect.poll(() => page.evaluate(() => Array.from(
    document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta'),
  ).every((c) => c.getAnimations().length === 0))).toBe(true);
  // Distribuição: a mão fica invisível (data-dando~="baixo") até o voo das cartas chegar.
  await expect(page.locator('.tela-mesa[data-dando~="baixo"]')).toHaveCount(0, { timeout: 10_000 });
  await page.waitForTimeout(600);
}

for (const [largura, altura, toque] of TAMANHOS) {
  for (const vista of VISTAS) {
    test(`capturas coberta ${largura}x${altura} ${vista}`, async ({ browser }) => {
      test.setTimeout(300_000);
      mkdirSync(SAIDA, { recursive: true });
      const page = await abrir(browser, largura, altura, toque, vista);
      try {
        await page.goto('/');
        await page.getByLabel('Apelido').fill('QA Coberta');
        await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
        await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
        if (vista === '3d') await page.waitForTimeout(2_000);
        const nome = (n: number) => join(SAIDA, `${FASE}-${largura}x${altura}-${vista}-${n}cartas.png`);
        if (vista === 'personagens') {
          await ateMao(page, 3);
          await page.screenshot({ path: nome(3) });
        }
        await ateMao(page, 2);
        await page.screenshot({ path: nome(2) });
        if (vista === 'personagens') {
          // Ligado: mostra o estado pressionado.
          await page.getByRole('button', { name: 'Jogar coberta' }).click();
          await page.waitForTimeout(250);
          await page.screenshot({ path: join(SAIDA, `${FASE}-${largura}x${altura}-${vista}-2cartas-ligado.png`) });
          await page.getByRole('button', { name: 'Jogar coberta' }).click();
        }
        await ateMao(page, 1).catch(() => {});
        if ((await page.getByTestId('minha-mao').locator('button.carta-botao:enabled').count()) === 1) {
          await page.screenshot({ path: nome(1) });
        }
      } finally {
        await page.context().close();
      }
    });
  }
}
