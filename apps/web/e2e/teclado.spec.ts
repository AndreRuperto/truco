import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * F6.1 do plano MVP: os caminhos principais só com o teclado (Tab, Shift+Tab, Enter, Espaço).
 * Em cada parada, o elemento focado é o esperado e o anel de foco aparece, com pelo menos
 * 3:1 de contraste contra o fundo atrás dele (WCAG 1.4.11). Mesma conta de luminância dos outros E2E.
 */
const WEB = 'http://127.0.0.1:5180';
const API = 'http://127.0.0.1:2570';

interface Anel {
  estilo: string;
  largura: number;
  contraste: number;
  sombra: string;
}

/** Mede o indicador de foco do elemento ativo: contorno (ou sombra) e o contraste contra o fundo de trás. */
async function anelDoFoco(page: Page): Promise<Anel> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const rgb = (cor: string) => {
      const c = document.createElement('canvas').getContext('2d')!;
      c.fillStyle = cor;
      c.fillRect(0, 0, 1, 1);
      const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const razao = (a: string, b: string) => {
      const x = lum(rgb(a));
      const y = lum(rgb(b));
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    // Primeiro fundo opaco do elemento para cima.
    const fundo = (de: Element | null): string => {
      for (let e = de; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const cs = getComputedStyle(el);
    // Anel por dentro (offset negativo): o fundo que conta é o do próprio elemento.
    const atras = parseFloat(cs.outlineOffset) < 0 ? fundo(el) : fundo(el.parentElement);
    return {
      estilo: cs.outlineStyle,
      largura: parseFloat(cs.outlineWidth),
      contraste: razao(cs.outlineColor, atras),
      sombra: cs.boxShadow,
    };
  });
}

/** Aperta Tab até o foco cair em `alvo`; confere o anel de foco ali. */
async function tabAte(page: Page, alvo: Locator, rotulo: string, max = 80): Promise<void> {
  await expect(alvo, `${rotulo} visível`).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await alvo.evaluate((el) => el === document.activeElement).catch(() => false)) {
      const anel = await anelDoFoco(page);
      expect(anel.estilo, `anel de foco em ${rotulo}`).not.toBe('none');
      expect(anel.largura, `largura do anel em ${rotulo}`).toBeGreaterThanOrEqual(2);
      expect(anel.contraste, `contraste do anel em ${rotulo}`).toBeGreaterThanOrEqual(3);
      return;
    }
  }
  throw new Error(`${max} Tabs e o foco não chegou em ${rotulo}`);
}

/** Etapas do ritual (cortar, dar por cima...) também pelo teclado. */
async function ritualPeloTeclado(page: Page): Promise<boolean> {
  for (const nome of ['Passar pra cortar', 'Cortar', 'Por cima', 'Deixar passar']) {
    const b = page.getByRole('button', { name: nome, exact: true });
    if (await b.isVisible().catch(() => false)) {
      await b.focus().catch(() => {});
      await page.keyboard.press('Enter');
      return true;
    }
  }
  return false;
}

for (const tema of ['light', 'dark'] as const) {
test.describe(`tema ${tema === 'light' ? 'claro' : 'escuro'}`, () => {
  test.use({ colorScheme: tema });

  test('início → jogar agora → jogar uma carta → pedir truco → sair da mesa, só com o teclado', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/');
    await tabAte(page, page.getByLabel('Apelido'), 'campo Apelido');
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`Teclado ${tema}`);
    await tabAte(page, page.getByRole('button', { name: 'Jogar agora', exact: true }), 'Jogar agora');
    await page.keyboard.press('Enter');
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

    // Jogar uma carta: espera a vez (o ritual, se aparecer, também pelo teclado).
    const jogavel = page.getByTestId('minha-mao').locator('button.carta-botao:enabled');
    const limite = Date.now() + 90_000;
    while (!(await jogavel.count())) {
      if (Date.now() > limite) throw new Error('a vez não chegou');
      await ritualPeloTeclado(page);
      await page.waitForTimeout(300);
    }
    const naMao = await page.getByTestId('minha-mao').locator('button.carta-botao').count();
    await tabAte(page, jogavel.first(), 'carta da mão');
    // A carta tem nome para o leitor de tela (ex.: "Três de paus").
    await expect(jogavel.first()).toHaveAccessibleName(/ de (paus|copas|espadas|ouros)|Coringa/i);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('minha-mao').locator('button.carta-botao')).toHaveCount(naMao - 1, { timeout: 10_000 });

    // Pedir truco (bloqueado na 1ª rodada, regra da casa): espera o botão aparecer na vez.
    const truco = page.getByRole('button', { name: /^Truco!?$/ });
    const ate = Date.now() + 120_000;
    while (!(await truco.isVisible().catch(() => false))) {
      if (Date.now() > ate) throw new Error('o Truco não ficou disponível');
      await ritualPeloTeclado(page);
      if ((await jogavel.count()) && !(await truco.isVisible().catch(() => false))) {
        await page.waitForTimeout(800);
        if (!(await truco.isVisible().catch(() => false)) && (await jogavel.count())) {
          await jogavel.first().focus();
          await page.keyboard.press('Enter');
        }
      }
      await page.waitForTimeout(300);
    }
    await tabAte(page, truco, 'Truco!');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('anuncio-mesa')).toHaveText(/truco/i, { timeout: 10_000 });

    // Sair da mesa: ícone Sair → confirmação → Sair da mesa.
    await tabAte(page, page.getByRole('button', { name: 'Sair', exact: true }), 'ícone Sair');
    await page.keyboard.press('Enter');
    await tabAte(page, page.getByRole('button', { name: 'Sair da mesa' }), 'Sair da mesa (confirmação)');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Jogar agora', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('início → loja → equipar um item grátis, só com o teclado', async ({ page }) => {
    test.setTimeout(120_000);
    // IP próprio: o limite de links mágicos por IP vale para a suíte toda.
    await page.route('**/api/auth/**', (r) => r.continue({ headers: { ...r.request().headers(), 'x-forwarded-for': '192.0.2.61' } }));
    const email = `teclado.loja.${tema}@teste.dev`;
    await page.goto('/#/entrar');
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByText(/Enviamos um link/)).toBeVisible();
    const { emails } = await (await page.request.get(`${API}/api/teste/emails`)).json();
    await page.goto(emails.filter((e: { para: string }) => e.para === email).at(-1).link);
    await expect(page.getByTestId('usuario-logado')).toBeVisible({ timeout: 15_000 });

    await page.goto(`${WEB}/#/`);
    await tabAte(page, page.getByRole('link', { name: 'Loja', exact: true }), 'link da Loja');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/loja/);
    await tabAte(page, page.getByRole('navigation', { name: 'Seções da loja' }).getByRole('link', { name: 'Mesa' }), 'aba Mesa da loja');
    await page.keyboard.press('Enter');
    const feltro = page.getByTestId('item-tampo-feltro');
    await tabAte(page, feltro.getByRole('button', { name: 'Equipar' }), 'Equipar o feltro');
    await page.keyboard.press('Enter');
    await expect(feltro).toContainText('Em uso', { timeout: 10_000 });
  });
});
}
