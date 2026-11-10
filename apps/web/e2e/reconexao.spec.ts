import { expect, type Page, test } from '@playwright/test';
import { agirNoRitual } from './apoio';

/**
 * Ciclo 4 (roadmap 2026-11-09): trocar de app ou perder a rede derruba o WebSocket. Antes, o
 * servidor jogava pela cadeira desconectada no ritmo do bot (em ~1 s, inclusive respondendo
 * truco) e quem voltava encontrava a mão jogada. Agora quem cai tem o mesmo prazo de quem está
 * parado: voltando dentro dele, a vez continua sua, com as mesmas cartas.
 */

const jogaveis = (page: Page) => page.getByTestId('minha-mao').locator('button.carta-botao:enabled');

/** Avança o ritual até ser a minha vez de jogar carta. */
async function ateMinhaVez(page: Page) {
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    await agirNoRitual(page).catch(() => false);
    if ((await jogaveis(page).count()) > 0) return;
    await page.waitForTimeout(250);
  }
  throw new Error('não chegou à minha vez a tempo');
}

const minhaMao = (page: Page) =>
  page.getByTestId('minha-mao').locator('button.carta-botao').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label')));

test('cair na própria vez e voltar dentro do prazo: a vez e as cartas continuam suas', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Volta');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
  await ateMinhaVez(page);
  const antes = await minhaMao(page);
  expect(antes.length).toBeGreaterThan(0);

  // Rede fora por 8 s: bem mais que o ritmo do bot, bem menos que o prazo de 20 s da jogada.
  await context.setOffline(true);
  await expect(page.getByText('Recuperando sua mesa e sua cadeira…')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(8_000);
  await context.setOffline(false);

  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
  await expect(jogaveis(page).first()).toBeVisible({ timeout: 10_000 });
  expect(await minhaMao(page), 'o servidor jogou pela cadeira desconectada').toEqual(antes);

  // E a jogada feita por quem voltou é aceita.
  await jogaveis(page).first().click();
  await expect.poll(async () => (await minhaMao(page)).length, { timeout: 10_000 }).toBeLessThan(antes.length);
});
