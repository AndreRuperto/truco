import { devices, expect, type Page, test } from '@playwright/test';

/** Regressão mobile: navegação nunca deve ficar fora da tela. */
for (const largura of [320, 360, 390, 430]) {
  test(`cabeçalho cabe na tela de ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 740 });
    await page.goto('/#/');
    const cabecalho = page.getByRole('navigation', { name: 'Navegação' });
    await expect(cabecalho).toBeVisible();
    for (const nome of ['Início', 'Salas', 'Ranking', 'Como jogar']) {
      const link = cabecalho.getByRole('link', { name: nome });
      await expect(link).toBeVisible();
      const caixa = await link.boundingBox();
      expect(caixa, `sem caixa para ${nome}`).not.toBeNull();
      expect(caixa!.x, `${nome} fora à esquerda`).toBeGreaterThanOrEqual(-1);
      expect(caixa!.x + caixa!.width, `${nome} fora à direita`).toBeLessThanOrEqual(largura + 1);
    }
  });
}

/* ─────────────── F2.8 do plano MVP: telas fora da mesa nos retratos e no desktop ─────────────── */

const VIEWPORTS = [[320, 568], [360, 640], [360, 740], [390, 844], [430, 932], [1440, 900]] as const;
const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';

/** Problemas da tela atual: rolagem horizontal, botão menor que 44×44, interativo fora da tela. */
async function problemasDaTela(page: Page, nome: string): Promise<string[]> {
  return page.evaluate((tela) => {
    const out: string[] = [];
    const w = innerWidth;
    if (document.documentElement.scrollWidth > w + 1) out.push(`${tela}: rolagem horizontal (${document.documentElement.scrollWidth}px)`);
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('.so-leitor, [aria-hidden="true"]');
    };
    const rotulo = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
    for (const el of Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'))) {
      if (!visivel(el) || (el as HTMLButtonElement).disabled) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) out.push(`${tela}: botão "${rotulo(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const el of Array.from(document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], summary'))) {
      if (!visivel(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > w + 1) out.push(`${tela}: "${rotulo(el)}" fora da tela (${Math.round(r.left)}..${Math.round(r.right)})`);
    }
    return out;
  }, nome);
}

async function visitar(page: Page, rota: string, nome: string, pronto: () => Promise<void>, problemas: string[], tamanho: string) {
  await page.goto(rota);
  await pronto();
  await page.waitForTimeout(300);
  problemas.push(...(await problemasDaTela(page, `${tamanho} ${nome}`)));
}

test('telas sem conta: sem rolagem horizontal, botões de 44px e nada fora da tela', async ({ page }) => {
  test.setTimeout(240_000);
  const problemas: string[] = [];
  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    const t = `${w}x${h}`;
    const h1 = () => expect(page.locator('main h1, main h2').first()).toBeVisible({ timeout: 15_000 });
    await visitar(page, '/#/', 'início', () => expect(page.getByRole('button', { name: 'Jogar agora', exact: true })).toBeVisible(), problemas, t);
    await visitar(page, '/#/salas', 'salas', h1, problemas, t);
    await visitar(page, '/#/ranking/paulista', 'ranking', h1, problemas, t);
    await visitar(page, '/#/como-jogar', 'como jogar', h1, problemas, t);
    await visitar(page, '/#/entrar', 'entrar', () => expect(page.getByLabel('E-mail')).toBeVisible(), problemas, t);
  }
  expect(problemas, 'telas sem conta').toEqual([]);
});

test('telas com conta (perfil, histórico, fila, loja, admin) e sala de espera', async ({ browser }) => {
  test.setTimeout(300_000);
  const contexto = await browser.newContext({ ...devices['Pixel 7'], baseURL: WEB });
  const page = await contexto.newPage();
  // Só o login (POST /api/auth/...) sai com IP próprio: o limite de 5 links por IP em 15 min é da
  // suíte toda (loja e ranqueada entram antes). O resto, inclusive o WebSocket da mesa, é igual aos
  // outros testes. O servidor do E2E confia no proxy (TRUCO_TRUST_PROXY); nenhum limite muda.
  await page.route('**/api/auth/**', (r) => r.continue({ headers: { ...r.request().headers(), 'x-forwarded-for': '192.0.2.30' } }));
  try {
    await page.goto('/#/entrar');
    await page.getByLabel('E-mail').fill('admin.qa@teste.dev');
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByText(/Enviamos um link/)).toBeVisible();
    const { emails } = await (await page.request.get(`${API}/api/teste/emails`)).json();
    await page.goto(emails.filter((e: { para: string }) => e.para === 'admin.qa@teste.dev').at(-1).link as string);
    await expect(page.getByTestId('usuario-logado')).toBeVisible({ timeout: 15_000 });

    // Sala de espera: mesa privada criada uma vez; o convite reabre a sala em cada tamanho.
    await page.goto('/#/');
    await page.getByLabel(/Mesa privada/).check();
    await page.getByRole('button', { name: 'Criar mesa privada' }).click();
    const convite = page.getByLabel('Link de convite');
    await expect(convite).toBeVisible({ timeout: 15_000 });
    const sala = new URL(await convite.inputValue()).hash;

    const problemas: string[] = [];
    for (const [w, h] of VIEWPORTS) {
      await page.setViewportSize({ width: w, height: h });
      const t = `${w}x${h}`;
      const h1 = () => expect(page.locator('main h1, main h2').first()).toBeVisible({ timeout: 15_000 });
      await visitar(page, '/#/perfil', 'perfil', h1, problemas, t);
      await visitar(page, '/#/perfil?aba=pontos', 'perfil pontos', h1, problemas, t);
      await visitar(page, '/#/perfil?aba=conquistas', 'perfil conquistas', h1, problemas, t);
      await visitar(page, '/#/historico', 'histórico', h1, problemas, t);
      await visitar(page, '/#/fila', 'fila', h1, problemas, t);
      await visitar(page, '/#/loja', 'loja', h1, problemas, t);
      await visitar(page, '/#/admin', 'admin', h1, problemas, t);
      await visitar(page, '/#/admin/pedidos', 'admin pedidos', h1, problemas, t);
      await visitar(page, '/#/admin/auditoria', 'admin auditoria', h1, problemas, t);
      await visitar(page, '/#/admin/partidas', 'admin partidas', h1, problemas, t);
      await visitar(page, '/' + sala, 'sala de espera', () => expect(page.getByLabel('Link de convite')).toBeVisible({ timeout: 15_000 }), problemas, t);
    }
    expect(problemas, 'telas com conta').toEqual([]);
  } finally {
    await contexto.close();
  }
});
