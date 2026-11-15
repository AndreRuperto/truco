// Habilidade Floreios: os truques de embaralhar só aparecem para quem tem (admin tem sem comprar)
// e, na partida, cada truque embaralha o monte de verdade (o contador de embaralhadas sobe).
import { type Browser, devices, expect, type Page, test } from '@playwright/test';

const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';

async function entrar(browser: Browser, email: string, ip: string): Promise<Page> {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, baseURL: WEB });
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

/** Joga (cartas, ritual dos outros passos) até ser a sua vez de embaralhar; não aperta "Embaralhar". */
async function ateMinhaVezDeEmbaralhar(page: Page) {
  const fim = Date.now() + 150_000;
  const vez = page.getByText(/Sua vez de embaralhar/);
  while (Date.now() < fim) {
    if (await vez.isVisible().catch(() => false)) return;
    const acoes = page.locator('.barra-acoes button:enabled');
    const n = await acoes.count();
    for (let i = 0; i < n; i++) {
      const b = acoes.nth(i);
      const nome = (await b.textContent().catch(() => '')) ?? '';
      if (/Embaralhar|Truco|Seis|Nove|Doze|Correr/.test(nome)) continue;
      await b.click({ timeout: 500 }).catch(() => {});
      break;
    }
    const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
    if (await carta.isVisible().catch(() => false)) await carta.click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  throw new Error('a vez de embaralhar não chegou');
}

test('admin: na vez de embaralhar, os floreios aparecem e embaralham de verdade', async ({ browser }, testInfo) => {
  test.setTimeout(200_000);
  const page = await entrar(browser, 'admin.qa@teste.dev', '192.0.2.92');
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
    await ateMinhaVezDeEmbaralhar(page);
    const painel = page.getByTestId('treino-na-partida');
    await expect(painel).toBeVisible();
    await expect(painel).toContainText('Cada floreio embaralha o monte de verdade');
    await painel.getByRole('button', { name: 'Leque de cartas' }).click();
    await expect(painel.getByTestId('baralho-treino')).toHaveAttribute('data-movimento', 'leque');
    // O servidor aplicou a embaralhada: a linha do ritual conta 1×.
    await expect(page.getByText(/Sua vez de embaralhar \(1×\)/)).toBeVisible({ timeout: 5_000 });
    const foto = testInfo.outputPath('floreios-390x844.png');
    await page.screenshot({ path: foto });
    await testInfo.attach('floreios', { path: foto, contentType: 'image/png' });
  } finally {
    await page.context().close();
  }
});

test('sem a habilidade (sem conta): nenhum truque, só o "Embaralhar" normal', async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, baseURL: WEB });
  const page = await ctx.newPage();
  try {
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Sem Floreio');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
    await ateMinhaVezDeEmbaralhar(page);
    await expect(page.getByRole('button', { name: 'Embaralhar' })).toBeVisible();
    await expect(page.getByTestId('treino-na-partida')).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});
