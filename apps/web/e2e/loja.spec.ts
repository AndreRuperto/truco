const TAMANHOS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 800 },
];

import { type Browser, devices, expect, type Page, test } from '@playwright/test';

const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';

/** Novo contexto (cookies próprios), login por link mágico lido da caixa de saída de teste. */
async function entrar(browser: Browser, email: string, viewport?: { width: number; height: number }, ip?: string): Promise<Page> {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], ...(viewport ? { viewport } : {}), baseURL: WEB });
  const page = await contexto.newPage();
  // IP próprio (opcional) para não gastar o limite de links mágicos por IP da suíte.
  if (ip) await page.route('**/api/auth/**', (r) => r.continue({ headers: { ...r.request().headers(), 'x-forwarded-for': ip } }));
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

const carteira = async (page: Page) => (await page.request.get(`${WEB}/api/loja/eu`)).json();

test('bônus de cadastro, compra de Pila com dinheiro fechada, verso comprado e loja sem rolagem horizontal do 320×568 ao desktop', async ({ browser }) => {
  const ana = await entrar(browser, 'ana.loja@teste.dev');
  const admin = await entrar(browser, 'admin.loja@teste.dev', undefined, '192.0.2.91');
  try {
    // Cadastro (1.000) + bônus do dia (100), avisados na faixa.
    await expect(ana.getByTestId('cabecalho-saldo')).toHaveAttribute('aria-label', 'Saldo: 1.100 Fichas e 0 Pila');
    await expect(ana.getByText(/Bem-vindo ao boteco/)).toBeVisible();

    await ana.goto('/#/loja/moldura');
    await expect(ana.getByTestId('item-moldura-giz').getByRole('button', { name: 'Faltam Fichas' })).toBeDisabled();

    // Compra de Pila com dinheiro fechada: sem a aba, o link antigo cai no Baralho e a API recusa,
    // mesmo com o checkout simulado ligado neste servidor.
    await ana.goto('/#/loja/pila');
    await expect(ana.getByRole('heading', { level: 2, name: 'Baralho' })).toBeVisible();
    const abas = ana.getByRole('navigation', { name: 'Seções da loja' });
    await expect(abas.getByRole('link')).toHaveText(['Baralho', 'Roupa', 'Moldura', 'Avatar', 'Mesa', 'Habilidades']);
    await expect(ana.locator('a[href="#/loja/pila"]')).toHaveCount(0);
    await expect(ana.getByText(/Comprar Pila|Pacotes de Pila|R\$/)).toHaveCount(0);
    const pedido = await ana.request.post(`${WEB}/api/loja/pedidos`, { data: { pacoteId: 'bolso' } });
    expect(pedido.status()).toBe(403);
    expect((await pedido.json()).erro).toBe('a compra de Pila com dinheiro está fechada por enquanto');
    expect((await carteira(ana)).pila).toBe(0);

    // Pila que já existe (aqui, um ajuste do admin) continua valendo nos itens.
    const anaId = (await (await ana.request.get(`${WEB}/api/eu`)).json()).usuario.id;
    const ajuste = await admin.request.post(`${WEB}/api/admin/usuarios/${anaId}/ajuste`, { data: { moeda: 'pila', delta: 220, motivo: 'teste E2E' } });
    expect(ajuste.status()).toBe(200);
    await ana.reload();
    await expect(ana.getByTestId('cabecalho-saldo')).toHaveAttribute('aria-label', 'Saldo: 1.100 Fichas e 220 Pila');

    await ana.goto('/#/loja');
    await ana.getByTestId('item-verso-boteco').getByRole('button', { name: 'Comprar' }).click();
    await ana.getByRole('button', { name: 'Comprar e equipar' }).click();
    await expect(ana.getByTestId('item-verso-boteco')).toContainText('Em uso');
    await expect(ana.getByTestId('saldo-pila')).toHaveText('100');
    const c = await carteira(ana);
    expect(c).toMatchObject({ fichas: 1100, pila: 100, inventario: ['verso-boteco'], equipados: { verso: 'verso-boteco' } });
    // Pila nunca vira Fichas: o extrato só tem as entradas esperadas.
    expect(c.extrato.map((l: { motivo: string }) => l.motivo).sort()).toEqual(['ajuste_admin', 'cadastro', 'compra_item', 'diario']);

    // Mesmo login (o limite de links mágicos por IP vale para a suíte toda): a loja não rola
    // na horizontal em nenhum tamanho do AGENTS.md.
    for (const t of TAMANHOS) {
      await ana.setViewportSize(t);
      for (const aba of ['verso', 'roupa', 'moldura', 'avatar', 'tampo', 'habilidade']) {
        await ana.goto(`/#/loja/${aba}`);
        await expect(ana.getByRole('heading', { level: 2 })).toBeVisible();
        const sobra = await ana.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra, `${t.width}x${t.height} #/loja/${aba}`).toBeLessThanOrEqual(0);
      }
      for (const aba of ['verso', 'roupa', 'moldura']) {
        await ana.goto(`/#/loja/${aba}`);
        await expect(ana.getByRole('heading', { level: 2 })).toBeVisible();
        await ana.screenshot({ path: `test-results/loja-${aba}-${t.width}x${t.height}.png`, fullPage: true });
      }
    }
  } finally {
    await Promise.all([ana.context().close(), admin.context().close()]);
  }
});

test('mesa privada valendo 100 Fichas: convidado sem conta é barrado e os dois pagam ao começar', async ({ browser }) => {
  const ana = await entrar(browser, 'ana.cacife@teste.dev');
  const bia = await entrar(browser, 'bia.cacife@teste.dev');
  const visitante = await browser.newContext({ ...devices['Pixel 7'], baseURL: WEB });
  try {
    await expect(bia.getByTestId('cabecalho-saldo')).toHaveAttribute('aria-label', 'Saldo: 1.100 Fichas e 0 Pila');
    await ana.goto('/#/');
    await expect(ana.getByTestId('cabecalho-saldo')).toHaveAttribute('aria-label', 'Saldo: 1.100 Fichas e 0 Pila');
    await ana.getByLabel(/Mesa privada/).check();
    await ana.getByText('Regras da mesa').click();
    await ana.getByLabel('Valendo Fichas').selectOption('100');
    await ana.getByRole('button', { name: 'Criar mesa privada' }).click();
    await expect(ana.getByText(/Valendo 100 Fichas/)).toBeVisible({ timeout: 15_000 });
    const convite = await ana.getByLabel('Link de convite').inputValue();

    // Sem conta não senta numa mesa valendo Fichas.
    const v = await visitante.newPage();
    await v.goto(convite);
    await v.getByRole('button', { name: /Entrar/ }).first().click();
    await expect(v.getByText(/entre na sua conta para jogar valendo Fichas/i)).toBeVisible({ timeout: 15_000 });

    await bia.goto(convite);
    await bia.getByRole('button', { name: /Entrar/ }).first().click();
    await expect(bia.getByText(/Valendo 100 Fichas/)).toBeVisible({ timeout: 15_000 });
    await ana.getByRole('button', { name: 'Começar com bots' }).click();

    // Começou: cada um pagou 100 e o placar mostra o pote.
    await expect(ana.getByText(/pote 200 Fichas/)).toBeVisible({ timeout: 20_000 });
    await ana.screenshot({ path: 'test-results/mesa-cacife-ana.png' });
    expect((await carteira(ana)).fichas).toBe(1000);
    expect((await carteira(bia)).fichas).toBe(1000);
  } finally {
    await Promise.all([ana.context().close(), bia.context().close(), visitante.close()]);
  }
});

