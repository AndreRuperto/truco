import { expect, test } from '@playwright/test';
import { agirNoRitual } from './apoio';

/**
 * QA visual do Truco: detectar mesa minúscula, altura rígida incompatível
 * com o CSS mobile, overflow lateral e perda de controles na vista superior.
 *
 * Screenshots são capturados antes das assertivas para investigar falhas.
 * A inspeção estética humana/visual continua necessária.
 */
const cenarios = [
  { largura: 320, altura: 568, minimo: 0.42, maximo: 0.75 },
  { largura: 360, altura: 640, minimo: 0.42, maximo: 0.72 },
  { largura: 360, altura: 740, minimo: 0.48, maximo: 0.70 },
  { largura: 390, altura: 844, minimo: 0.48, maximo: 0.70 },
  { largura: 430, altura: 932, minimo: 0.48, maximo: 0.70 },
];

for (const { largura, altura, minimo, maximo } of cenarios) {
  test('arena aproveita eixo Y sem overflow - ' + largura + 'x' + altura, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Visual');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();

    const tela = page.locator('.tela-mesa');
    const arena = page.locator('.mesa-ambiente');
    await expect(tela).toBeVisible({ timeout: 15_000 });
    await expect(arena).toBeVisible();

    // Captura real; teste pode falhar depois, preservando evidência.
    const normal = testInfo.outputPath('mesa-' + largura + 'x' + altura + '-personagens.png');
    await page.screenshot({ path: normal, fullPage: true });
    await testInfo.attach('mesa-personagens', { path: normal, contentType: 'image/png' });

    const caixa = await arena.boundingBox();
    expect(caixa).not.toBeNull();
    const usoY = caixa!.height / altura;
    expect(usoY, 'arena muito pequena no eixo Y').toBeGreaterThanOrEqual(minimo);
    expect(usoY, 'arena alta demais no eixo Y').toBeLessThanOrEqual(maximo);

    const larguraDocumento = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(larguraDocumento, 'documento excede largura da viewport').toBeLessThanOrEqual(largura + 1);
    await expect(page.getByRole('navigation', { name: 'Menu da mesa' })).toBeVisible();
    await expect(page.locator('.rodape-mesa')).toBeVisible();

    // A escolha de visualização não deve quebrar a geometria da mesa.
    await page.getByRole('button', { name: 'Visual da mesa' }).click();
    await page.getByRole('button', { name: 'Cadeiras (vista de cima)' }).click();
    await expect(tela).toHaveAttribute('data-visualizacao', 'cadeiras');
    await expect(arena).toBeVisible();

    const cadeiras = testInfo.outputPath('mesa-' + largura + 'x' + altura + '-cadeiras.png');
    await page.screenshot({ path: cadeiras, fullPage: true });
    await testInfo.attach('mesa-cadeiras', { path: cadeiras, contentType: 'image/png' });

    const areaCadeiras = await arena.boundingBox();
    expect(areaCadeiras).not.toBeNull();
    expect(areaCadeiras!.height / altura).toBeGreaterThanOrEqual(minimo);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(largura + 1);
    await expect(page.locator('.rodape-mesa')).toBeVisible();
  });
}

/**
 * P0 da auditoria do ciclo 1: o rodapé de ações é sticky no celular e, quando a soma
 * placar + arena + mão + rodapé passa de 100dvh, ele cobria a parte de baixo das cartas.
 * Mede com a mão distribuída e ações no rodapé, sem rolar a página.
 */
const alturasMao = [
  [320, 568], [360, 640], [360, 740], [360, 780], [390, 844], [430, 932],
] as const;

