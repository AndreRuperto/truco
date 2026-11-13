import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agirNoRitual } from './apoio';

/**
 * F3.6 do plano MVP: desempenho da mesa com a CPU 4x mais lenta (CDP), perfil Pixel 7, uma mão
 * inteira nas vistas personagens e 3D. Mede tarefas longas (PerformanceObserver 'longtask'), o
 * maior intervalo entre quadros (requestAnimationFrame) e o FPS médio. Metas do plano: 2D sem
 * quadro acima de 100 ms durante a mão; 3D com média >= 30 FPS.
 * Sob demanda (registra números): TRUCO_AUDITORIA=1 pnpm exec playwright test e2e/auditoria-desempenho.spec.ts
 */
test.skip(!process.env.TRUCO_AUDITORIA, 'auditoria sob demanda (TRUCO_AUDITORIA=1)');

const SAIDA = join(process.cwd(), 'test-results', 'auditoria-desempenho');

for (const vista of ['personagens', '3d'] as const) {
  test(`desempenho com CPU 4x mais lenta - ${vista}`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.addInitScript((v) => {
      try { localStorage.setItem('truco:visualizacao-mesa', v); } catch { /* sem armazenamento */ }
      // Coleta desde o carregamento: tarefas longas e intervalos entre quadros.
      const w = window as unknown as { __perf: { longas: number[]; quadros: number[]; medindo: boolean } };
      w.__perf = { longas: [], quadros: [], medindo: false };
      try {
        new PerformanceObserver((l) => { if (w.__perf.medindo) for (const e of l.getEntries()) w.__perf.longas.push(e.duration); })
          .observe({ type: 'longtask', buffered: false });
      } catch { /* sem suporte */ }
      let ultimo = 0;
      const quadro = (t: number) => {
        if (w.__perf.medindo && ultimo) w.__perf.quadros.push(t - ultimo);
        ultimo = t;
        requestAnimationFrame(quadro);
      };
      requestAnimationFrame(quadro);
    }, vista);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Desempenho');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 30_000 });
    if (vista === '3d') await expect(page.locator('.mesa-3d-cena[data-pronta]')).toBeVisible({ timeout: 60_000 });
    await page.evaluate(() => { (window as unknown as { __perf: { medindo: boolean } }).__perf.medindo = true; });

    // Uma mão inteira: ritual, distribuir e jogar até alguém pontuar.
    const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
    const fim = () => page.evaluate(() => Array.from(document.querySelectorAll('.placar-num')).some((n) => Number(n.textContent?.trim() || 0) > 0) || !!document.querySelector('[data-testid="fim-mao"]'));
    const limite = Date.now() + 180_000;
    while (!(await fim())) {
      if (Date.now() > limite) throw new Error('a mão não terminou a tempo');
      if (!(await agirNoRitual(page).catch(() => false))) {
        for (const nome of ['Aceitar', 'Jogar a mão', 'Sem família']) {
          const b = page.getByRole('button', { name: nome, exact: true });
          if (await b.isVisible()) { await b.click({ timeout: 1_500 }).catch(() => {}); break; }
        }
        if (await carta.isVisible()) await carta.click({ timeout: 1_500 }).catch(() => {});
      }
      await page.waitForTimeout(150);
    }
    const r = await page.evaluate(() => {
      const p = (window as unknown as { __perf: { longas: number[]; quadros: number[] } }).__perf;
      const q = [...p.quadros].sort((a, b) => a - b);
      const media = q.length ? q.reduce((s, x) => s + x, 0) / q.length : 0;
      const pct = (f: number) => (q.length ? q[Math.min(q.length - 1, Math.floor(q.length * f))] : 0);
      return {
        quadros: q.length,
        fpsMedio: media ? 1000 / media : 0,
        quadroP95: pct(0.95),
        maiorQuadro: q.at(-1) ?? 0,
        quadrosAcima100: q.filter((x) => x > 100).length,
        tarefasLongas: p.longas.length,
        maiorTarefa: Math.max(0, ...p.longas),
      };
    });
    mkdirSync(SAIDA, { recursive: true });
    writeFileSync(join(SAIDA, `${vista}.json`), JSON.stringify(r, null, 2));
    await testInfo.attach(`desempenho-${vista}`, { body: JSON.stringify(r, null, 2), contentType: 'application/json' });
    console.log(`DESEMPENHO ${vista} ${JSON.stringify(r)}`);
  });
}
