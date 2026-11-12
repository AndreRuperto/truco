import { type Browser, expect, type Page, test } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { agirNoRitual } from './apoio';

/**
 * Ciclo 4 (service worker e deploy), contra o BUILD de produção servido pelo próprio servidor
 * do E2E (porta 2570, com o service worker ativo). Uma aba aberta antes de um deploy pede pedaços
 * de código (chunks) com o hash antigo, que o servidor novo já não tem. Antes, o "Jogar agora"
 * falhava em silêncio, e a vista 3D dizia que o aparelho não aguentava.
 *
 * Precisa de `pnpm --filter @truco/web build` antes (o servidor só serve o dist que existia ao subir).
 */
const PROD = 'http://127.0.0.1:2570';
const DIST = join(process.cwd(), 'dist');
const ASSETS = join(DIST, 'assets');
const AVISO = 'Recarregamos a página para terminar de carregar o Truco. Tente de novo.';

function pedacos() {
  const principal = readFileSync(join(DIST, 'index.html'), 'utf8').match(/assets\/(index-[\w-]+\.js)/)![1];
  const codigo = readFileSync(join(ASSETS, principal), 'utf8');
  const js = readdirSync(ASSETS).filter((f) => f.endsWith('.js') && f !== principal);
  return { sdk: js.find((f) => f.startsWith('index-') && codigo.includes(f))!, cena: js.find((f) => f.startsWith('cena-'))!, codigo };
}

const buildAtual = existsSync(join(DIST, 'index.html')) && pedacos().codigo.includes('truco:recarregou-por-atualizacao');
// TRUCO_DEPLOY_FORCAR=1 roda mesmo contra um build antigo (para provar que o teste falha nele).
test.skip(!buildAtual && !process.env.TRUCO_DEPLOY_FORCAR, 'sem build de produção atualizado (rode pnpm --filter @truco/web build)');

/** "Deploy": o arquivo com o hash antigo some do servidor; volta assim que a página recarrega. */
function sumirAteRecarregar(page: Page, arquivo: string) {
  const caminho = join(ASSETS, arquivo);
  renameSync(caminho, caminho + '.antigo');
  let restaurado = false;
  const restaurar = () => {
    if (!restaurado) renameSync(caminho + '.antigo', caminho);
    restaurado = true;
  };
  page.once('load', restaurar);
  return restaurar;
}

async function abrirControladaPeloSW(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(PROD + '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  return page;
}

test('aba aberta durante um deploy: "Jogar agora" recarrega com a versão nova, avisa e entra', async ({ browser }) => {
  const page = await abrirControladaPeloSW(browser);
  await page.getByLabel('Apelido').fill('QA Deploy');
  const restaurar = sumirAteRecarregar(page, pedacos().sdk);
  try {
    const recarregou = page.waitForEvent('load', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await recarregou;
    await expect(page.getByText(AVISO)).toBeVisible();
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
  } finally {
    restaurar();
    await page.context().close();
  }
});

test('"Jogar agora" sem internet e depois com internet: avisa, recarrega na volta e entra', async ({ browser }) => {
  const page = await abrirControladaPeloSW(browser);
  await page.getByLabel('Apelido').fill('QA Offline');
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.getByText(/o servidor não respondeu/)).toBeVisible();
  await page.context().setOffline(false);
  // O navegador guarda a falha do import() daquele arquivo enquanto a página estiver aberta:
  // com a rede de volta, a tentativa seguinte recarrega a página (antes, falhava para sempre).
  const recarregou = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await recarregou;
  await expect(page.getByText(AVISO)).toBeVisible();
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
  await page.context().close();
});

test('deploy no meio da partida: abrir a vista 3D recarrega e volta à mesa, sem culpar o aparelho', async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await abrirControladaPeloSW(browser);
  await page.getByLabel('Apelido').fill('QA 3D');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 8; i++) { await agirNoRitual(page).catch(() => false); await page.waitForTimeout(200); }
  const restaurar = sumirAteRecarregar(page, pedacos().cena);
  try {
    const recarregou = page.waitForEvent('load', { timeout: 15_000 });
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await recarregou;
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(AVISO)).toBeVisible();
    await expect(page.getByText('Não deu para abrir a vista 3D neste aparelho')).toHaveCount(0);
  } finally {
    restaurar();
    await page.context().close();
  }
});