for (const [largura, altura] of alturasMao) {
  test('rodapé fixo não cobre a mão - ' + largura + 'x' + altura, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Mao');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

    const jogavel = page.getByTestId('minha-mao').locator('button.carta-botao:enabled');
    const acao = page.locator('.rodape-mesa .acao:visible');
    // Avança o ritual até ser a minha vez de jogar: cartas jogáveis e ação (Truco) no rodapé.
    // Se for a minha vez sem ação no rodapé (ex.: primeira vaza), joga uma carta e segue.
    const deNovo = page.getByRole('button', { name: 'Jogar de novo' });
    await expect(async () => {
      // Se a partida acabar antes do estado medido, começa outra (com TRUCO_TEMPOS=rapido ela é curta).
      if (await deNovo.isVisible()) await deNovo.click({ timeout: 1_000 }).catch(() => {});
      await agirNoRitual(page).catch(() => false);
      const cartas = await jogavel.count();
      let acoes = await acao.count();
      if (cartas >= 1 && acoes === 0) {
        // O botão de Truco pode chegar um instante depois da vez: só joga se ele não vier.
        await page.waitForTimeout(1_000);
        acoes = await acao.count();
        if (acoes === 0) await jogavel.first().click({ timeout: 1_000 }).catch(() => {});
      }
      expect(cartas).toBeGreaterThanOrEqual(1);
      expect(acoes).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 90_000, intervals: [400] });
    // As cartas chegam voando: espera estarem opacas e paradas antes de medir.
    await expect.poll(() => page.evaluate(() => Array.from(
      document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta'),
    ).every((c) => getComputedStyle(c).opacity === '1' && c.getAnimations().length === 0))).toBe(true);

    const foto = testInfo.outputPath('mao-rodape-' + largura + 'x' + altura + '.png');
    await page.screenshot({ path: foto });
    await testInfo.attach('mao-rodape', { path: foto, contentType: 'image/png' });

    const geometria = await page.evaluate(() => {
      scrollTo(0, 0);
      const rodape = document.querySelector('.rodape-mesa')!.getBoundingClientRect();
      // Cartas e o botão "Jogar coberta": nada da mão pode ficar sob o rodapé.
      const cartas = Array.from(document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta, [data-testid="minha-mao"] .alternar-coberta'))
        .map((c) => c.getBoundingClientRect().bottom);
      const tela = getComputedStyle(document.querySelector('.tela-mesa')!);
      return {
        topoRodape: rodape.top,
        fundoCartas: Math.max(...cartas),
        sobraY: document.documentElement.scrollHeight - innerHeight,
        linhas: `${tela.gridTemplateRows} | pad ${tela.paddingTop} ${tela.paddingBottom} | gap ${tela.rowGap}`,
      };
    });
    expect(geometria.fundoCartas, 'cartas da mão encobertas pelo rodapé fixo; ' + geometria.linhas).toBeLessThanOrEqual(geometria.topoRodape + 1);
    expect(geometria.sobraY, 'mesa obriga a rolar a página; ' + geometria.linhas).toBeLessThanOrEqual(1);
  });
}

/**
 * P1 (O2) da auditoria do ciclo 1: os balões das cadeiras laterais ("Pode dar.", "Família
 * fechada") ficavam centralizados num assento estreito e saíam da tela. O overflow-x: clip
 * escondia o excesso, então o assert de scrollWidth passava mesmo com o texto cortado.
 */
for (const [largura, altura] of [[320, 568], [360, 740], [390, 844]] as const) {
  test('balões das cadeiras cabem na largura - ' + largura + 'x' + altura, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Balao');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

    // Amostra os balões enquanto o ritual e as primeiras jogadas acontecem.
    const vistos = new Set<string>();
    const cortados: string[] = [];
    const ate = Date.now() + 25_000;
    while (Date.now() < ate && (vistos.size < 3 || cortados.length === 0)) {
      await agirNoRitual(page).catch(() => false);
      const baloes = await page.evaluate(() => Array.from(document.querySelectorAll('.tela-mesa .balao')).map((b) => {
        const r = b.getBoundingClientRect();
        return { texto: b.textContent ?? '', esquerda: r.left, direita: r.right };
      }));
      for (const b of baloes) {
        vistos.add(b.texto);
        if (b.esquerda < -1 || b.direita > largura + 1) {
          cortados.push(`"${b.texto}" ${Math.round(b.esquerda)}..${Math.round(b.direita)}`);
        }
      }
      if (cortados.length) break;
      await page.waitForTimeout(150);
    }
    expect(vistos.size, 'nenhum balão apareceu para medir').toBeGreaterThan(0);
    expect(cortados, 'balões fora da viewport').toEqual([]);
  });
}

/**
 * P1 (O4) da auditoria do ciclo 1: a dica da partida ficava fixa no topo e cobria o placar
 * e o botão "Ordem" (que a própria dica manda usar). Ela deve ficar sobre a arena, sem
 * encobrir placar, "Ordem", mão ou ações.
 */
for (const [largura, altura] of [[320, 568], [360, 740], [430, 932]] as const) {
  test('dica não cobre placar, Ordem, mão nem ações - ' + largura + 'x' + altura, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Dica');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    const dica = page.getByRole('complementary', { name: 'Dica' });
    await expect(dica).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);

    // A dica pode trocar de texto ou sumir com o ritual: mede quando há uma na tela.
    const medir = () => page.evaluate(() => {
      const caixa = (s: string) => document.querySelector(s)?.getBoundingClientRect() ?? null;
      const d = caixa('.dica-mesa');
      if (!d) return null;
      const alvos: Record<string, DOMRect | null> = {
        placar: caixa('.tela-mesa > .placar'),
        ordem: caixa('.guia-ordem > button'),
        mao: caixa('[data-testid="minha-mao"]'),
        rodape: caixa('.rodape-mesa'),
      };
      return Object.entries(alvos)
        .filter(([, r]) => r && r.height > 0)
        .filter(([, r]) => Math.min(d.bottom, r!.bottom) - Math.max(d.top, r!.top) > 1 &&
          Math.min(d.right, r!.right) - Math.max(d.left, r!.left) > 1)
        .map(([nome]) => nome);
    });
    let colisoes: string[] | null = null;
    await expect.poll(async () => (colisoes = await medir()) !== null, { timeout: 20_000 }).toBe(true);
    expect(colisoes, 'dica encobre').toEqual([]);
    // A dica continua inteira na tela e com os botões alcançáveis.
    const r = await dica.boundingBox();
    if (r) {
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.height).toBeLessThanOrEqual(altura);
    }
  });
}
