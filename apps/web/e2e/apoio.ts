import type { Page } from '@playwright/test';

/** A ação padrão de cada etapa: passar sem embaralhar, cortar (até gastar os 3), dar por cima, não conferir. */
const PADRAO = ['Passar pra cortar', 'Cortar', 'Por cima', 'Deixar passar'] as const;

/** Faz a etapa do ritual (ou do conferir) que estiver na tela; true se clicou em algo. */
export async function agirNoRitual(page: Page): Promise<boolean> {
  for (const nome of PADRAO) {
    const b = page.getByRole('button', { name: nome, exact: true });
    if (await b.isVisible()) {
      await b.click({ timeout: 1_000 });
      return true;
    }
  }
  return false;
}
