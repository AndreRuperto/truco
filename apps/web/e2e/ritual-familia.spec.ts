import { expect, test } from '@playwright/test';
import { agirNoRitual } from './apoio';

test('ritual completo e família fechada conferida', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Regras da mesa', { exact: true }).click();
  await page.getByLabel('Apelido').fill('Ritual E2E');
  await page.getByLabel('Variante').selectOption('mineiro');
  await page.getByLabel('Família').selectOption('fechada');
  await page.getByLabel('Humanos').selectOption('1');
  await page.getByLabel('Bots').selectOption('facil');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();

  const monte = page.getByTestId('monte');
  await expect(monte).toBeVisible({ timeout: 15_000 });
  await expect(monte).toHaveAccessibleName(/^Monte com \d+ cartas$/);

  const pedir = page.getByRole('button', { name: 'Pedir família fechada', exact: true });
  const aceitar = page.getByRole('button', { name: 'Aceitar', exact: true });
  const jogarMao = page.getByRole('button', { name: 'Jogar a mão', exact: true });
  const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
  const etapa = page.getByTestId('etapa');
  const conferida = page.getByTestId('familia-conferida').first();
  const limite = Date.now() + 150_000;
  let pedidos = 0;
  let viuEtapa = false;
  while (!(await conferida.isVisible())) {
    if (Date.now() > limite) throw new Error(`nenhuma família conferida (${pedidos} pedidos)`);
    try {
      viuEtapa ||= ((await etapa.textContent({ timeout: 1_000 })) ?? '').trim() !== '';
      // Na janela, pede (a 2ª da mesma mão os bots conferem); senão, ritual > truco > mão de 10 > carta.
      if (await pedir.isVisible()) {
        await pedir.click({ timeout: 1_000 });
        pedidos++;
      } else if (await agirNoRitual(page)) {
        // etapa padrão feita
      } else if (await aceitar.isVisible()) await aceitar.click({ timeout: 1_000 });
      else if (await jogarMao.isVisible()) await jogarMao.click({ timeout: 1_000 });
      else if (await carta.isVisible()) await carta.click({ timeout: 1_000 });
      await page.waitForTimeout(100);
    } catch {
      // a tela mudou entre a checagem e o clique
    }
  }

  expect(viuEtapa).toBe(true);
  await expect(conferida).toContainText(/conferiu: era (família|blefe)! \+2 pra (nós|eles)/);
  await expect(conferida.locator('.carta:not(.verso)')).toHaveCount(3);
});
