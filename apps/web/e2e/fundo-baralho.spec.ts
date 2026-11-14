// O baralho equipado na loja aparece nas cartas do fundo da tela inicial (as viradas mostram o verso).
import { type Browser, devices, expect, type Page, test } from '@playwright/test';

const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';

async function entrar(browser: Browser, email: string, scheme: 'light' | 'dark', ip: string): Promise<Page> {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], colorScheme: scheme, reducedMotion: 'reduce', baseURL: WEB });
  const page = await contexto.newPage();
  // IP próprio para o limite de links mágicos por IP (5 a cada 15 min no servidor), como em contraste.spec.ts.
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

/** Fundo do verso de uma carta virada do fundo (o que se vê na tela). */
const fundoDoVerso = (page: Page) =>
  page.evaluate(() => {
    const v = document.querySelector('.fundo-cartas [data-virada] .carta.verso')!;
    const st = getComputedStyle(v);
    return { imagem: st.backgroundImage, cor: st.backgroundColor };
  });

test('baralho equipado aparece no fundo da tela inicial e troca junto com a loja', async ({ browser }) => {
  // admin.baralho é admin no E2E (playwright.config.ts): tem todos os itens sem comprar.
  const page = await entrar(browser, 'admin.baralho@teste.dev', 'dark', '192.0.2.87');
  try {
    const fundo = page.getByTestId('fundo-cartas');
    await page.goto('/#/');
    await expect(fundo).toBeVisible();
    await expect(fundo).not.toHaveAttribute('data-verso');
    expect(await page.locator('.fundo-cartas [data-virada]').count()).toBeGreaterThanOrEqual(3);
    const classico = await fundoDoVerso(page);

    const r = await page.request.put(`${WEB}/api/loja/equipar`, { data: { slot: 'verso', itemId: 'verso-boteco' } });
    expect(r.status()).toBe(204);
    await page.reload();
    await expect(fundo).toHaveAttribute('data-verso', 'listra');
    const boteco = await fundoDoVerso(page);
    expect(boteco.cor).toBe('rgb(184, 32, 42)');
    expect(boteco.imagem).not.toBe(classico.imagem);
    for (const t of [
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(t);
      await page.screenshot({ path: `test-results/fundo-baralho-boteco-${t.width}.png` });
    }

    // Pela loja, sem recarregar: equipa o Azulejo e volta ao início.
    await page.goto('/#/loja/verso');
    await page.getByTestId('item-verso-azulejo').getByRole('button', { name: 'Equipar' }).click();
    await expect(page.getByTestId('item-verso-azulejo')).toContainText('Em uso');
    await page.getByRole('link', { name: 'Início' }).click();
    await expect(fundo).toHaveAttribute('data-verso', 'azulejo');
    expect((await fundoDoVerso(page)).cor).toBe('rgb(244, 239, 226)');
    await page.screenshot({ path: 'test-results/fundo-baralho-azulejo-1280.png' });

    // Telas internas (fundo discreto) usam o mesmo baralho.
    await page.goto('/#/salas');
    await expect(fundo).toHaveAttribute('data-verso', 'azulejo');
  } finally {
    await page.request.put(`${WEB}/api/loja/equipar`, { data: { slot: 'verso', itemId: null } }).catch(() => {});
    await page.context().close();
  }
});
