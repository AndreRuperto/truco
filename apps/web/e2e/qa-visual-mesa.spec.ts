import { expect, test } from '@playwright/test';

/**
 * QA visual do Truco: detectar mesa minúscula, altura rígida incompatível
 * com o CSS mobile, overflow lateral e perda de controles na vista superior.
 *
 * Screenshots são capturados antes das assertivas para investigar falhas.
 * A inspeção estética humana/visual continua necessária.
 */
const cenarios = [
  { largura: 320, altura: 568, minimo: 0.42, maximo: 0.75 },
  { largura: 360, altura: 640, minimo: 0.42, maximo: 0.72 },
  { largura: 360, altura: 740, minimo: 0.48, maximo: 0.70 },
  { largura: 390, altura: 844, minimo: 0.48, maximo: 0.70 },
  { largura: 430, altura: 932, minimo: 0.48, maximo: 0.70 },
];

for (const { largura, altura, minimo, maximo } of cenarios) {
  test('arena aproveita eixo Y sem overflow - ' + largura + 'x' + altura, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Visual');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();

    const tela = page.locator('.tela-mesa');
    const arena = page.locator('.mesa-ambiente');
    await expect(tela).toBeVisible({ timeout: 15_000 });
    await expect(arena).toBeVisible();

    // Captura real; teste pode falhar depois, preservando evidência.
    const normal = testInfo.outputPath('mesa-' + largura + 'x' + altura + '-personagens.png');
    await page.screenshot({ path: normal, fullPage: true });
    await testInfo.attach('mesa-personagens', { path: normal, contentType: 'image/png' });

    const caixa = await arena.boundingBox();
    expect(caixa).not.toBeNull();
    const usoY = caixa!.height / altura;
    expect(usoY, 'arena muito pequena no eixo Y').toBeGreaterThanOrEqual(minimo);
    expect(usoY, 'arena alta demais no eixo Y').toBeLessThanOrEqual(maximo);

    const larguraDocumento = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(larguraDocumento, 'documento excede largura da viewport').toBeLessThanOrEqual(largura + 1);
    await expect(page.getByRole('navigation', { name: 'Menu da mesa' })).toBeVisible();
    await expect(page.locator('.rodape-mesa')).toBeVisible();

    // A escolha de visualização não deve quebrar a geometria da mesa.
    await page.getByRole('button', { name: 'Visual da mesa' }).click();
    await page.getByRole('button', { name: 'Cadeiras (vista de cima)' }).click();
    await expect(tela).toHaveAttribute('data-visualizacao', 'cadeiras');
    await expect(arena).toBeVisible();

    const cadeiras = testInfo.outputPath('mesa-' + largura + 'x' + altura + '-cadeiras.png');
    await page.screenshot({ path: cadeiras, fullPage: true });
    await testInfo.attach('mesa-cadeiras', { path: cadeiras, contentType: 'image/png' });

    const areaCadeiras = await arena.boundingBox();
    expect(areaCadeiras).not.toBeNull();
    expect(areaCadeiras!.height / altura).toBeGreaterThanOrEqual(minimo);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(largura + 1);
    await expect(page.locator('.rodape-mesa')).toBeVisible();
  });
}
