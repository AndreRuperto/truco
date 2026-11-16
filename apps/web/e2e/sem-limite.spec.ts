import { expect, test, type Page } from '@playwright/test';
import { agirNoRitual } from './apoio';

/**
 * Mesa privada "sem limite" de tempo por jogada: o dono escolhe nas regras, a sala de espera
 * mostra a todos, e na vez de jogar não há cronômetro nem jogada automática (o prazo normal é
 * de 20 s mesmo com TRUCO_TEMPOS=rapido). Com a vez parada, tira capturas nas viewports do gate
 * (AGENTS.md) e nas vistas personagens, cadeiras e 3D.
 */
const VIEWPORTS = [
  [320, 568], [360, 640], [360, 740], [390, 844], [430, 932], [1280, 800],
] as const;

const jogaveis = (page: Page) => page.getByTestId('minha-mao').locator('button.carta-botao:enabled');

/** Sem limite ninguém age por mim: faço o ritual, aceito truco e jogo a mão de 10 até ter carta para jogar. */
async function ateMinhaVezDeJogar(page: Page, timeout = 120_000): Promise<void> {
  const limite = Date.now() + timeout;
  while (Date.now() < limite) {
    await agirNoRitual(page).catch(() => false);
    for (const nome of ['Aceitar', 'Jogar a mão', 'Sem família']) {
      const b = page.getByRole('button', { name: nome, exact: true });
      if (await b.isVisible().catch(() => false)) await b.click({ timeout: 1_000 }).catch(() => {});
    }
    if ((await jogaveis(page).count()) >= 1) return;
    await page.waitForTimeout(300);
  }
  throw new Error('não chegou à minha vez de jogar');
}

test('mesa privada sem limite de tempo: sem cronômetro e ninguém joga por você', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.getByLabel('Apelido').fill('Sem Pressa');
  await page.getByLabel(/Mesa privada/).check();
  await page.getByText('Regras da mesa', { exact: true }).click();
  await expect(page.getByLabel('Tempo por jogada')).toHaveValue('limite');
  await page.getByLabel('Tempo por jogada').selectOption('semLimite');
  await page.getByLabel('Tempo por jogada').scrollIntoViewIfNeeded();
  const lobby = testInfo.outputPath('lobby-tempo-por-jogada.png');
  await page.screenshot({ path: lobby });
  await testInfo.attach('lobby', { path: lobby, contentType: 'image/png' });
  await page.getByRole('button', { name: 'Criar mesa privada' }).click();

  // Sala de espera: todos que entrarem veem a regra.
  await expect(page.getByLabel('Link de convite')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('list', { name: 'Regras da mesa' })).toContainText('Sem limite de tempo por jogada');
  const espera = testInfo.outputPath('sala-espera-sem-limite.png');
  await page.screenshot({ path: espera, fullPage: true });
  await testInfo.attach('sala-espera', { path: espera, contentType: 'image/png' });
  await page.getByRole('button', { name: 'Começar com bots' }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

  await ateMinhaVezDeJogar(page);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByTestId('etapa')).toHaveText('Sua vez');

  // Bem mais que os 20 s do prazo normal: as cartas continuam na mão, a vez continua minha.
  const antes = await jogaveis(page).count();
  await page.waitForTimeout(23_000);
  expect(await jogaveis(page).count()).toBe(antes);
  await expect(page.getByRole('timer')).toHaveCount(0);

  // Capturas (a vez não acaba sozinha, então dá para trocar viewport e vista à vontade).
  const problemas: string[] = [];
  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    for (const vista of ['personagens', 'cadeiras', '3d'] as const) {
      if (vista === '3d') {
        await page.getByRole('button', { name: '3D', exact: true }).click();
        await expect(page.locator('.tela-mesa')).toHaveAttribute('data-visualizacao', '3d');
      } else {
        await page.getByRole('button', { name: 'Visual da mesa' }).click();
        await page.getByRole('button', { name: vista === 'cadeiras' ? 'Cadeiras (vista de cima)' : 'Personagens', exact: true }).click();
        await expect(page.locator('.tela-mesa')).toHaveAttribute('data-visualizacao', vista);
      }
      await page.waitForTimeout(400);
      const arq = testInfo.outputPath(`mesa-sem-limite-${w}x${h}-${vista}.png`);
      await page.screenshot({ path: arq });
      await testInfo.attach(`mesa-${w}x${h}-${vista}`, { path: arq, contentType: 'image/png' });
      if ((await page.getByRole('timer').count()) > 0) problemas.push(`${w}x${h} ${vista}: cronômetro na tela`);
      const largura = await page.evaluate(() => document.documentElement.scrollWidth);
      if (largura > w + 1) problemas.push(`${w}x${h} ${vista}: rolagem lateral (${largura}px)`);
      if (vista === '3d') await page.getByRole('button', { name: '3D', exact: true }).click();
    }
  }
  expect(problemas).toEqual([]);

  // A jogada vale quando eu quiser.
  await page.setViewportSize({ width: 390, height: 844 });
  await jogaveis(page).first().click();
  await expect.poll(async () => jogaveis(page).count(), { timeout: 10_000 }).toBeLessThan(antes);
});
