import { expect, test } from '@playwright/test';
import { agirNoRitual } from './apoio';

test('1 humano + 3 bots fáceis jogam até o fim da partida', async ({ page }) => {
  await page.goto('/');
  // As regras ficam num <details> recolhido no celular.
  await page.getByText('Regras da mesa', { exact: true }).click();
  await page.getByLabel('Apelido').fill('Teste E2E');
  await page.getByLabel('Variante').selectOption('paulista');
  await page.getByLabel('Humanos').selectOption('1');
  await page.getByLabel('Bots').selectOption('facil');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();

  const fim = page.getByTestId('fim-partida');
  const aceitar = page.getByRole('button', { name: 'Aceitar', exact: true });
  const jogarMao = page.getByRole('button', { name: 'Jogar a mão', exact: true });
  const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });

  let maos = 0;
  let viuFimDeMao = false;
  const limite = Date.now() + 280_000;
  while (!(await fim.isVisible())) {
    if (Date.now() > limite) throw new Error(`a partida não terminou a tempo (${maos} cliques)`);
    try {
      // Sempre a primeira ação disponível: aceitar truco > jogar a mão de 10 > etapa do ritual > primeira carta jogável.
      if (await aceitar.isVisible()) await aceitar.click({ timeout: 1_000 });
      else if (await jogarMao.isVisible()) await jogarMao.click({ timeout: 1_000 });
      else if (await agirNoRitual(page)) {
        // etapa do ritual feita
      } else if (await carta.isVisible()) {
        await carta.click({ timeout: 1_000 });
        maos++;
      } else if (!viuFimDeMao && (await page.getByTestId('fim-mao').isVisible())) {
        // Entre mãos o centro continua com as cartas da última rodada.
        viuFimDeMao = (await page.getByTestId('centro').locator('.carta.esmaecida').count()) > 0;
      }
      await page.waitForTimeout(150);
    } catch {
      // a tela mudou entre a checagem e o clique (estado novo chegou): tenta de novo
    }
  }

  await expect(fim).toContainText(/Vitória!|Derrota/);
  expect(viuFimDeMao).toBe(true);
  // "Jogar de novo" abre outra partida com as mesmas regras, placar zerado.
  await page.getByRole('button', { name: 'Jogar de novo' }).click();
  await expect(page.getByTestId('fim-partida')).toHaveCount(0);
  await expect(page.getByRole('group', { name: /^Placar: Nós 0, Eles 0/ })).toBeVisible({ timeout: 15_000 });
});
