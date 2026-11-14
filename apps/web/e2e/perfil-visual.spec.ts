// "Seu visual" no Editar perfil: escolher moldura e baralho entre os itens da conta, sem passar pela loja.
import { type Browser, devices, expect, type Page, test } from '@playwright/test';

const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';

async function entrar(browser: Browser, email: string, scheme: 'light' | 'dark', ip: string): Promise<Page> {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], colorScheme: scheme, baseURL: WEB });
  const page = await contexto.newPage();
  // IP próprio para o limite de links mágicos por IP (5 a cada 15 min no servidor).
  await page.route('**/api/auth/**', (r) => r.continue({ headers: { ...r.request().headers(), 'x-forwarded-for': ip } }));
  await page.goto('/#/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText(/Enviamos um link/)).toBeVisible();
  const { emails } = await (await page.request.get(`${API}/api/teste/emails`)).json();
  const link = emails.filter((e: { para: string }) => e.para === email).at(-1).link as string;
  await page.goto(link);
  await expect(page.getByTestId('usuario-logado')).toBeVisible({ timeout: 15_000 });
  return page;
}

for (const scheme of ['light', 'dark'] as const) {
  test(`perfil: escolher moldura e baralho na hora (${scheme})`, async ({ browser }) => {
    // Admins de teste (playwright.config.ts): têm todos os itens.
    const email = `admin.perfil.${scheme === 'light' ? 'claro' : 'escuro'}@teste.dev`;
    const page = await entrar(browser, email, scheme, scheme === 'light' ? '192.0.2.88' : '192.0.2.89');
    try {
      await page.goto('/#/perfil?editar');
      const visual = page.locator('.seu-visual');
      await expect(visual.getByRole('heading', { name: 'Seu visual' })).toBeVisible();
      for (const g of ['Moldura', 'Baralho', 'Roupa', 'Mesa', 'Avatar']) await expect(visual.getByRole('radiogroup', { name: g })).toBeVisible();

      // Moldura: Giz de Lousa vai para o avatar do cabeçalho.
      const moldura = visual.getByRole('radiogroup', { name: 'Moldura' });
      await moldura.getByRole('radio', { name: 'Giz de Lousa' }).check();
      await expect(visual.getByRole('status')).toHaveText('Giz de Lousa equipado.');
      await expect(moldura.getByRole('radio', { name: 'Giz de Lousa' })).toBeChecked();
      await expect(page.getByTestId('usuario-logado').locator('.moldura-giz')).toBeVisible();

      // Baralho: Azulejo vai para o fundo de cartas.
      await visual.getByRole('radiogroup', { name: 'Baralho' }).getByRole('radio', { name: 'Azulejo' }).check();
      await expect(visual.getByRole('status')).toHaveText('Azulejo equipado.');
      await expect(page.getByTestId('fundo-cartas')).toHaveAttribute('data-verso', 'azulejo');

      // Teclado: setas trocam dentro do grupo (rádio nativo).
      await moldura.getByRole('radio', { name: 'Giz de Lousa' }).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(visual.getByRole('status')).toContainText('equipado.');

      for (const t of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 1280, height: 800 },
      ]) {
        await page.setViewportSize(t);
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra, `${t.width}x${t.height}`).toBeLessThanOrEqual(0);
        await visual.screenshot({ path: `test-results/perfil-visual-${t.width}-${scheme}.png` });
      }

      const c = await (await page.request.get(`${WEB}/api/loja/eu`)).json();
      expect(c.equipados.verso).toBe('verso-azulejo');
    } finally {
      await page.context().close();
    }
  });
}
