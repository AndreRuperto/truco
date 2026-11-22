import { devices, expect, test } from '@playwright/test';

// "?" das regras (pedido do André, 2026-11-21): abre a explicação sem estourar a largura, com alvo
// de toque de pelo menos 44 px, e nada entre parênteses nas regras.
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
        expect(Math.min(caixa.width, caixa.height)).toBeGreaterThanOrEqual(44);
      }
      // Sem fundo nos dois temas: só o círculo de giz (no escuro, o fundo dos botões do formulário
      // pintava um disco de 44px em volta do "?").
      for (const tema of ['dark', 'light'] as const) {
        await page.emulateMedia({ colorScheme: tema });
        const fundos = await ajudas.evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
        expect(new Set(fundos), `fundo do "?" no tema ${tema}`).toEqual(new Set(['rgba(0, 0, 0, 0)']));
        // Nem com o mouse em cima.
        if (nomeTela === '1440x900') {
          await ajudas.first().hover();
          expect(await ajudas.first().evaluate((e) => getComputedStyle(e).backgroundColor), `fundo do "?" com hover no tema ${tema}`).toBe('rgba(0, 0, 0, 0)');
          await page.mouse.move(0, 0);
        }
      }
      // Respiro do círculo: pelo menos 8 px até o campo de baixo e 6 px até o texto do rótulo
      // (com a margem negativa de antes, o círculo ficava a 3 px do campo).
      const folgas = await page.evaluate(() =>
        [...document.querySelectorAll('.campo-rotulo')].map((r) => {
          const circ = r.querySelector('.botao-ajuda-regra > span[aria-hidden]')!.getBoundingClientRect();
          const faixa = document.createRange();
          faixa.selectNodeContents(r.querySelector('label, .rotulo-grupo')!);
          // O ritmo é um par de cartões (radiogroup) no lugar do select.
          const campo = r.parentElement!.querySelector('select, [role=radiogroup]')!.getBoundingClientRect();
          return { rotulo: r.textContent, ateOCampo: campo.top - circ.bottom, ladoAoTexto: circ.left - faixa.getBoundingClientRect().right };
        }),
      );
      for (const f of folgas) {
        expect(f.ateOCampo, `${f.rotulo}: espaço entre o "?" e o campo`).toBeGreaterThanOrEqual(8);
        expect(f.ladoAoTexto, `${f.rotulo}: espaço entre o texto e o "?"`).toBeGreaterThanOrEqual(6);
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
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.getByRole('button', { name: 'O que é Variante?' }).click();
      const grade = testInfo.outputPath(`grupos-${nomeTela}.png`);
      await page.locator('details.regras-mesa').screenshot({ path: grade });
      await testInfo.attach('grupos', { path: grade, contentType: 'image/png' });
      await page.getByRole('button', { name: 'O que é Variante?' }).click();
      const foto = testInfo.outputPath(`ajuda-${nomeTela}.png`);
      await page.locator('details.regras-mesa').screenshot({ path: foto });
      await testInfo.attach('ajuda', { path: foto, contentType: 'image/png' });
    } finally {
      await ctx.close();
    }
  });
}
