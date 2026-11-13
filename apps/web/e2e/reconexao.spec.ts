import { devices, expect, type Page, test } from '@playwright/test';
import { agirNoRitual } from './apoio';

/**
 * Ciclo 4 (roadmap 2026-11-09): trocar de app ou perder a rede derruba o WebSocket. Antes, o
 * servidor jogava pela cadeira desconectada no ritmo do bot (em ~1 s, inclusive respondendo
 * truco) e quem voltava encontrava a mão jogada. Agora quem cai tem o mesmo prazo de quem está
 * parado: voltando dentro dele, a vez continua sua, com as mesmas cartas.
 */

const jogaveis = (page: Page) => page.getByTestId('minha-mao').locator('button.carta-botao:enabled');

/** Avança o ritual até ser a minha vez de jogar carta. */
async function ateMinhaVez(page: Page) {
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    await agirNoRitual(page).catch(() => false);
    if ((await jogaveis(page).count()) > 0) return;
    await page.waitForTimeout(250);
  }
  throw new Error('não chegou à minha vez a tempo');
}

const minhaMao = (page: Page) =>
  page.getByTestId('minha-mao').locator('button.carta-botao').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label')));

test('cair na própria vez e voltar dentro do prazo: a vez e as cartas continuam suas', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Volta');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
  await ateMinhaVez(page);
  const antes = await minhaMao(page);
  expect(antes.length).toBeGreaterThan(0);

  // Rede fora por 8 s: bem mais que o ritmo do bot, bem menos que o prazo de 20 s da jogada.
  await context.setOffline(true);
  await expect(page.getByText('Conexão caiu — reconectando…')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(8_000);
  await context.setOffline(false);

  await expect(page.locator('.tela-mesa:not([data-desatualizada])')).toBeVisible({ timeout: 15_000 });
  await expect(jogaveis(page).first()).toBeVisible({ timeout: 10_000 });
  expect(await minhaMao(page), 'o servidor jogou pela cadeira desconectada').toEqual(antes);

  // E a jogada feita por quem voltou é aceita.
  await jogaveis(page).first().click();
  await expect.poll(async () => (await minhaMao(page)).length, { timeout: 10_000 }).toBeLessThan(antes.length);
});

/**
 * Ciclo 4, tela de reconexão: antes, uma queda de 1–2 s trocava a mesa inteira por uma página
 * de texto ("Recuperando sua mesa…") e ainda passava por "Conectando…". Agora a mesa fica na
 * tela, esmaecida e inerte, com o aviso embaixo, e volta ao normal com o estado novo.
 */
