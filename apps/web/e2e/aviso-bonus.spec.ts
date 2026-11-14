// Aviso dos bônus pendurado no saldo: vale de boas-vindas (conta nova) e cartão do bônus do dia, do 320×568 ao desktop.
// Os dois ficam por cima da página (não empurram o conteúdo) e somem sozinhos.
import { type Browser, devices, expect, type Page, test } from '@playwright/test';

const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';
const TAMANHOS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 800 },
];

async function entrar(browser: Browser, email: string, scheme: 'light' | 'dark', ip: string, viewport = { width: 390, height: 844 }): Promise<Page> {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], viewport, colorScheme: scheme, baseURL: WEB });
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

/** Medidas do aviso em relação ao cabeçalho e ao saldo. */
const medir = async (page: Page) => {
  // Mede depois da entrada (a animação desce o aviso 8 px).
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => (a as CSSAnimation).animationName !== 'aviso-entra' || a.playState === 'finished'),
  );
  return page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)?.getBoundingClientRect() ?? null;
    const aviso = r('[data-testid="aviso-bonus"]')!;
    const cab = r('.cabecalho')!;
    const topo = r('.topo-pagina')!;
    const saldo = r('.cabecalho-saldo');
    const ponta = getComputedStyle(document.querySelector('[data-testid="aviso-bonus"]')!, '::before');
    const pontaX = aviso.left + parseFloat(ponta.left) + parseFloat(ponta.width) / 2;
    return {
      sobra: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dentro: aviso.left >= 0 && aviso.right <= innerWidth,
      abaixoDoCabecalho: aviso.top - cab.bottom,
      // O topo da página tem a altura do cabeçalho: o aviso não empurra nada.
      topoIgualCabecalho: Math.abs(topo.height - cab.height) < 1,
      pontaNoSaldo: saldo ? Math.abs(pontaX - (saldo.left + saldo.width / 2)) : null,
    };
  });
};

for (const scheme of ['light', 'dark'] as const) {
  test(`boas-vindas: vale de papel no saldo, some sozinho (${scheme})`, async ({ browser }) => {
    const page = await entrar(browser, `vale.${scheme}@teste.dev`, scheme, scheme === 'light' ? '192.0.2.83' : '192.0.2.84');
    try {
      const aviso = page.getByTestId('aviso-bonus');
      await expect(aviso).toBeVisible();
      await expect(aviso).toHaveClass(/aviso-vale/);
      await expect(aviso).toContainText('Bem-vindo ao boteco');
      await expect(aviso).toContainText('+1.100 Fichas');
      await expect(aviso.getByRole('button')).toHaveCount(1);
      const m = await medir(page);
      expect(m.sobra).toBeLessThanOrEqual(0);
      expect(m.dentro).toBe(true);
      expect(m.topoIgualCabecalho).toBe(true);
      expect(m.abaixoDoCabecalho).toBeGreaterThanOrEqual(6);
      expect(m.pontaNoSaldo).toBeLessThanOrEqual(4);
      await aviso.screenshot({ path: `test-results/aviso-vale-390-${scheme}.png` });
      await page.screenshot({ path: `test-results/aviso-vale-tela-390-${scheme}.png` });
      // Some sozinho (9 s), sem clique.
      await page.mouse.move(5, 700);
      await expect(aviso).toBeHidden({ timeout: 12_000 });
    } finally {
      await page.context().close();
    }
  });

  test(`bônus do dia: cartão no saldo em todos os tamanhos, pausa com o mouse e some sozinho (${scheme})`, async ({ browser }) => {
    const page = await entrar(browser, `cartao.${scheme}@teste.dev`, scheme, scheme === 'light' ? '192.0.2.85' : '192.0.2.86');
    try {
      // O servidor só dá o bônus do dia uma vez por dia: aqui a resposta da carteira ganha um bônus diário.
      await page.route('**/api/loja/eu', async (rota) => {
        const resp = await rota.fetch();
        const corpo = await resp.json();
        await rota.fulfill({ response: resp, json: { ...corpo, bonus: [{ motivo: 'diario', delta: 100 }] } });
      });
      const aviso = page.getByTestId('aviso-bonus');
      for (const t of TAMANHOS) {
        await page.setViewportSize(t);
        await page.goto('/#/salas');
        await page.reload();
        await expect(aviso).toBeVisible();
        await expect(aviso).toHaveClass(/aviso-cartao/);
        await expect(aviso).toContainText('Bônus do dia');
        await expect(aviso).toContainText('+100 Fichas');
        const m = await medir(page);
        const nome = `${t.width}x${t.height} ${scheme}`;
        expect(m.sobra, nome).toBeLessThanOrEqual(0);
        expect(m.dentro, nome).toBe(true);
        expect(m.topoIgualCabecalho, nome).toBe(true);
        expect(m.abaixoDoCabecalho, nome).toBeGreaterThanOrEqual(6);
        expect(m.pontaNoSaldo, nome).toBeLessThanOrEqual(4);
        await page.screenshot({ path: `test-results/aviso-cartao-${t.width}x${t.height}-${scheme}.png` });
      }
      // Mouse em cima segura o aviso além dos 6 s; ao sair, ele termina e some.
      await aviso.hover();
      await page.waitForTimeout(7_000);
      await expect(aviso).toBeVisible();
      await page.mouse.move(5, 700);
      await expect(aviso).toBeHidden({ timeout: 8_000 });
    } finally {
      await page.context().close();
    }
  });
}
