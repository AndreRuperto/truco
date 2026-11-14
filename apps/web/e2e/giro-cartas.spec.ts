// Duplo clique em qualquer ponto onde uma carta do fundo está desenhada faz ela girar (ou, com
// movimento reduzido, virar na hora). Antes: com movimento reduzido nada acontecia.
import { expect, type Page, test } from '@playwright/test';

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Para cada carta, 3 pontos sobre o desenho dela (onde ela é a de cima e não há controle): conta os que reagem. */
async function sondar(page: Page): Promise<{ ok: number; total: number; falhas: string[] }> {
  const n = await page.locator('[data-solta]').count();
  let ok = 0;
  let total = 0;
  const falhas: string[] = [];
  for (let i = 0; i < n; i++) {
    for (const [fx, fy] of [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]]) {
      const pt = await page.evaluate(({ i, fx, fy }) => {
        const r = document.querySelectorAll('[data-solta]')[i].querySelector('.carta')!.getBoundingClientRect();
        return { x: r.left + r.width * fx, y: r.top + r.height * fy };
      }, { i, fx, fy });
      const vw = page.viewportSize()!;
      if (pt.x < 3 || pt.x > vw.width - 3 || pt.y < 75 || pt.y > vw.height - 3) continue;
      await page.mouse.move(pt.x, pt.y);
      await page.waitForTimeout(450);
      const alvo = await page.evaluate(({ x, y }) => {
        const topo = document.elementFromPoint(x, y);
        if (topo && !topo.closest('.fundo-cartas') && topo.closest('form, button, a, input, select, textarea, summary, label')) return -1;
        const st = document.createElement('style');
        st.textContent = '.fundo-cartas .carta{pointer-events:auto!important}';
        document.head.append(st);
        const el = document.elementsFromPoint(x, y).find((e) => e.closest('[data-solta]'))?.closest('[data-solta]');
        st.remove();
        return el ? [...document.querySelectorAll('[data-solta]')].indexOf(el) : -1;
      }, pt);
      if (alvo < 0) continue;
      total++;
      await page.evaluate(() =>
        document.querySelectorAll('.carta-solta-gira').forEach((g) => {
          g.getAnimations().forEach((a) => a.cancel());
          g.classList.remove('outro-lado');
        }),
      );
      await page.mouse.dblclick(pt.x, pt.y);
      const reagiu = await page.evaluate((a) => {
        const g = document.querySelectorAll('.carta-solta-gira')[a];
        return g.getAnimations().length > 0 || g.classList.contains('outro-lado');
      }, alvo);
      if (reagiu) ok++;
      else falhas.push(`carta ${alvo} (${fx},${fy})`);
    }
  }
  return { ok, total, falhas };
}

for (const movimento of ['no-preference', 'reduce'] as const) {
  test(`duplo clique em qualquer ponto de uma carta do fundo (${movimento === 'reduce' ? 'movimento reduzido' : 'com movimento'})`, async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: 590, height: 850 }, reducedMotion: movimento, baseURL: 'http://127.0.0.1:5180' });
    const page = await contexto.newPage();
    try {
      await page.addInitScript((d) => localStorage.setItem('truco:cartas-dadas-em', d), hoje());
      await page.goto('/#/');
      await expect(page.getByTestId('fundo-cartas')).toBeVisible();
      const r = await sondar(page);
      expect(r.total).toBeGreaterThanOrEqual(10);
      expect(r.falhas).toEqual([]);
    } finally {
      await contexto.close();
    }
  });
}
