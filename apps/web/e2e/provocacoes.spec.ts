import { expect, type Page, test } from '@playwright/test';

/** Provocações com a moldura: provocar um bot na mesa real, nas vistas personagens e cadeiras. */
const TELAS = [
  [390, 844],
  [1280, 800],
] as const;
const VISTAS = ['personagens', 'cadeiras'] as const;

async function mesaComBots(page: Page, vista: string, nome: string) {
  await page.addInitScript((v) => localStorage.setItem('truco:visualizacao-mesa', v), vista);
  await page.goto('/');
  await page.getByLabel('Apelido').fill(nome);
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
}

for (const [w, h] of TELAS) {
  for (const vista of VISTAS) {
    test(`provocar um bot (guardanapo de quem não tem moldura) - ${vista} ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await mesaComBots(page, vista, 'Provocador');
      // Direita e esquerda são as que podiam passar da borda da tela.
      const alvo = page.getByTestId('assento-direita');
      await alvo.getByRole('button', { name: /: provocar$/ }).click();
      const botao = alvo.getByRole('button', { name: 'Provocar', exact: true });
      await expect(botao).toBeVisible();
      // O botão cabe na tela (não é cortado na borda).
      const b = (await botao.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(w);
      expect(b.height).toBeGreaterThanOrEqual(44);
      await botao.click();
      const efeito = alvo.getByTestId('provocacao');
      await expect(efeito).toHaveAttribute('data-efeito', 'guardanapo');
      await expect(efeito).toBeHidden({ timeout: 4_000 });
      // Recarga de 8 s: o botão volta desligado.
      await alvo.getByRole('button', { name: /: provocar$/ }).click();
      await expect(alvo.getByRole('button', { name: 'Provocar (recarregando)', exact: true })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const esquerda = page.getByTestId('assento-esquerda');
      await esquerda.getByRole('button', { name: /: provocar$/ }).click();
      const e = (await esquerda.getByRole('button', { name: /^Provocar/ }).boundingBox())!;
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x + e.width).toBeLessThanOrEqual(w);
    });
  }
}

test('mesa com provocações desligadas: o nome não vira botão', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Regras da mesa', { exact: true }).click();
  await page.getByLabel('Apelido').fill('Sem Provocar');
  await page.getByLabel(/^Provocações/).uncheck();
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('assento-direita').getByRole('button', { name: /: provocar$/ })).toHaveCount(0);
});