test('queda de conexão: a mesa não some, fica inerte com o aviso e volta sem pulo de layout', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Faixa');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
  await ateMinhaVez(page);
  const arenaAntes = (await page.locator('.mesa-ambiente').boundingBox())!;

  // Amostra a cada 100 ms, da queda até a volta: a mesa nunca pode sumir da tela.
  const sumiu: string[] = [];
  let amostrando = true;
  const amostrar = (async () => {
    while (amostrando) {
      const tem = await page.evaluate(() => !!document.querySelector('.tela-mesa')).catch(() => true);
      if (!tem) sumiu.push(await page.evaluate(() => document.body.innerText.slice(0, 60)).catch(() => '?'));
      await page.waitForTimeout(100);
    }
  })();

  await context.setOffline(true);
  const aviso = page.getByText('Conexão caiu — reconectando…');
  await expect(aviso).toBeVisible({ timeout: 10_000 });
  const mesa = page.locator('.tela-mesa');
  await expect(mesa).toHaveAttribute('data-desatualizada', 'true');
  expect(await mesa.evaluate((el) => (el as HTMLElement).inert), 'mesa caída precisa ser inerte').toBe(true);
  await expect(page.getByRole('button', { name: 'Tentar agora' })).toBeVisible();
  // O aviso fica embaixo: placar e arena continuam à vista.
  const caixaAviso = (await page.locator('.faixa-reconexao').boundingBox())!;
  const placar = (await page.locator('.tela-mesa > .placar').boundingBox())!;
  expect(caixaAviso.y, 'aviso cobre o placar').toBeGreaterThan(placar.y + placar.height);
  // A dica (com botões) não fica sobre a mesa caída, e o aviso não cobre as cartas da mão.
  await expect(page.locator('.dica-mesa')).toBeHidden();
  const fundoCartas = await page.locator('[data-testid="minha-mao"] .carta').evaluateAll((cs) => Math.max(...cs.map((c) => c.getBoundingClientRect().bottom)));
  expect(fundoCartas, 'aviso cobre as cartas da mão').toBeLessThanOrEqual(caixaAviso.y + 1);
  const arenaCaida = (await page.locator('.mesa-ambiente').boundingBox())!;
  expect(Math.abs(arenaCaida.y - arenaAntes.y), 'arena pulou de lugar na queda').toBeLessThanOrEqual(2);
  expect(Math.abs(arenaCaida.height - arenaAntes.height), 'arena mudou de altura na queda').toBeLessThanOrEqual(2);
  await page.screenshot({ path: test.info().outputPath('queda-360x740.png') });

  await page.waitForTimeout(2_000);
  await context.setOffline(false);
  await expect(page.locator('.tela-mesa:not([data-desatualizada])')).toBeVisible({ timeout: 15_000 });
  await expect(aviso).toBeHidden();
  amostrando = false;
  await amostrar;
  expect(sumiu, 'a mesa sumiu da tela durante a queda ou a volta').toEqual([]);
  expect(await mesa.evaluate((el) => (el as HTMLElement).inert)).toBe(false);
});

/**
 * Ciclo 4: depois de um deploy (servidor reiniciado) ou do fim da partida, a sala é descartada e o
 * Colyseus responde `room "x" has been disposed.` ao reconnect. Antes o cliente tratava isso como
 * falha passageira e ficava para sempre em "Recuperando sua mesa…". Agora volta ao início e explica.
 */
test('voltar com o token de uma sala encerrada: sai da recuperação, apaga o token e explica', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('truco:reconexao', 'salaQueNaoExiste:tokenVelho'));
  await page.reload();
  await expect(page.getByText('A mesa foi encerrada (você ficou fora por muito tempo, o servidor reiniciou ou a partida acabou). Entre de novo para jogar.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Jogar agora', exact: true })).toBeVisible();
  await expect(page.getByText('Recuperando sua mesa e sua cadeira…')).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('truco:reconexao'))).toBeNull();
});

/**
 * Ciclo 4, aviso na volta: fora por mais que o prazo da sua vez (20 s), o servidor faz a ação
 * padrão por você. Antes, a mesa só pulava para o estado novo; agora um aviso informativo
 * (não de erro) conta o que aconteceu.
 */
