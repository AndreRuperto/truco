// Perfil em abas no celular: abre curto em Conta; Pontos e Conquistas cada um na sua aba, com a aba na URL.
import { devices, expect, test } from '@playwright/test';

const TAMANHOS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

for (const scheme of ['light', 'dark'] as const) {
  test(`perfil: abas Conta, Pontos e Conquistas no celular (${scheme})`, async ({ browser, baseURL }) => {
    const contexto = await browser.newContext({ ...devices['Pixel 7'], colorScheme: scheme, baseURL });
    const page = await contexto.newPage();
    // IP próprio para o limite de links mágicos por IP (5 a cada 15 min no servidor).
    const ip = scheme === 'light' ? '192.0.2.120' : '192.0.2.121';
    await page.route('**/api/auth/**', (r) => r.continue({ headers: { ...r.request().headers(), 'x-forwarded-for': ip } }));
    const email = `perfil.abas.${scheme === 'light' ? 'claro' : 'escuro'}@teste.dev`;
    try {
      await page.goto('/#/entrar');
      await page.getByLabel('E-mail').fill(email);
      await page.getByRole('button', { name: 'Enviar link' }).click();
      await expect(page.getByText(/Enviamos um link/)).toBeVisible();
      const { emails } = await (await page.request.get('/api/teste/emails')).json();
      await page.goto(emails.filter((e: { para: string }) => e.para === email).at(-1).link as string);
      await expect(page.getByTestId('usuario-logado')).toBeVisible({ timeout: 15_000 });

      await page.goto('/#/perfil');
      const abas = page.getByRole('tablist', { name: 'Seções do perfil' });
      await expect(abas).toBeVisible();
      const conta = abas.getByRole('tab', { name: 'Conta' });
      const pontos = abas.getByRole('tab', { name: 'Pontos' });
      const conquistas = abas.getByRole('tab', { name: /^Conquistas \d+ de \d+$/ });
      await expect(conta).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('button', { name: 'Excluir minha conta…' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Paulista' })).toBeHidden();

      // Abas no topo: logo abaixo da apresentação, dentro da primeira tela em todos os tamanhos.
      for (const t of TAMANHOS) {
        await page.setViewportSize(t);
        await page.evaluate(() => window.scrollTo(0, 0));
        const caixa = await abas.boundingBox();
        expect(caixa && caixa.y + caixa.height, `abas visíveis em ${t.width}x${t.height}`).toBeLessThanOrEqual(t.height);
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra, `sem rolagem lateral em ${t.width}x${t.height}`).toBeLessThanOrEqual(0);
        // Os três rótulos cabem sem cortar.
        for (const aba of [conta, pontos, conquistas]) {
          const corte = await aba.evaluate((b) => b.scrollWidth - b.clientWidth);
          expect(corte, `rótulo inteiro em ${t.width}x${t.height}`).toBeLessThanOrEqual(0);
        }
      }

      // Toque em Pontos: painel com as duas variantes e a aba na URL.
      await page.setViewportSize({ width: 360, height: 740 });
      await pontos.click();
      await expect(page).toHaveURL(/#\/perfil\?aba=pontos$/);
      await expect(page.getByRole('region', { name: 'Paulista' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Mineiro' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Excluir minha conta…' })).toBeHidden();

      // Teclado: seta para a direita vai a Conquistas (troca a entrada do histórico, não empilha).
      await page.keyboard.press('ArrowRight');
      await expect(conquistas).toBeFocused();
      await expect(conquistas).toHaveAttribute('aria-selected', 'true');
      await expect(page).toHaveURL(/#\/perfil\?aba=conquistas$/);
      await expect(page.getByRole('tabpanel', { name: /Conquistas/ }).getByRole('listitem').first()).toBeVisible();
      await expect(page.getByRole('region', { name: 'Paulista' })).toBeHidden();

      // Recarregar mantém a aba (link compartilhável).
      await page.reload();
      await expect(conquistas).toHaveAttribute('aria-selected', 'true');

      // Voltar do navegador: volta à aba de abertura (Conta).
      await page.goBack();
      await expect(page).toHaveURL(/#\/perfil$/);
      await expect(conta).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('button', { name: 'Excluir minha conta…' })).toBeVisible();

      // "Editar perfil" (link do cabeçalho) estando em outra aba: abre Conta e põe o foco no apelido.
      await pontos.click();
      await expect(page).toHaveURL(/#\/perfil\?aba=pontos$/);
      await page.evaluate(() => {
        window.location.hash = '#/perfil?editar';
      });
      await expect(conta).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByLabel('Apelido', { exact: true })).toBeFocused();
    } finally {
      await contexto.close();
    }
  });
}
