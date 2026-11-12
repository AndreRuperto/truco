import type { Page } from '@playwright/test';

/** A ação padrão de cada etapa: passar sem embaralhar, cortar (até gastar os 3), dar por cima, não conferir. */
const PADRAO = ['Passar pra cortar', 'Cortar', 'Por cima', 'Deixar passar'] as const;

/**
 * Faz a etapa do ritual (ou do conferir) que estiver na tela; true se clicou em algo.
 * Com várias abas, o botão pode sumir (outro jogador agiu, novo `estado`) entre o
 * `isVisible` e o clique, ou o clique ficar preso: isso conta como "não agiu" e quem
 * chama tenta de novo na próxima volta, em vez de derrubar o teste.
 */
export async function agirNoRitual(page: Page): Promise<boolean> {
  for (const nome of PADRAO) {
    const b = page.getByRole('button', { name: nome, exact: true });
    if (await b.isVisible()) {
      return b
        .click({ timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
    }
  }
  return false;
}

/**
 * Avança até a sua vez com cartas jogáveis e alguma ação (ex.: "Truco!") no rodapé.
 * Se for a sua vez sem ação, espera o botão chegar e, se não vier, joga uma carta para a
 * partida andar. Se a partida acabar antes, começa outra ("Jogar de novo").
 */
export async function ateMinhaVezComAcao(page: Page, timeout = 90_000): Promise<void> {
  const jogavel = page.getByTestId('minha-mao').locator('button.carta-botao:enabled');
  const acao = page.locator('.rodape-mesa .acao:visible');
  const deNovo = page.getByRole('button', { name: 'Jogar de novo' });
  const limite = Date.now() + timeout;
  while (Date.now() < limite) {
    if (await deNovo.isVisible()) await deNovo.click({ timeout: 1_000 }).catch(() => {});
    await agirNoRitual(page).catch(() => false);
    const cartas = await jogavel.count();
    let acoes = await acao.count();
    if (cartas >= 1 && acoes === 0) {
      await page.waitForTimeout(1_000);
      acoes = await acao.count();
      if (acoes === 0) await jogavel.first().click({ timeout: 1_000 }).catch(() => {});
    }
    if (cartas >= 1 && acoes >= 1) return;
    await page.waitForTimeout(400);
  }
  throw new Error('não chegou à sua vez com ação no rodapé a tempo');
}
