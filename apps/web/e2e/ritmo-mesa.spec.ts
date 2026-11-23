import { devices, expect, test } from '@playwright/test';

// Ritmo da mesa (pedido do André, 2026-11-20; nas regras da mesa desde 2026-11-22), e a sala de
// espera conta como a mesa vai ser jogada (ritmo e tempo por jogada).
for (const [nomeTela, uso] of [
  ['320x568', { ...devices['Pixel 7'], viewport: { width: 320, height: 568 } }],
  ['1440x900', { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }],
] as const) {
  test(`ritmo e tempo por jogada escolhidos nas regras da mesa - ${nomeTela}`, async ({ browser }, testInfo) => {
    test.setTimeout(60_000);
    const ctx = await browser.newContext({ ...uso, baseURL: test.info().project.use.baseURL });
    await ctx.addInitScript(() => localStorage.setItem('truco:tutorial', 'pulado'));
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await expect(page.getByRole('radiogroup', { name: 'Ritmo da mesa' })).toBeHidden();
      await page.getByLabel('Apelido').fill('QA Ritmo');
      await page.getByLabel(/Mesa privada/).check();
      await page.getByText('Regras da mesa', { exact: true }).click();
      const grupo = page.getByRole('radiogroup', { name: 'Ritmo da mesa' });
      await expect(grupo).toBeVisible();
      await expect(page.getByRole('radio', { name: /Calmo/ })).toBeChecked();
      await page.getByRole('radio', { name: /Rápido/ }).check();
      await page.getByLabel('Tempo por jogada').selectOption('15');
      await expect(page.locator('details.regras-mesa > summary small')).toContainText('ritmo rápido, 15 s por jogada');
      const lobby = testInfo.outputPath(`lobby-ritmo-${nomeTela}.png`);
      await grupo.scrollIntoViewIfNeeded();
      await page.screenshot({ path: lobby });
      await testInfo.attach('lobby-ritmo', { path: lobby, contentType: 'image/png' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

      await page.getByRole('button', { name: 'Criar mesa privada' }).click();
      await expect(page.getByText('Ritmo rápido')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('15 segundos por jogada')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
}
