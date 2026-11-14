// Avatares da loja redesenhados (prancha "Avatares do boteco"): os seis aparecem desenhados,
// sem rolagem horizontal, do 320×568 ao desktop, no tema claro e no escuro.
import { type Browser, devices, expect, type Page, test } from '@playwright/test';

const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';
const AVATARES = ['avatar-violeiro', 'avatar-garrafa', 'avatar-caramelo', 'avatar-mao', 'avatar-dono', 'avatar-vo'];
const TAMANHOS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 800 },
];

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
  test(`loja: os seis avatares desenhados em todos os tamanhos (${scheme})`, async ({ browser }) => {
    const page = await entrar(browser, `avatares.${scheme}@teste.dev`, scheme, scheme === 'light' ? '192.0.2.90' : '192.0.2.91');
    try {
      for (const t of TAMANHOS) {
        await page.setViewportSize(t);
        await page.goto('/#/loja/avatar');
        const nome = `${t.width}x${t.height} ${scheme}`;
        for (const id of AVATARES) {
          const card = page.getByTestId(`item-${id}`);
          await expect(card, `${id} ${nome}`).toBeVisible();
          // Desenho (svg), não a inicial do apelido.
          await expect(card.locator('.avatar-pronto svg'), `${id} ${nome}`).toHaveCount(1);
        }
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra, nome).toBeLessThanOrEqual(0);
        await page.getByTestId('item-avatar-violeiro').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/avatares-loja-${t.width}x${t.height}-${scheme}.png` });
      }
    } finally {
      await page.context().close();
    }
  });
}
