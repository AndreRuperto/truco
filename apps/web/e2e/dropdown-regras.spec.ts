import { expect, test } from '@playwright/test';

test('opção selecionada tem borda em todos os lados no dropdown de regras', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('details.regras-mesa > summary').click();

  const pontuacao = page.getByLabel('Pontuação');
  await expect(pontuacao).toBeVisible();

  // Em navegadores antigos, o select nativo continua funcional sem customização.
  const seletorCustomizavel = await pontuacao.evaluate(() => CSS.supports('appearance', 'base-select'));
  test.skip(!seletorCustomizavel, 'Chromium sem suporte a appearance: base-select');

  for (const cor of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: cor });
    await pontuacao.click();

    const borda = await pontuacao.locator('option:checked').evaluate((option) => {
      const css = getComputedStyle(option);
      return {
        topo: css.borderTopWidth,
        direita: css.borderRightWidth,
        baixo: css.borderBottomWidth,
        esquerda: css.borderLeftWidth,
        corDireita: css.borderRightColor,
        corEsquerda: css.borderLeftColor,
        corTopo: css.borderTopColor,
        corBaixo: css.borderBottomColor,
      };
    });

    expect(borda.topo).toBe('2px');
    expect(borda.direita).toBe('2px');
    expect(borda.baixo).toBe('2px');
    expect(borda.esquerda).toBe('2px');
    expect(borda.corDireita).toBe(borda.corEsquerda);
    expect(borda.corTopo).toBe(borda.corBaixo);
    expect(borda.corTopo).toBe(borda.corDireita);
    await page.keyboard.press('Escape');
  }

  // A correção é só visual; a regra escolhida deve continuar funcionando.
  await pontuacao.selectOption('2-4-8-10-12');
  await expect(pontuacao).toHaveValue('2-4-8-10-12');
});

// Pedido do André (2026-11-16): "Mineiro (manilhas fixas)" quebrava em duas linhas na coluna
// da esquerda. A coluna da esquerda ficou mais larga e recebe as escolhas longas; com folga de
// 16 px (a fonte varia entre máquinas), nenhuma escolha pode quebrar linha.
for (const [largura, altura] of [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [600, 900],
] as const) {
  test(`regras da mesa: escolhas cabem numa linha - ${largura}x${altura}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/');
    await page.locator('details.regras-mesa > summary').click();
    await page.getByLabel('Variante').selectOption('mineiro');
    await page.getByLabel('Família', { exact: true }).selectOption('aberta');
    await page.evaluate(() => document.fonts.ready);
    // Texto da escolha medido com a fonte real contra a área útil do select (sem padding),
    // independente de como cada versão do Chromium desenha o select customizável.
    const medidas = await page.locator('.regras-grade .campo:not(.largo) select').evaluateAll((sels) => {
      const ctx = document.createElement('canvas').getContext('2d')!;
      return sels.map((s) => {
        const css = getComputedStyle(s);
        ctx.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
        const texto = (s as HTMLSelectElement).selectedOptions[0]?.text ?? '';
        const util = s.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
        return { id: s.id, texto, precisa: Math.ceil(ctx.measureText(texto).width), util: Math.floor(util) };
      });
    });
    const foto = testInfo.outputPath(`regras-${largura}x${altura}.png`);
    await page.locator('details.regras-mesa').screenshot({ path: foto });
    await testInfo.attach('regras', { path: foto, contentType: 'image/png' });
    for (const m of medidas) expect(m.precisa, `${m.id}: "${m.texto}" precisa de ${m.precisa}px, cabe ${m.util}px`).toBeLessThanOrEqual(m.util - 16);
  });
}
