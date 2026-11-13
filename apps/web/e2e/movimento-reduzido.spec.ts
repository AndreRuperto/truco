import { expect, test } from '@playwright/test';
import { agirNoRitual } from './apoio';

/**
 * F3.2 do plano MVP: com `prefers-reduced-motion: reduce`, nada na partida anima por mais de
 * 200 ms (troca instantânea ou fade curto) e a mão termina normalmente. Amostra
 * `document.getAnimations()`, que pega animações CSS, transições e Web Animations (voo das cartas).
 */
const LIMITE_MS = 200;

for (const vista of ['personagens', 'cadeiras'] as const) {
  test(`movimento reduzido: nenhuma animação acima de ${LIMITE_MS} ms e a mão termina - ${vista}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((v) => {
      try { localStorage.setItem('truco:visualizacao-mesa', v); } catch { /* sem armazenamento */ }
    }, vista);
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Reduzido');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

    const longas = new Map<string, number>();
    const amostrar = async () => {
      const achadas = await page.evaluate((limite) => document.getAnimations().map((a) => {
        const t = a.effect?.getComputedTiming();
        const dur = typeof t?.duration === 'number' ? t.duration : 0;
        const total = t?.iterations === Infinity ? Infinity : dur * (t?.iterations ?? 1);
        const alvo = (a.effect as KeyframeEffect | null)?.target as Element | null;
        const nome = 'animationName' in a ? (a as CSSAnimation).animationName
          : 'transitionProperty' in a ? `transição ${(a as CSSTransition).transitionProperty}` : 'Web Animation';
        const onde = alvo ? `${alvo.tagName.toLowerCase()}.${[...alvo.classList].slice(0, 3).join('.')}` : '?';
        return { chave: `${nome} em ${onde}`, total };
      }).filter((x) => x.total > limite), LIMITE_MS);
      for (const a of achadas) longas.set(a.chave, Math.max(longas.get(a.chave) ?? 0, a.total));
    };

    // Joga até a primeira mão terminar (alguém pontua ou o resumo de fim de mão aparece).
    const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
    const fimDeMao = () => page.evaluate(() => {
      const nums = Array.from(document.querySelectorAll('.placar-num')).map((n) => Number(n.textContent?.trim() || 0));
      return nums.some((n) => n > 0) || !!document.querySelector('[data-testid="fim-mao"]');
    });
    const limite = Date.now() + 110_000;
    while (!(await fimDeMao())) {
      if (Date.now() > limite) throw new Error('a mão não terminou a tempo com movimento reduzido');
      await amostrar();
      if (!(await agirNoRitual(page).catch(() => false))) {
        for (const nome of ['Aceitar', 'Jogar a mão', 'Sem família']) {
          const b = page.getByRole('button', { name: nome, exact: true });
          if (await b.isVisible()) { await b.click({ timeout: 800 }).catch(() => {}); break; }
        }
        if (await carta.isVisible()) await carta.click({ timeout: 800 }).catch(() => {});
      }
      await page.waitForTimeout(80);
    }
    await amostrar();
    expect([...longas].map(([k, ms]) => `${k}: ${ms === Infinity ? 'infinita' : Math.round(ms) + ' ms'}`), 'animações longas com movimento reduzido').toEqual([]);
  });
}
