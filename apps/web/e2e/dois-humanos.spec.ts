import { type Browser, devices, expect, type Page, test } from '@playwright/test';
import { agirNoRitual } from './apoio';

async function novaPagina(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL });
  return ctx.newPage();
}

/** Mesmas regras nos dois: só assim o matchmaking junta (variante/humanos/bots/chaveRegras). */
async function entrar(page: Page, nome: string) {
  await page.goto('/');
  // As regras ficam num <details> recolhido no celular.
  await page.getByText('Regras da mesa', { exact: true }).click();
  await page.getByLabel('Apelido').fill(nome);
  await page.getByLabel('Variante').selectOption('paulista');
  await page.getByLabel('Humanos').selectOption('2');
  await page.getByLabel('Bots').selectOption('facil');
  await page.getByLabel('Adversários podem interceptar sinais').selectOption({ label: 'Nunca' });
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
}

/**
 * Faz a primeira ação disponível (etapa do ritual > aceitar truco > jogar a mão de 10 > primeira carta jogável).
 * Devolve o rótulo da carta jogada, ou null se não jogou carta.
 */
async function agir(page: Page): Promise<string | null> {
  try {
    if (await agirNoRitual(page)) return null;
    const aceitar = page.getByRole('button', { name: 'Aceitar', exact: true });
    const jogarMao = page.getByRole('button', { name: 'Jogar a mão', exact: true });
    const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
    if (await aceitar.isVisible()) await aceitar.click({ timeout: 1_000 });
    else if (await jogarMao.isVisible()) await jogarMao.click({ timeout: 1_000 });
    else if (await carta.isVisible()) {
      const rotulo = await carta.getAttribute('aria-label', { timeout: 1_000 });
      await carta.click({ timeout: 1_000 });
      return rotulo;
    }
  } catch {
    // a tela mudou entre a checagem e o clique (estado novo chegou)
  }
  return null;
}