test('fora por mais que o prazo: na volta, um aviso conta o que aconteceu', async ({ page, context }) => {
  test.setTimeout(150_000);
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Aviso');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
  await ateMinhaVez(page);
  // Fecha a dica de primeira vez, que também é um toast-like e poderia confundir a leitura.
  const entendi = page.getByRole('button', { name: 'Entendi' });
  if (await entendi.isVisible()) await entendi.click();

  await context.setOffline(true);
  await expect(page.getByText('Conexão caiu — reconectando…')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(24_000); // prazo da jogada (20 s) + folga
  await context.setOffline(false);

  await expect(page.locator('.tela-mesa:not([data-desatualizada])')).toBeVisible({ timeout: 15_000 });
  const aviso = page.locator('.toast.toast-aviso');
  await expect(aviso).toBeVisible({ timeout: 5_000 });
  await expect(aviso).toHaveText(/Enquanto você esteve fora|A partida terminou enquanto você esteve fora/);
  await expect(aviso).toHaveAttribute('role', 'status');
  // O aviso não cobre a mão nem as ações (a volta costuma cair numa decisão, ex.: truco).
  const caixaAviso = (await aviso.boundingBox())!;
  const mao = await page.getByTestId('minha-mao').boundingBox();
  const rodape = await page.locator('.rodape-mesa').boundingBox();
  for (const [nome, r] of [['mão', mao], ['ações', rodape]] as const) {
    if (!r || r.height === 0) continue;
    const cruza = caixaAviso.y < r.y + r.height && r.y < caixaAviso.y + caixaAviso.height;
    expect(cruza, `aviso cobre ${nome}`).toBe(false);
  }
  await page.screenshot({ path: test.info().outputPath('aviso-volta.png') });
});

/**
 * F5.2 do plano MVP. O servidor do E2E guarda a cadeira por 30 s (TRUCO_RECONEXAO_S; em produção,
 * 300 s). (a) Fora por mais que isso: a cadeira venceu, a recuperação para e explica. (b) Recarregar
 * dentro do prazo devolve a mesma cadeira e as mesmas cartas. Fechar o app instalado e abrir pelo
 * ícone NÃO devolve a cadeira hoje: o token fica em sessionStorage (pendência registrada).
 */
/** Mesa casual com 2 humanos (mesmas regras nos dois: o matchmaking junta). */
async function entrarDupla(page: Page, nome: string) {
  await page.goto('/');
  await page.getByText('Regras da mesa', { exact: true }).click();
  await page.getByLabel('Apelido').fill(nome);
  await page.getByLabel('Variante').selectOption('paulista');
  await page.getByLabel('Humanos').selectOption('2');
  await page.getByLabel('Bots').selectOption('facil');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
}

test('cadeira vencida numa mesa com outra pessoa: a mesa segue, e quem volta depois do prazo recebe o aviso', async ({ browser }) => {
  test.setTimeout(180_000);
  const novo = async () => (await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL })).newPage();
  const ana = await novo();
  const bia = await novo();
  try {
    await entrarDupla(ana, 'QA Ana');
    await entrarDupla(bia, 'QA Bia');
    await expect(ana.getByTestId('centro')).toBeVisible({ timeout: 20_000 });
    await expect(bia.getByTestId('centro')).toBeVisible({ timeout: 20_000 });

    await ana.context().setOffline(true);
    await ana.waitForTimeout(36_000); // prazo de 30 s + folga; Bia continua na mesa
    await ana.context().setOffline(false);

    await expect(ana.getByText('A sessão da mesa expirou. Entre novamente para jogar.')).toBeVisible({ timeout: 25_000 });
    await expect(ana.getByRole('button', { name: 'Jogar agora', exact: true })).toBeVisible();
    expect(await ana.evaluate(() => sessionStorage.getItem('truco:reconexao'))).toBeNull();
    // A mesa da Bia continuou (um bot ficou no lugar da Ana).
    await expect(bia.getByTestId('centro')).toBeVisible();
  } finally {
    await ana.context().close();
    await bia.context().close();
  }
});

test('sozinho com bots e fora por mais que o prazo: a mesa foi encerrada, e o aviso diz o motivo provável', async ({ page, context }) => {
  test.setTimeout(150_000);
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Vencida');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
  await context.setOffline(true);
  await page.waitForTimeout(36_000);
  await context.setOffline(false);
  // Sem outra pessoa, a sala some quando a cadeira vence: o aviso é o da mesa encerrada, com o motivo.
  await expect(page.getByText('A mesa foi encerrada (você ficou fora por muito tempo, o servidor reiniciou ou a partida acabou). Entre de novo para jogar.')).toBeVisible({ timeout: 25_000 });
  expect(await page.evaluate(() => sessionStorage.getItem('truco:reconexao'))).toBeNull();
});

test('recarregar dentro do prazo devolve a mesma cadeira e as mesmas cartas', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Recarga');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
  await ateMinhaVez(page);
  const antes = await minhaMao(page);
  await page.reload();
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => minhaMao(page), { timeout: 15_000 }).toEqual(antes);
  await expect(page.getByText('A sessão da mesa expirou')).toBeHidden();
});
