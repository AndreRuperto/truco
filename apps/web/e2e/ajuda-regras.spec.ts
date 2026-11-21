import { devices, expect, test } from '@playwright/test';

// "?" das regras (pedido do André, 2026-11-21): abre a explicação sem estourar a largura, com alvo
// de toque de pelo menos 24 px, e nada entre parênteses nas regras.
for (const [nomeTela, uso] of [
  ['320x568', { ...devices['Pixel 7'], viewport: { width: 320, height: 568 } }],
  ['390x844', { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }],
  ['1440x900', { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }],
] as const) {
  test(`"?" das regras da mesa - ${nomeTela}`, async ({ browser }, testInfo) => {
    const ctx = await browser.newContext({ ...uso, baseURL: test.info().project.use.baseURL });
    await ctx.addInitScript(() => localStorage.setItem('truco:tutorial', 'pulado'));
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await page.locator('details.regras-mesa > summary').click();
      const ajudas = page.locator('.botao-ajuda-regra');
      expect(await ajudas.count()).toBeGreaterThanOrEqual(12);
      for (const caixa of await ajudas.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0))) {
        expect(Math.min(caixa.width, caixa.height)).toBeGreaterThanOrEqual(24);
      }
      const textos = await page.locator('.regras-grade label, .regras-grade option').allTextContents();
      expect(textos.filter((t) => /[()]/.test(t))).toEqual([]);

      await page.getByRole('button', { name: 'O que é Variante?' }).click();
      await expect(page.locator('#ajuda-variante')).toBeVisible();
      await page.getByRole('button', { name: 'O que é Provocações?' }).click();
      await expect(page.locator('#ajuda-variante')).toHaveCount(0);
      await expect(page.locator('#ajuda-provocacoes')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await page.getByRole('button', { name: 'O que é Variante?' }).click();
      await page.locator('details.regras-mesa').scrollIntoViewIfNeeded();
      const foto = testInfo.outputPath(`ajuda-${nomeTela}.png`);
      await page.locator('details.regras-mesa').screenshot({ path: foto });
      await testInfo.attach('ajuda', { path: foto, contentType: 'image/png' });
    } finally {
      await ctx.close();
    }
  });
}