test('2 humanos parceiros: sinal chega ao parceiro e quem recarrega volta à mesa e joga', async ({ browser }) => {
  const ana = await novaPagina(browser);
  const bia = await novaPagina(browser);
  try {
    await entrar(ana, 'Ana');
    await expect(ana.getByRole('heading', { name: 'Sala de espera' })).toBeVisible({ timeout: 15_000 });
    await expect(ana.getByText('Esperando 1 jogador…')).toBeVisible();
    await expect(ana.getByRole('list', { name: 'Regras da mesa' })).toContainText('Sinais: só o parceiro vê');

    // A sala lota com a segunda e a partida começa sozinha.
    await entrar(bia, 'Bia');
    await expect(ana.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
    await expect(bia.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
    // Parceiras (cadeiras 0 e 2): cada uma vê a outra em cima.
    await expect(ana.getByTestId('assento-cima')).toContainText('Bia');
    await expect(bia.getByTestId('assento-cima')).toContainText('Ana');

    // Ana pisca o zap; Bia vê.
    await ana.getByRole('button', { name: 'Sinais' }).click();
    await expect(ana.getByRole('region', { name: 'Sinais' })).toContainText('Só seu parceiro vê.');
    await ana.getByRole('button', { name: 'Piscar — Zap' }).click();
    await expect(bia.getByRole('status').filter({ hasText: 'Ana (parceiro): 😉 Piscar — Zap' })).toBeVisible({ timeout: 5_000 });

    // Bia recarrega: volta para a mesma cadeira pelo token de reconexão.
    await bia.reload();
    await expect(bia.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
    await expect(bia.getByTestId('assento-cima')).toContainText('Ana');
    await expect(bia.getByRole('heading', { name: 'Truco' })).toHaveCount(0);

    // E consegue jogar: as duas fazem o que for preciso até uma carta da Bia sair da mão dela.
    const limite = Date.now() + 90_000;
    let jogada: string | null = null;
    while (!jogada) {
      if (Date.now() > limite) throw new Error('a Bia não conseguiu jogar depois de recarregar');
      await agir(ana);
      jogada = await agir(bia);
      if (!jogada) await bia.waitForTimeout(150);
    }
    await expect(bia.getByTestId('minha-mao').getByRole('button', { name: jogada, exact: true })).toHaveCount(0, { timeout: 2_000 });
  } finally {
    await ana.context().close();
    await bia.context().close();
  }
});

test('dois jogadores recuperam a mesma partida após recargas sucessivas', async ({ browser }) => {
  const ana = await novaPagina(browser);
  const bia = await novaPagina(browser);
  try {
    await entrar(ana, 'Ana');
    await expect(ana.getByRole('heading', { name: 'Sala de espera' })).toBeVisible({ timeout: 15_000 });
    await entrar(bia, 'Bia');
    await expect(ana.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
    await expect(bia.getByTestId('centro')).toBeVisible({ timeout: 15_000 });

    // Recargas sequenciais exercitam tokens independentes e a sincronização do servidor.
    await ana.reload();
    await expect(ana.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
    await expect(ana.getByTestId('assento-cima')).toContainText('Bia');
    await bia.reload();
    await expect(bia.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
    await expect(bia.getByTestId('assento-cima')).toContainText('Ana');

    // Uma segunda recarga detecta tokens de reconexão não renovados corretamente.
    await ana.reload();
    await expect(ana.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
    await expect(ana.getByTestId('assento-cima')).toContainText('Bia');
    await expect(ana.getByRole('heading', { name: 'Truco' })).toHaveCount(0);
    await expect(bia.getByRole('heading', { name: 'Truco' })).toHaveCount(0);
  } finally {
    await ana.context().close();
    await bia.context().close();
  }
});

test('quatro humanos: recarga temporária preserva cadeira e mantém os outros conectados', async ({ browser }) => {
  const paginas = await Promise.all(['Ana', 'Bia', 'Cid', 'Duda'].map(() => novaPagina(browser)));
  try {
    for (let i = 0; i < paginas.length; i++) {
      const page = paginas[i];
      await page.goto('/');
      await page.getByText('Regras da mesa', { exact: true }).click();
      await page.getByLabel('Apelido').fill(['Ana', 'Bia', 'Cid', 'Duda'][i]);
      await page.getByLabel('Variante').selectOption('paulista');
      await page.getByLabel('Humanos').selectOption('4');
      await page.getByLabel('Bots').selectOption('facil');
      await page.getByLabel('Adversários podem interceptar sinais').selectOption({ label: 'Nunca' });
      await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    }
    for (const page of paginas) {
      await expect(page.getByTestId('centro')).toBeVisible({ timeout: 20_000 });
    }
    const [ana, bia, cid, duda] = paginas;
    // Cadeiras 0 e 2 são parceiras, assim como 1 e 3.
    await expect(ana.getByTestId('assento-cima')).toContainText('Cid');
    await expect(bia.getByTestId('assento-cima')).toContainText('Duda');

    // A recarga interrompe a conexão sem pedir abandono definitivo.
    await bia.reload();
    await expect(bia.getByTestId('centro')).toBeVisible({ timeout: 20_000 });
    await expect(bia.getByTestId('assento-cima')).toContainText('Duda');
    for (const page of [ana, cid, duda]) {
      await expect(page.getByTestId('centro')).toBeVisible();
    }
    await expect(ana.getByTestId('assento-cima')).toContainText('Cid');
    await expect(duda.getByTestId('assento-cima')).toContainText('Bia');
  } finally {
    await Promise.all(paginas.map((page) => page.context().close()));
  }
});

test('quatro humanos completam partida até o placar final', async ({ browser }) => {
  test.setTimeout(300_000);
  const nomes = ['Ana', 'Bia', 'Cid', 'Duda'];
  const paginas = await Promise.all(nomes.map(() => novaPagina(browser)));
  try {
    for (let i = 0; i < paginas.length; i++) {
      const page = paginas[i];
      await page.goto('/');
      await page.getByText('Regras da mesa', { exact: true }).click();
      await page.getByLabel('Apelido').fill(nomes[i]);
      await page.getByLabel('Variante').selectOption('paulista');
      await page.getByLabel('Humanos').selectOption('4');
      await page.getByLabel('Bots').selectOption('facil');
      await page.getByLabel('Adversários podem interceptar sinais').selectOption({ label: 'Nunca' });
      await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    }
    for (const page of paginas) {
      await expect(page.getByTestId('centro')).toBeVisible({ timeout: 20_000 });
    }

    const encerrada = () => paginas[0].getByText('Partida encerrada', { exact: true });
    const limite = Date.now() + 240_000;
    let acoes = 0;
    while (!(await encerrada().isVisible())) {
      if (Date.now() > limite) {
        throw new Error(`partida não terminou em 240 s; ações realizadas: ${acoes}`);
      }
      for (const page of paginas) {
        if (await encerrada().isVisible()) break;
        if (await agirNoRitual(page)) {
          acoes++;
          continue;
        }
        const aceitar = page.getByRole('button', { name: 'Aceitar', exact: true });
        const jogarMao = page.getByRole('button', { name: 'Jogar a mão', exact: true });
        const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
        try {
          if (await aceitar.isVisible()) {
            await aceitar.click({ timeout: 800 });
            acoes++;
          } else if (await jogarMao.isVisible()) {
            await jogarMao.click({ timeout: 800 });
            acoes++;
          } else if (await carta.isVisible()) {
            await carta.click({ timeout: 800 });
            acoes++;
          }
        } catch {
          // Outra ação chegou ao servidor enquanto a interface atualizava.
        }
      }
      await paginas[0].waitForTimeout(80);
    }
    expect(acoes).toBeGreaterThan(20);
    for (const page of paginas) {
      await expect(page.getByText('Partida encerrada', { exact: true })).toBeVisible({ timeout: 10_000 });
    }
  } finally {
    await Promise.all(paginas.map((page) => page.context().close()));
  }
});
