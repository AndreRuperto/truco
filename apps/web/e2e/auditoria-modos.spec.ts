import { type Browser, devices, expect, type Page, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agirNoRitual } from './apoio';

/**
 * Fechamento do ciclo 1 (roadmap 2026-11-09): modos que a auditoria da mesa não cobriu —
 * aparências (madeira, plástico, feltro), vista 3D, paisagem, zoom 200% e teclado.
 * Só registra (JSON + screenshots em test-results/auditoria-modos); não reprova.
 * Rodar sob demanda: TRUCO_AUDITORIA=1 pnpm exec playwright test e2e/auditoria-modos.spec.ts
 */
const SAIDA = join(process.cwd(), 'test-results', 'auditoria-modos');
const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';

test.skip(!process.env.TRUCO_AUDITORIA, 'auditoria sob demanda (TRUCO_AUDITORIA=1)');

async function contexto(browser: Browser, largura: number, altura: number, toque: boolean): Promise<Page> {
  const base = toque ? devices['Pixel 7'] : devices['Desktop Chrome'];
  const ctx = await browser.newContext({ ...base, viewport: { width: largura, height: altura }, baseURL: WEB });
  return ctx.newPage();
}

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

async function jogar(page: Page, apelido: string) {
  const campo = page.getByLabel('Apelido');
  // Com conta, o apelido vem dela e o campo é readOnly.
  if (await campo.isEditable()) await campo.fill(apelido);
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
}

/** Mesma lógica do teste "rodapé fixo não cobre a mão": sua vez, cartas jogáveis e ação no rodapé. */
async function ateMinhaVez(page: Page) {
  const jogavel = page.getByTestId('minha-mao').locator('button.carta-botao:enabled');
  const acao = page.locator('.rodape-mesa .acao:visible');
  const deNovo = page.getByRole('button', { name: 'Jogar de novo' });
  await expect(async () => {
    if (await deNovo.isVisible()) await deNovo.click({ timeout: 1_000 }).catch(() => {});
    await agirNoRitual(page).catch(() => false);
    const cartas = await jogavel.count();
    let acoes = await acao.count();
    if (cartas >= 1 && acoes === 0) {
      await page.waitForTimeout(1_000);
      acoes = await acao.count();
      if (acoes === 0) await jogavel.first().click({ timeout: 1_000 }).catch(() => {});
    }
    expect(cartas).toBeGreaterThanOrEqual(1);
    expect(acoes).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 90_000, intervals: [400] });
  await page.waitForTimeout(700);
}

async function medir(page: Page) {
  return page.evaluate(() => {
    scrollTo(0, 0);
    const r = (s: string) => {
      const b = document.querySelector(s)?.getBoundingClientRect();
      return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), base: Math.round(b.bottom) } : null;
    };
    const rodape = document.querySelector('.rodape-mesa')?.getBoundingClientRect();
    const fundoMao = Math.max(0, ...Array.from(document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta, [data-testid="minha-mao"] .alternar-coberta'))
      .map((c) => c.getBoundingClientRect().bottom));
    const foraX = Array.from(document.querySelectorAll('.tela-mesa button, .tela-mesa .balao, .tela-mesa .assento-nome'))
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ el, b: el.getBoundingClientRect() }))
      .filter(({ b }) => b.width > 0 && (b.left < -1 || b.right > innerWidth + 1))
      .map(({ el, b }) => `${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20)} ${Math.round(b.left)}..${Math.round(b.right)}`);
    return {
      viewport: `${innerWidth}x${innerHeight}`,
      visualizacao: document.querySelector('.tela-mesa')?.getAttribute('data-visualizacao'),
      superficie: document.querySelector('[data-testid="tampo"]')?.getAttribute('data-superficie') ?? null,
      tem3d: !!document.querySelector('[data-testid="mesa-3d"]'),
      aviso3d: document.querySelector('.aviso-3d')?.textContent ?? null,
      scrollW: document.documentElement.scrollWidth,
      sobraY: document.documentElement.scrollHeight - innerHeight,
      arena: r('.mesa-ambiente') ?? r('.mesa-3d'),
      mao: r('[data-testid="minha-mao"]'),
      rodape: r('.rodape-mesa'),
      maoSobRodape: rodape && fundoMao ? Math.round(Math.max(0, fundoMao - rodape.top)) : null,
      rodapeForaDaTela: rodape ? rodape.bottom > innerHeight + 1 : null,
      foraX,
    };
  });
}

