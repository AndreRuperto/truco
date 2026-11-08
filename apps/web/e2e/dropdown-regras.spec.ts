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
