import { devices, expect, test } from '@playwright/test';
import { SEM_VISITA } from './apoio';

// Tour da 1ª visita (pedido do André, 2026-11-22): o lobby destaca uma coisa de cada vez e
// escurece o resto; o balão explica sem cobrir o destaque e sem sair da tela; Esc ou "Pular" fecham.
type R = { x: number; y: number; width: number; height: number };
const cruza = (a: R, b: R) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const contem = (fora: R, dentro: R) =>
  fora.x <= dentro.x + 0.5 && fora.y <= dentro.y + 0.5 && fora.x + fora.width >= dentro.x + dentro.width - 0.5 && fora.y + fora.height >= dentro.y + dentro.height - 0.5;

for (const [nomeTela, uso] of [
  ['320x568', { ...devices['Pixel 7'], viewport: { width: 320, height: 568 } }],
  ['360x640', { ...devices['Pixel 7'], viewport: { width: 360, height: 640 } }],
  ['360x740', { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } }],
  ['390x844', { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }],
  ['430x932', { ...devices['Pixel 7'], viewport: { width: 430, height: 932 } }],
  ['1440x900', { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }],
] as const) {
  test(`tour da 1ª visita - ${nomeTela}`, async ({ browser }, testInfo) => {
    test.setTimeout(90_000);
    const ctx = await browser.newContext({ ...uso, baseURL: test.info().project.use.baseURL, storageState: SEM_VISITA });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      const tour = page.getByRole('dialog');
      await expect(tour).toBeVisible();
      const titulos: string[] = [];
      for (let passo = 1; ; passo++) {
        // Espera o destaque assentar no alvo (rolagem e transição).
        await expect(async () => {
          const [alvo, destaque] = await Promise.all([page.locator('[data-tour-ativo]').boundingBox(), page.locator('.tour-destaque').boundingBox()]);
          expect(contem(destaque!, alvo!)).toBe(true);
        }).toPass({ timeout: 5_000 });
        const titulo = (await tour.locator('h2').textContent())!;
        titulos.push(titulo);
        const alvo = (await page.locator('[data-tour-ativo]').boundingBox())!;
        const balao = (await tour.boundingBox())!;
        const tela = page.viewportSize()!;
        expect(alvo.y >= 0 && alvo.y + alvo.height <= tela.height, `${titulo}: destaque dentro da tela`).toBe(true);
        expect(balao.x >= 0 && balao.y >= 0 && balao.x + balao.width <= tela.width && balao.y + balao.height <= tela.height, `${titulo}: balão dentro da tela`).toBe(true);
        expect(cruza(balao, alvo), `${titulo}: o balão cobre o destaque`).toBe(false);
        // O resto da tela não responde: no meio do destaque, quem recebe o toque é a tampa.
        const porCima = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className ?? '', { x: alvo.x + alvo.width / 2, y: alvo.y + alvo.height / 2 });
        expect(porCima, `${titulo}: toque fora do balão`).toContain('tour-tampa');
        // O cabeçalho (Início, Salas…) também fica embaixo da tampa.
        const noTopo = await page.evaluate(() => document.elementFromPoint(window.innerWidth / 2, 4)?.className ?? '');
        if (alvo.y > 60) expect(noTopo, `${titulo}: cabeçalho fora da tampa`).toContain('tour-tampa');
        expect(await tour.evaluate((d) => d.contains(document.activeElement))).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        const foto = testInfo.outputPath(`tour-${nomeTela}-${passo}.png`);
        await page.screenshot({ path: foto });
        await testInfo.attach(`tour-${passo}`, { path: foto, contentType: 'image/png' });
        const proximo = tour.getByRole('button', { name: 'Próximo' });
        if (!(await proximo.isVisible())) break;
        await proximo.click();
      }
      expect(titulos).toEqual(['Jogar agora', 'Regras da mesa', 'Mesa privada', 'Primeira vez por aqui?']);
      await tour.getByRole('button', { name: 'Agora não' }).click();
      await expect(tour).toBeHidden();
      await page.reload();
      await expect(page.getByRole('button', { name: 'Jogar agora' })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
}

test('tour: Esc fecha, o foco não escapa do balão, e o tema claro também escurece', async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL, storageState: SEM_VISITA, colorScheme: 'light' });
  const page = await ctx.newPage();
  try {
    await page.goto('/');
    const tour = page.getByRole('dialog');
    await expect(tour.getByRole('button', { name: 'Próximo' })).toBeFocused();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await tour.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    const sombra = await page.locator('.tour-destaque').evaluate((e) => getComputedStyle(e).boxShadow);
    // A cor da --sombra a 78% (o Chromium devolve color(srgb …) por causa do color-mix).
    expect(sombra).toMatch(/0\.0431\d* 0\.0313\d* 0\.0235\d* \/ 0\.78\)/);
    await page.keyboard.press('Escape');
    await expect(tour).toBeHidden();
    await expect(page.getByRole('button', { name: 'Tutorial' })).toBeVisible();
  } finally {
    await ctx.close();
  }
});

// Mudanças de layout sem resize da janela também devem atualizar o recorte.
test('tour acompanha mudança de geometria do alvo', async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL, storageState: SEM_VISITA });
  try {
    const page = await ctx.newPage();
    await page.goto('/');
    const alvo = page.locator('[data-tour-ativo]');
    await expect(alvo).toBeVisible();
    await alvo.evaluate(el => { (el as HTMLElement).style.transform = 'translateX(24px)'; });
    await expect(async () => {
      const [a, d] = await Promise.all([alvo.boundingBox(), page.locator('.tour-destaque').boundingBox()]);
      expect(a && d && contem(d, a)).toBeTruthy();
    }).toPass({ timeout: 5_000 });
  } finally {
    await ctx.close();
  }
});
