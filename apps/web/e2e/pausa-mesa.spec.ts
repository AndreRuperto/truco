// Pausar a mesa sozinho contra bots: o jogo para (o servidor não manda nada), o menu de cima
// continua usável e "Continuar" volta a partida. Do 320×568 ao desktop.
import { devices, expect, type Page, test } from '@playwright/test';

const TAMANHOS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

/** Conta as mensagens que o servidor manda pelo WebSocket da mesa. */
function contarMensagens(page: Page) {
  const c = { n: 0 };
  page.on('websocket', (ws) => ws.on('framereceived', () => c.n++));
  return c;
}

for (const t of TAMANHOS) {
  test(`pausar contra bots: para tudo e o Continuar volta - ${t.width}x${t.height}`, async ({ browser }, testInfo) => {
    test.setTimeout(90_000);
    const ctx = await browser.newContext({ ...(t.width < 768 ? devices['Pixel 7'] : devices['Desktop Chrome']), viewport: t, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    try {
      const mensagens = contarMensagens(page);
      await page.goto('/');
      await page.getByLabel('Apelido').fill('QA Pausa');
      await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
      await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

      const pausar = page.getByRole('button', { name: 'Pausar' });
      await expect(pausar).toBeVisible({ timeout: 15_000 });
      await pausar.click();
      const aviso = page.getByRole('dialog', { name: 'Mesa pausada' });
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(/Volta sozinha em \d+:\d\d/);
      const continuar = aviso.getByRole('button', { name: 'Continuar' });
      await expect(continuar).toBeFocused();
      await expect(pausar).toBeHidden();

      // Parado: em 3 s o servidor não manda nada (no E2E os bots jogam a cada 60 ms).
      await page.waitForTimeout(500);
      const antes = mensagens.n;
      await page.waitForTimeout(3_000);
      expect(mensagens.n - antes, 'mensagens do servidor com a mesa pausada').toBe(0);

      const g = await page.evaluate(() => {
        const caixa = document.querySelector('.mesa-pausada-caixa')!.getBoundingClientRect();
        const sair = document.querySelector('.barra-mesa [aria-label="Sair"]')!.getBoundingClientRect();
        const noSair = document.elementFromPoint(sair.left + sair.width / 2, sair.top + sair.height / 2);
        return {
          dentro: caixa.left >= 0 && caixa.right <= innerWidth && caixa.top >= 0 && caixa.bottom <= innerHeight,
          sobraX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          sairClicavel: !!noSair?.closest('[aria-label="Sair"]'),
        };
      });
      const foto = testInfo.outputPath(`mesa-pausada-${t.width}x${t.height}.png`);
      await page.screenshot({ path: foto });
      await testInfo.attach('mesa-pausada', { path: foto, contentType: 'image/png' });
      expect(g.dentro, 'aviso fora da tela').toBe(true);
      expect(g.sobraX, 'rolagem horizontal').toBeLessThanOrEqual(0);
      expect(g.sairClicavel, 'o Sair do menu ficou coberto pelo aviso').toBe(true);

      await page.keyboard.press('Enter');
      await expect(aviso).toBeHidden();
      await expect(pausar).toBeVisible();
      const depois = mensagens.n;
      await expect.poll(() => mensagens.n - depois, { message: 'a partida não voltou a andar', timeout: 10_000 }).toBeGreaterThan(0);
    } finally {
      await ctx.close();
    }
  });
}
