import { type Browser, devices, expect, type Page, test } from '@playwright/test';
import { agirNoRitual } from './apoio';

const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';

/** Novo contexto (cookies próprios), login por link mágico lido da caixa de saída de teste. */
async function entrar(browser: Browser, email: string): Promise<Page> {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], baseURL: WEB });
  const page = await contexto.newPage();
  await page.goto('/#/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText(/Enviamos um link/)).toBeVisible();
  const { emails } = await (await page.request.get(`${API}/api/teste/emails`)).json();
  const link = emails.filter((e: { para: string }) => e.para === email).at(-1).link as string;
  expect(link.startsWith(`${WEB}/#/entrar?token=`)).toBe(true);
  await page.goto(link);
  await expect(page.getByTestId('usuario-logado')).toBeVisible({ timeout: 15_000 });
  return page;
}

async function entrarNaFila(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ranqueada' }).click();
  await page.getByLabel('Variante').selectOption('paulista');
  await page.getByLabel('Formato').selectOption('1x1');
  await page.getByRole('button', { name: 'Entrar na fila' }).click();
}

test('link mágico, fila 1x1 com dois jogadores e abandono que custa Elo e bloqueia a fila', async ({ browser }) => {
  const ana = await entrar(browser, 'ana.e2e@teste.dev');
  await expect(ana.getByTestId('usuario-logado')).toContainText('anae2e');
  const bia = await entrar(browser, 'bia.e2e@teste.dev');
  try {
    await entrarNaFila(ana);
    await expect(ana.getByRole('status')).toContainText(/Procurando adversário|Adversário encontrado/);
    await entrarNaFila(bia);

    // Quem estiver com o monte faz a etapa padrão até as cartas chegarem às duas.
    const limite = Date.now() + 60_000;
    while (!(await ana.getByTestId('minha-mao').isVisible()) || !(await bia.getByTestId('minha-mao').isVisible())) {
      if (Date.now() > limite) throw new Error('as cartas não chegaram');
      await agirNoRitual(ana).catch(() => false);
      await agirNoRitual(bia).catch(() => false);
      await ana.waitForTimeout(150);
    }

    // Ana abandona: confirma a saída.
    await ana.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(ana.getByRole('alertdialog')).toContainText('conta como derrota');
    await ana.getByRole('button', { name: 'Sair da mesa' }).click();
    await expect(ana.getByRole('heading', { name: 'Ranqueada' })).toBeVisible();

    // O abandono vale como derrota contra Elo igual: 1000 → 984 (K = 32).
    await expect
      .poll(async () => (await (await ana.request.get(`${WEB}/api/perfil`)).json()).variantes.paulista.elo, { timeout: 10_000 })
      .toBe(984);
    await ana.goto('/#/perfil');
    await expect(ana.getByTestId('elo-paulista')).toHaveText('984');
    await expect(ana.getByTestId('pontos-paulista')).toHaveText('0');

    // E a fila fica bloqueada por 5 minutos.
    await ana.goto('/#/fila');
    await ana.getByRole('button', { name: 'Entrar na fila' }).click();
    await expect(ana.getByRole('alert')).toContainText('Fila bloqueada até');
  } finally {
    await ana.context().close();
    await bia.context().close();
  }
});
