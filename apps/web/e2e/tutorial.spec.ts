import { devices, expect, test } from '@playwright/test';

// Tutorial (pedido do André, 2026-11-20): na 1ª visita o lobby oferece uma partida guiada; o
// treinador explica o passo do momento e "Pular tutorial" fica sempre na tela.
for (const [nomeTela, uso] of [
  ['390x844', { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }],
  ['1440x900', { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }],
  ['1280x800', { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }],
  ['360x640', { ...devices['Pixel 7'], viewport: { width: 360, height: 640 } }],
] as const) {
  test(`tutorial: 1ª visita, passos guiados e pular quando quiser - ${nomeTela}`, async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ ...uso, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      const convite = page.getByRole('region', { name: 'Primeira vez por aqui?' });
      await expect(convite).toBeVisible();
      await page.getByLabel('Apelido').fill('QA Tutorial');
      await convite.getByRole('button', { name: 'Começar tutorial' }).click();

      const treinador = page.getByRole('complementary', { name: 'Tutorial' });
      await expect(treinador).toBeVisible({ timeout: 15_000 });
      // Sem relógio para quem aprende: a vez não mostra segundos.
      const vistos = new Set<string>();
      const jogavel = page.getByTestId('minha-mao').locator('button.carta-botao:enabled');
      await expect(async () => {
        const passo = (await treinador.getAttribute('data-passo')) ?? '';
        vistos.add(passo);
        // Faz o que o passo pede, como alguém seguindo o treinador.
        for (const nome of ['Passar pra cortar', 'Cortar', 'Por cima']) {
          const b = page.getByRole('button', { name: nome, exact: true });
          if (await b.isVisible()) await b.click({ timeout: 800 }).catch(() => {});
        }
        if (passo === 'primeira-carta' && (await jogavel.count()) > 0) await jogavel.first().click({ timeout: 800 }).catch(() => {});
        expect(vistos.has('primeira-carta')).toBe(true);
      }).toPass({ timeout: 60_000, intervals: [400] });
      expect([...vistos].some((p) => p.startsWith('embaralhar') || p.startsWith('cortar') || p.startsWith('dar'))).toBe(true);
      await expect(page.locator('.barra-acoes, .rodape-mesa')).not.toContainText(/\d+\s?s\b/);

      const foto = testInfo.outputPath(`tutorial-${nomeTela}.png`);
      await page.screenshot({ path: foto });
      await testInfo.attach('tutorial', { path: foto, contentType: 'image/png' });

      // O treinador não pode cobrir as cartas da mão nem a vira, que o texto dele explica.
      const caixa = (await treinador.boundingBox())!;
      const cruza = (r: { x: number; y: number; width: number; height: number }) =>
        caixa.x < r.x + r.width && r.x < caixa.x + caixa.width && caixa.y < r.y + r.height && r.y < caixa.y + caixa.height;
      const cartas = await page.getByTestId('minha-mao').locator('.carta-botao .carta').evaluateAll((els) =>
        els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }),
      );
      for (const r of cartas) expect(cruza(r), 'o treinador cobre uma carta da mão').toBe(false);
      const vira = await page.locator('.vira').first().boundingBox();
      if (vira) expect(cruza(vira), 'o treinador cobre a vira').toBe(false);

      await treinador.getByRole('button', { name: 'Pular tutorial' }).click();
      await expect(treinador).toHaveCount(0);
      // A partida segue normal.
      await expect(page.locator('.tela-mesa')).toBeVisible();
      // Pulado não volta a oferecer na próxima visita.
      expect(await page.evaluate(() => localStorage.getItem('truco:tutorial'))).toBe('pulado');
    } finally {
      await ctx.close();
    }
  });
}