function gravar(nome: string, dados: unknown) {
  mkdirSync(SAIDA, { recursive: true });
  writeFileSync(join(SAIDA, nome + '.json'), JSON.stringify(dados, null, 2));
}

for (const [largura, altura] of [[360, 740], [390, 844]] as const) {
  test(`aparências e 3D no celular ${largura}x${altura}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const page = await contexto(browser, largura, altura, true);
    await entrarComConta(page, `modos-${largura}@teste.local`);
    await jogar(page, 'Auditoria');
    await ateMinhaVez(page);
    const res: Record<string, unknown> = {};
    for (const aparencia of ['madeira', 'plastico', 'feltro'] as const) {
      await page.getByRole('button', { name: 'Personalizar mesa' }).click();
      await page.getByTestId(`aparencia-${aparencia}`).click();
      await page.getByRole('button', { name: 'Fechar personalização' }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(SAIDA, `${largura}x${altura}-${aparencia}.png`) });
      res[aparencia] = await medir(page);
    }
    await page.getByRole('button', { name: 'Visual da mesa' }).click();
    await page.getByRole('button', { name: '3D', exact: true }).last().click();
    await page.waitForTimeout(2_500); // cena WebGL
    await page.screenshot({ path: join(SAIDA, `${largura}x${altura}-3d.png`) });
    res['3d'] = await medir(page);
    gravar(`${largura}x${altura}-modos`, res);
    await page.context().close();
  });
}

for (const [nome, largura, altura, toque] of [
  ['paisagem-844x390', 844, 390, true],
  ['paisagem-740x360', 740, 360, true],
  ['zoom200-720x450', 720, 450, false],
] as const) {
  test(`mesa em ${nome}`, async ({ browser }) => {
    test.setTimeout(200_000);
    const page = await contexto(browser, largura, altura, toque);
    await page.goto('/');
    await jogar(page, 'Auditoria');
    await ateMinhaVez(page);
    await page.screenshot({ path: join(SAIDA, `${nome}.png`) });
    await page.screenshot({ path: join(SAIDA, `${nome}-full.png`), fullPage: true });
    gravar(nome, await medir(page));
    await page.context().close();
  });
}

test('teclado: Tab chega às cartas e às ações com foco visível (390x844)', async ({ browser }) => {
  test.setTimeout(200_000);
  const page = await contexto(browser, 390, 844, false);
  await page.goto('/');
  await jogar(page, 'Auditoria');
  await ateMinhaVez(page);
  // Fecha a dica para medir a ordem de foco da mesa em si.
  const entendi = page.getByRole('button', { name: 'Entendi' });
  if (await entendi.isVisible()) await entendi.click();
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const passos: { alvo: string; contorno: string; visivel: boolean }[] = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    passos.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { alvo: 'body', contorno: '', visivel: false };
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      const classe = el.className.toString().split(' ')[0];
      return {
        alvo: `${el.tagName.toLowerCase()}.${classe} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 18) ?? ''}`,
        contorno: `${cs.outlineStyle} ${cs.outlineWidth} | sombra ${cs.boxShadow === 'none' ? 'não' : 'sim'}`,
        visivel: b.bottom > 0 && b.top < innerHeight && b.width > 0,
      };
    }));
  }
  await page.screenshot({ path: join(SAIDA, 'teclado-390x844.png') });
  gravar('teclado-390x844', {
    chegouCarta: passos.some((p) => p.alvo.includes('carta-botao')),
    chegouAcao: passos.some((p) => p.alvo.includes('acao')),
    semContorno: passos.filter((p) => p.alvo !== 'body' && p.contorno.startsWith('none') && p.contorno.endsWith('não')).map((p) => p.alvo),
    foraDaTela: passos.filter((p) => p.alvo !== 'body' && !p.visivel).map((p) => p.alvo),
    passos,
  });
  await page.context().close();
});
