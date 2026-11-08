import { expect, test } from '@playwright/test';

/** Regressão mobile: navegação nunca deve ficar fora da tela. */
for (const largura of [320, 360, 390, 430]) {
  test(`cabeçalho cabe na tela de ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 740 });
    await page.goto('/#/');
    const cabecalho = page.getByRole('navigation', { name: 'Navegação' });
    await expect(cabecalho).toBeVisible();
    for (const nome of ['Início', 'Salas', 'Ranking', 'Como jogar']) {
      const link = cabecalho.getByRole('link', { name: nome });
      await expect(link).toBeVisible();
      const caixa = await link.boundingBox();
      expect(caixa, `sem caixa para ${nome}`).not.toBeNull();
      expect(caixa!.x, `${nome} fora à esquerda`).toBeGreaterThanOrEqual(-1);
      expect(caixa!.x + caixa!.width, `${nome} fora à direita`).toBeLessThanOrEqual(largura + 1);
    }
  });
}
