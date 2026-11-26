// Saldo de Fichas e Pila com ícones, encostado na conta no canto direito do cabeçalho, do 320×568 ao desktop.
import { type Browser, devices, expect, type Page, test } from '@playwright/test';

const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';
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

for (const scheme of ['light', 'dark'] as const) {
  test(`saldo com ícones no canto direito, junto da conta (${scheme})`, async ({ browser }) => {
    const page = await entrar(browser, `saldo.${scheme}@teste.dev`, scheme, scheme === 'light' ? '192.0.2.81' : '192.0.2.82');
    try {
      for (const t of TAMANHOS) {
        await page.setViewportSize(t);
        await page.goto('/#/');
        const saldo = page.getByTestId('cabecalho-saldo');
        await expect(saldo).toBeVisible();
        await expect(saldo.locator('svg.moeda-fichas')).toBeVisible();
        const m = await page.evaluate(() => {
          const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
          const cab = r('.cabecalho');
          const sal = r('.cabecalho-saldo');
          const conta = r('.menu-conta');
          const loja = r('.cabecalho > a[href="#/loja"]:not(.cabecalho-saldo)');
          return {
            sobra: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            cabAltura: cab.height,
            folgaConta: conta.left - sal.right,
            folgaLoja: sal.left - loja.right,
            // Nada cortado: abas e saldo mostram o texto inteiro.
            cortados: [...document.querySelectorAll<HTMLElement>('.cabecalho > a, .cabecalho-saldo > span')]
              .filter((e) => getComputedStyle(e).display !== 'none' && e.scrollWidth > e.clientWidth + 1)
              .map((e) => e.textContent),
            mesmaLinha: Math.abs(sal.top + sal.height / 2 - (conta.top + conta.height / 2)) < 4,
          };
        });
        const nome = `${t.width}x${t.height} ${scheme}`;
        expect(m.sobra, nome).toBeLessThanOrEqual(0);
        expect(m.mesmaLinha, nome).toBe(true);
        expect(m.cortados, nome).toEqual([]);
        if (t.width > 540) await expect(saldo.locator('svg.moeda-pila')).toBeVisible();
        expect(m.cabAltura, `${nome}: cabeçalho numa linha só`).toBeLessThan(64);
        // Encostado na conta (só o espaço entre itens) e afastado das abas quando sobra lugar.
        expect(m.folgaConta, nome).toBeGreaterThanOrEqual(0);
        expect(m.folgaConta, nome).toBeLessThanOrEqual(12);
        expect(m.folgaLoja, nome).toBeGreaterThanOrEqual(0);
        if (t.width >= 1000) expect(m.folgaLoja, nome).toBeGreaterThan(200);
        await page.locator('.cabecalho').screenshot({ path: `test-results/cabecalho-saldo-${t.width}x${t.height}-${scheme}.png` });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      // O saldo leva à Loja normal (itens), nunca à compra de Pila com dinheiro, que está fechada.
      await page.goto('/#/');
      await expect(page.getByTestId('cabecalho-saldo')).toHaveAttribute('href', '#/loja');
      await expect(page.locator('a[href="#/loja/pila"]')).toHaveCount(0);
      await page.getByTestId('cabecalho-saldo').click();
      await expect(page.getByRole('heading', { level: 2, name: 'Baralho' })).toBeVisible();
      await expect(page.getByText(/Comprar Pila|Pacotes de Pila/)).toHaveCount(0);
      await expect(page.locator('.loja-saldos svg.moeda-pila')).toBeVisible();
      await page.locator('.loja-saldos').screenshot({ path: `test-results/loja-saldos-${scheme}.png` });
    } finally {
      await page.context().close();
    }
  });
}
