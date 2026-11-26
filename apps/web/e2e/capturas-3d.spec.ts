import { devices, expect, type Page, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agirNoRitual } from './apoio';

/**
 * Capturas da vista 3D em vários tamanhos, para comparar antes/depois de mexer na cena.
 * Só registra (PNG + JSON); não reprova. Rodar sob demanda:
 *   TRUCO_AUDITORIA=1 TRUCO_CAPTURA=antes pnpm exec playwright test e2e/capturas-3d.spec.ts
 * Saída: capturas-3d/<TRUCO_CAPTURA>/ (fora de test-results, que o Playwright apaga a cada execução).
 */
const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';
const SAIDA = join(process.cwd(), 'capturas-3d', process.env.TRUCO_CAPTURA ?? 'atual');
const TAMANHOS = [[320, 568], [360, 640], [390, 844], [430, 932], [1280, 800]] as const;

test.skip(!process.env.TRUCO_AUDITORIA, 'auditoria sob demanda (TRUCO_AUDITORIA=1)');

async function entrarComConta(page: Page, email: string) {
  await page.goto('/#/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText(/Enviamos um link/)).toBeVisible();
  const { emails } = await (await page.request.get(`${API}/api/teste/emails`)).json();
  const link = emails.filter((e: { para: string }) => e.para === email).at(-1).link as string;
  await page.goto(link);
  await expect(page.getByTestId('usuario-logado')).toBeVisible({ timeout: 15_000 });
  await page.goto('/');
}

/** Espera a vez de jogar (cartas na mão), passando pelo ritual de embaralhar/cortar. */
async function ateMinhaVez(page: Page) {
  const jogavel = page.getByTestId('minha-mao').locator('button.carta-botao:enabled');
  await expect(async () => {
    await agirNoRitual(page).catch(() => false);
    expect(await jogavel.count()).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 90_000, intervals: [400] });
}

/** Quadros por segundo da página em 3 s (rAF), só como referência: no headless o WebGL é software. */
async function fps(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>((res) => {
    let n = 0;
    const t0 = performance.now();
    const passo = (): void => {
      n++;
      if (performance.now() - t0 < 3000) requestAnimationFrame(passo);
      else res(Math.round((n / ((performance.now() - t0) / 1000)) * 10) / 10);
    };
    requestAnimationFrame(passo);
  }));
}

test('vista 3D em vários tamanhos', async ({ browser }) => {
  test.setTimeout(300_000);
  mkdirSync(SAIDA, { recursive: true });
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, baseURL: WEB });
  const page = await ctx.newPage();
  await entrarComConta(page, `capturas3d-${Date.now()}@teste.local`);
  const campo = page.getByLabel('Apelido');
  if (await campo.isEditable()) await campo.fill('Captura');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
  await ateMinhaVez(page);
  // A dica de primeira partida tapa a mesa: tirar para a captura mostrar a cena.
  const semDicas = page.getByRole('button', { name: 'Sem dicas' });
  if (await semDicas.isVisible().catch(() => false)) await semDicas.click();
  await page.getByRole('button', { name: 'Visual da mesa' }).click();
  await page.getByRole('button', { name: '3D', exact: true }).last().click();
  await expect(page.locator('.mesa-3d-cena[data-pronta]')).toBeVisible({ timeout: 20_000 });
  const dados: Record<string, unknown> = {};
  for (const [w, h] of TAMANHOS) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1_800);
    await page.screenshot({ path: join(SAIDA, `${w}x${h}.png`) });
    dados[`${w}x${h}`] = {
      fps: await fps(page),
      scrollW: await page.evaluate(() => document.documentElement.scrollWidth),
      erroWebGL: await page.evaluate(() => document.querySelector('.aviso-3d')?.textContent ?? null),
      // Nível de qualidade em que a cena está (qualidade.ts): alta, media ou baixa.
      qualidade: await page.evaluate(() => (document.querySelector('.mesa-3d-cena canvas') as HTMLCanvasElement | null)?.dataset.qualidade ?? null),
    };
  }
  writeFileSync(join(SAIDA, 'medidas.json'), JSON.stringify(dados, null, 2));
  await ctx.close();
});
