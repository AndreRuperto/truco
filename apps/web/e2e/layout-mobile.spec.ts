test('navegação da página inicial mantém ajuda e abas em uma linha no celular', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');

  const menu = page.getByRole('navigation', { name: 'Navegação' });
  await expect(menu).toBeVisible();
  const ajuda = menu.getByRole('link', { name: 'Como jogar' });
  await expect(ajuda).toBeVisible();
  await expect(menu.locator('.cabecalho-tema')).toHaveCount(0);

  const alinhamento = await menu.evaluate((nav) => {
    const elementos = Array.from(nav.children) as HTMLElement[];
    const topo = elementos.map((el) => el.getBoundingClientRect().top);
    return { diferenca: Math.max(...topo) - Math.min(...topo), altura: nav.getBoundingClientRect().height };
  });
  expect(alinhamento.diferenca).toBeLessThan(6);
  expect(alinhamento.altura).toBeLessThan(65);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

import { expect, test } from '@playwright/test';

test('mesa no celular não estica e continua dentro da largura', async ({ page }) => {
  // Aproxima uma viewport Android em retrato, incluindo o espaço da UI do navegador.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.getByLabel('Apelido').fill('Teste Mobile');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();

  const mesa = page.locator('.tela-mesa');
  await expect(mesa).toBeVisible({ timeout: 15_000 });
  const arena = page.locator('.mesa-ambiente');
  await expect(arena).toBeVisible();

  const dimensoes = await arena.boundingBox();
  expect(dimensoes).not.toBeNull();
  expect(dimensoes!.height).toBeLessThanOrEqual(290);
  expect(dimensoes!.width).toBeLessThanOrEqual(360);

  const extravasa = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(extravasa).toBe(false);

  // Os controles da partida não ficam escondidos por overflow.
  await expect(page.getByRole('navigation', { name: 'Menu da mesa' })).toBeVisible();
  await expect(page.locator('.rodape-mesa')).toBeVisible();
  await expect(page.getByTestId('tampo')).toBeVisible();
  await expect(page.locator('.placar-situacao')).toBeVisible();
  const acoes = page.locator('.rodape-mesa');
  await expect(acoes).toBeVisible();
  expect(await acoes.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
});
