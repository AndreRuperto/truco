import { devices, expect, test, type Page } from '@playwright/test';
import { agirNoRitual, ateMinhaVezComAcao } from './apoio';

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
  test('balões das cadeiras cabem na largura e não se encobrem - ' + largura + 'x' + altura, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Balao');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

    // Amostra os balões enquanto o ritual e as primeiras jogadas acontecem.
    const vistos = new Set<string>();
    const cortados: string[] = [];
    const ate = Date.now() + 35_000;
    while (Date.now() < ate) {
      await agirNoRitual(page).catch(() => false);
      const baloes = await page.evaluate(() => Array.from(document.querySelectorAll('.tela-mesa .balao')).map((b) => {
        const r = b.getBoundingClientRect();
        return { texto: b.textContent ?? '', esquerda: r.left, direita: r.right, topo: r.top, base: r.bottom };
      }));
      for (const b of baloes) {
        vistos.add(b.texto);
        if (b.esquerda < -1 || b.direita > largura + 1) {
          cortados.push(`"${b.texto}" ${Math.round(b.esquerda)}..${Math.round(b.direita)}`);
        }
      }
      // Dois balões ao mesmo tempo não podem se encobrir (um tapava o texto do outro em 320px).
      for (let i = 0; i < baloes.length; i++) {
        for (let j = i + 1; j < baloes.length; j++) {
          const a = baloes[i], b = baloes[j];
          const x = Math.min(a.direita, b.direita) - Math.max(a.esquerda, b.esquerda);
          const y = Math.min(a.base, b.base) - Math.max(a.topo, b.topo);
          if (x > 2 && y > 2) cortados.push(`"${a.texto}" sobre "${b.texto}" (${Math.round(x)}x${Math.round(y)})`);
        }
      }
      if (cortados.length) break;
      await page.waitForTimeout(150);
    }
    expect(vistos.size, 'nenhum balão apareceu para medir').toBeGreaterThan(0);
    expect(cortados, 'balões fora da viewport ou encobertos').toEqual([]);
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

/**
 * O6 da auditoria do ciclo 1: sem ações (vez de outro jogador), o rodapé sticky desenhava
 * uma barra escura vazia de 16px sob a mão. Sem ações, ele não deve ocupar nem pintar nada.
 */
test('rodapé sem ações não desenha barra vazia - 390x844', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Rodape');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

  const rodape = page.locator('.rodape-mesa');
  // Espera um momento sem ações nem janela de família (vez de um bot), avançando o ritual.
  await expect(async () => {
    await agirNoRitual(page).catch(() => false);
    expect(await rodape.locator('.acao, .janela-familia').count()).toBe(0);
  }).toPass({ timeout: 60_000, intervals: [300] });

  const caixa = await rodape.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { altura: r.height, fundo: cs.backgroundColor, borda: cs.borderTopColor, sombra: cs.boxShadow };
  });
  // A caixa pode existir (reserva estável); o que não pode é pintar uma barra vazia.
  expect(caixa.fundo, 'rodapé vazio pinta fundo').toBe('rgba(0, 0, 0, 0)');
  expect(caixa.borda, 'rodapé vazio pinta borda').toBe('rgba(0, 0, 0, 0)');
  expect(caixa.sombra, 'rodapé vazio pinta sombra').toBe('none');
});

/**
 * Pendência do ciclo 1: em 320px, a situação do placar ("Preparando a mão", "Aguardando
 * jogada") quebrava em duas linhas e o placar passava da altura reservada na --reserva-mesa (74px,
 * o pior caso é "Pediram Truco!" + situação).
 */
test('situação do placar cabe em uma linha - 320x568', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Placar');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

  // Amostra o placar pelas situações do ritual e da primeira vaza.
  const vistas = new Map<string, { linhas: number; placar: number }>();
  const ate = Date.now() + 25_000;
  while (Date.now() < ate) {
    await agirNoRitual(page).catch(() => false);
    const m = await page.evaluate(() => {
      const s = document.querySelector('.placar-situacao');
      if (!s) return null;
      const cs = getComputedStyle(s);
      const linha = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const util = s.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
      return {
        texto: s.textContent ?? '',
        linhas: Math.round(util / linha),
        placar: document.querySelector('.tela-mesa > .placar')!.getBoundingClientRect().height,
      };
    });
    if (m) vistas.set(m.texto, { linhas: m.linhas, placar: Math.max(Math.round(m.placar), vistas.get(m.texto)?.placar ?? 0) });
    await page.waitForTimeout(150);
  }
  expect(vistas.size).toBeGreaterThan(0);
  for (const [texto, v] of vistas) {
    expect(v.linhas, `"${texto}" quebrou em ${v.linhas} linhas`).toBeLessThanOrEqual(1);
    expect(v.placar, `placar com "${texto}" passou da reserva`).toBeLessThanOrEqual(74);
  }
});

/**
 * Fechamento do ciclo 1: em paisagem no celular e no zoom 200% do desktop (1440x900 → 720x450),
 * a cadeira decorativa da direita passava da tela e criava 57–58px de rolagem horizontal.
 * No celular deitado o navegador chegava a alargar a viewport (844 → 901px).
 */
for (const [nome, largura, altura, toque] of [
  ['paisagem 844x390', 844, 390, true],
  ['paisagem 740x360', 740, 360, true],
  ['zoom 200% 720x450', 720, 450, false],
] as const) {
  test('mesa sem rolagem horizontal - ' + nome, async ({ browser }) => {
    const ctx = await browser.newContext({
      ...(toque ? devices['Pixel 7'] : devices['Desktop Chrome']),
      viewport: { width: largura, height: altura },
      baseURL: test.info().project.use.baseURL,
    });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await page.getByLabel('Apelido').fill('QA Paisagem');
      await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
      await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => ({ larguraVisual: innerWidth, scrollW: document.documentElement.scrollWidth }));
      expect(m.larguraVisual, 'o navegador alargou a viewport').toBeLessThanOrEqual(largura + 1);
      expect(m.scrollW, 'documento mais largo que a tela').toBeLessThanOrEqual(largura + 1);
      // Os controles da mesa continuam alcançáveis (por rolagem vertical, se preciso).
      await expect(page.getByRole('navigation', { name: 'Menu da mesa' })).toBeVisible();
      await expect(page.locator('.rodape-mesa')).toBeAttached();
    } finally {
      await ctx.close();
    }
  });
}

/**
 * A1 do QA independente do ciclo 1: o "Truco!" (ação única, em destaque) recebia um contorno
 * decorativo de 1px a 38% que vencia o anel de foco global; pelo teclado, o foco ficava invisível.
 */
test('ação em destaque mostra anel de foco pelo teclado - 390x844', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Foco');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
  await ateMinhaVezComAcao(page);

  // Tab até uma ação do rodapé (ordem real do teclado).
  let foco: { classe: string; largura: number; estilo: string; alfa: number } | null = null;
  for (let i = 0; i < 25 && !foco; i++) {
    await page.keyboard.press('Tab');
    foco = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el?.classList.contains('acao')) return null;
      const cs = getComputedStyle(el);
      // Alfa da cor do contorno: "rgb(...)" = 1; "rgba(..., a)" ou "color(srgb ... / a)" = a.
      const m = cs.outlineColor.match(/[,/]\s*([\d.]+)\)$/);
      return { classe: el.className, largura: parseFloat(cs.outlineWidth), estilo: cs.outlineStyle, alfa: m ? parseFloat(m[1]) : 1 };
    });
  }
  expect(foco, 'Tab não chegou a uma ação do rodapé').not.toBeNull();
  expect(foco!.estilo, `contorno de foco em ${foco!.classe}`).not.toBe('none');
  expect(foco!.largura, `largura do anel de foco em ${foco!.classe}`).toBeGreaterThanOrEqual(3);
  expect(foco!.alfa, `opacidade do anel de foco em ${foco!.classe}`).toBeGreaterThanOrEqual(0.9);
});

/**
 * Reteste independente do ciclo 1: o anel de foco das cartas da mão era amarelo (--grito) sobre
 * o piso bege, com contraste de 1,05 a 1,63:1 (a referência WCAG 1.4.11 para indicador é 3:1).
 */
test('anel de foco das cartas contrasta com o piso - 390x844', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Foco Carta');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
  await ateMinhaVezComAcao(page);

  let contraste: number | null = null;
  for (let i = 0; i < 25 && contraste === null; i++) {
    await page.keyboard.press('Tab');
    contraste = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el?.classList.contains('carta-botao')) return null;
      // Converte qualquer cor computada para RGB num canvas e calcula a luminância relativa.
      const rgb = (cor: string) => {
        const c = document.createElement('canvas').getContext('2d')!;
        c.fillStyle = cor;
        c.fillRect(0, 0, 1, 1);
        const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      };
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const anel = lum(rgb(getComputedStyle(el).outlineColor));
      const piso = lum(rgb(getComputedStyle(document.body).backgroundColor));
      return (Math.max(anel, piso) + 0.05) / (Math.min(anel, piso) + 0.05);
    });
  }
  expect(contraste, 'Tab não chegou a uma carta').not.toBeNull();
  expect(contraste!, 'contraste do anel de foco da carta contra o piso').toBeGreaterThanOrEqual(3);
});

/* ───────────────────────── Fase 2 do plano MVP (P2/P3 do ciclo 1) ───────────────────────── */

const RETRATOS = [[320, 568], [360, 640], [360, 740], [390, 844], [430, 932]] as const;

/** Área de interseção (px²) entre duas caixas; 0 se só encostam. Serializável para page.evaluate. */
type Caixa = { left: number; right: number; top: number; bottom: number };
const cruza = (a: Caixa, b: Caixa) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** Mesa mineira com família fechada contra 3 bots fáceis (a janela de família abre em toda mão normal). */
async function mesaComFamilia(page: Page, apelido: string) {
  await page.goto('/');
  await page.getByText('Regras da mesa', { exact: true }).click();
  await page.getByLabel('Apelido').fill(apelido);
  await page.getByLabel('Variante').selectOption('mineiro');
  await page.getByLabel('Família', { exact: true }).selectOption('fechada');
  await page.getByLabel('Humanos').selectOption('1');
  await page.getByLabel('Bots').selectOption('facil');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
}

/** Um passo da partida: pede família se puder; senão ritual, aceitar, jogar a mão, jogar de novo ou uma carta. */
async function passoComFamilia(page: Page) {
  const tentar = async (nome: string) => {
    const b = page.getByRole('button', { name: nome, exact: true });
    if (!(await b.isVisible())) return false;
    return b.click({ timeout: 800 }).then(() => true).catch(() => false);
  };
  if (await tentar('Pedir família fechada')) return;
  if (await agirNoRitual(page)) return;
  if (await tentar('Aceitar')) return;
  if (await tentar('Jogar a mão')) return;
  if (await tentar('Jogar de novo')) return;
  const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
  if (await carta.isVisible()) await carta.click({ timeout: 800 }).catch(() => {});
}

/**
 * F2.1 (A2 do ciclo 1): a etiqueta da família ("Bot Tião: família fechada") começava fora da
 * tela à esquerda em 360x740 e ficava sob balão, cartas do centro ou monte.
 * Cartas do centro e monte: nenhuma interseção (nos dois sentidos). Balão: o balão de quem pediu
 * é centrado no próprio assento e a etiqueta fica colada a ele, então em telas estreitas as caixas
 * se cruzam por ~2 s; o que reprova é o balão pintado POR CIMA da etiqueta (elementFromPoint).
 */
for (const [largura, altura] of RETRATOS) {
  test('etiqueta de família inteira na tela e livre - ' + largura + 'x' + altura, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: largura, height: altura });
    await mesaComFamilia(page, 'QA Familia');
    const problemas = new Set<string>();
    let medidas = 0;
    const ate = Date.now() + 100_000;
    while (Date.now() < ate && medidas < 80) {
      await passoComFamilia(page);
      const m = await page.evaluate(() => {
        const cx = (el: Element) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        const visiveis = (s: string) => Array.from(document.querySelectorAll(s)).filter((e) => e.getBoundingClientRect().width > 0)
          .map((e) => ({ ...cx(e), texto: `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} em ${e.parentElement?.className ?? ''}` }));
        return {
          w: innerWidth,
          etiquetas: Array.from(document.querySelectorAll('figure.familia:not(.abertas-corte) figcaption'))
            .filter((e) => e.getBoundingClientRect().width > 0)
            .map((e) => {
              // Balão por cima da etiqueta: o que está pintado em 5 pontos dela (centro e cantos recuados).
              // .familias tem pointer-events: none, e elementFromPoint pula esses elementos: liga só durante a medição.
              const r = e.getBoundingClientRect();
              const antes = (e as HTMLElement).style.pointerEvents;
              (e as HTMLElement).style.pointerEvents = 'auto';
              const pontos = [[0.5, 0.5], [0.15, 0.25], [0.85, 0.25], [0.15, 0.75], [0.85, 0.75]];
              const balaoPorCima = pontos.map(([fx, fy]) => document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy))
                .find((el) => el && !e.contains(el) && el.closest('.balao'))?.closest('.balao')?.textContent ?? null;
              (e as HTMLElement).style.pointerEvents = antes;
              const fig = e.closest('figure')!;
              const cs = getComputedStyle(fig);
              const onde = `${[...fig.classList].join('.')} left=${cs.left} right=${cs.right} top=${cs.top} translate=${cs.translate}`;
              return { texto: e.textContent ?? '', balaoPorCima, onde, ...cx(e) };
            }),
          obstaculos: {
            monte: visiveis('[data-testid="monte"]'),
            'carta do centro': visiveis('[data-testid="centro"] .carta, .jogada, .vira'),
            'nome de assento': visiveis('.assento-nome'),
          } as Record<string, Caixa[]>,
          outras: Array.from(document.querySelectorAll('figure.familia figcaption')).filter((e) => e.getBoundingClientRect().width > 0).map(cx),
        };
      });
      for (const e of m.etiquetas) {
        medidas++;
        if (e.balaoPorCima !== null) problemas.add(`"${e.texto}" encoberta pelo balão "${e.balaoPorCima}"`);
        if (e.left < -0.5 || e.right > m.w + 0.5) problemas.add(`"${e.texto}" fora da tela (${Math.round(e.left)}..${Math.round(e.right)})`);
        if (m.outras.some((o) => !(o.left === e.left && o.top === e.top) && cruza(e, o) > 4)) problemas.add(`"${e.texto}" sobre outra etiqueta de família`);
        for (const [nome, caixas] of Object.entries(m.obstaculos)) {
          const c = caixas.find((x) => cruza(e, x) > 4);
          const r = (x: Caixa) => `${Math.round(x.left)},${Math.round(x.top)}..${Math.round(x.right)},${Math.round(x.bottom)}`;
          if (c) problemas.add(`"${e.texto}" (${e.onde}) [${r(e)}] sob ${nome}${'texto' in c ? ` "${(c as Caixa & { texto: string }).texto}"` : ''} [${r(c)}]`);
        }
      }
      if (problemas.size > 0) break;
      await page.waitForTimeout(120);
    }
    const foto = testInfo.outputPath('familia-' + largura + 'x' + altura + '.png');
    await page.screenshot({ path: foto });
    await testInfo.attach('familia', { path: foto, contentType: 'image/png' });
    expect(medidas, 'nenhuma etiqueta de família apareceu para medir').toBeGreaterThan(0);
    expect([...problemas], 'etiqueta de família').toEqual([]);
  });
}

/** Área (px²) da caixa `a` coberta pela caixa `b`, no navegador; null se alguma não existe. */
const areaSob = (page: Page, a: string, b: string) => page.evaluate(([sa, sb]) => {
  const x = document.querySelector(sa)?.getBoundingClientRect();
  const y = document.querySelector(sb)?.getBoundingClientRect();
  if (!x || !y || x.width === 0 || y.width === 0) return null;
  return Math.max(0, Math.min(x.right, y.right) - Math.max(x.left, y.left)) * Math.max(0, Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top));
}, [a, b] as const);

/**
 * F2.2: em 320x568 a dica de 3 linhas cobria as cartas jogadas no centro; no zoom 200%
 * (720x450), depois de rolar, a dica cobria o topo das cartas da mão (A3).
 */
test('dica não cobre o centro da mesa - 320x568', async ({ page }) => {
  // Pendência P3 conhecida (Fase 2, 2026-11-12): em 320x568 a arena tem 243px, a cruz ocupa 128px no
  // meio e sobram ~55px embaixo; a dica mais curta (3 linhas + botões) tem ~94px e não pode ir para
  // placar, mão nem ações. Não há posição sem cobrir o centro: precisa de redesenho da dica (ex.:
  // recolher quando houver carta na mesa). Falha esperada: quando alguém resolver, este teste avisa.
  test.fail(true, 'P3 conhecida: dica não cabe sem cobrir o centro em 320x568');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByLabel('Apelido').fill('QA Dica Centro');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Dica' })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(400);
  const area = await areaSob(page, '[data-testid="centro"]', '.dica-mesa');
  expect(area, 'dica ou centro ausente').not.toBeNull();
  expect(area!, 'área do centro da mesa sob a dica (px²)').toBeLessThanOrEqual(4);
});

test('dica não cobre a mão depois de rolar - zoom 200% 720x450', async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 720, height: 450 }, baseURL: test.info().project.use.baseURL });
  const page = await ctx.newPage();
  try {
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Dica Zoom');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Dica' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('minha-mao').locator('.carta-botao').first()).toBeAttached({ timeout: 60_000 });
    await page.getByTestId('minha-mao').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const area = await areaSob(page, '[data-testid="minha-mao"]', '.dica-mesa');
    expect(area ?? 0, 'área da mão sob a dica (px²)').toBeLessThanOrEqual(4);
  } finally {
    await ctx.close();
  }
});

/**
 * F2.3 (A4 do ciclo 1): no desktop 1440x900, na sua vez, a página rolava 35px, o "Truco!"
 * ficava cortado embaixo e a dica cobria o centro do placar.
 */
for (const [largura, altura] of [[1440, 900], [1280, 800], [1920, 1080]] as const) {
  test('desktop na sua vez sem rolagem e com ações inteiras - ' + largura + 'x' + altura, async ({ browser }, testInfo) => {
    test.setTimeout(150_000);
    const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: largura, height: altura }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await page.getByLabel('Apelido').fill('QA Desktop');
      await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
      await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
      await ateMinhaVezComAcao(page);
      await page.waitForTimeout(400);
      const foto = testInfo.outputPath('desktop-vez-' + largura + 'x' + altura + '.png');
      await page.screenshot({ path: foto });
      await testInfo.attach('desktop-vez', { path: foto, contentType: 'image/png' });
      const g = await page.evaluate(() => ({
        sobraY: document.documentElement.scrollHeight - innerHeight,
        fundoAcoes: document.querySelector('.barra-acoes')!.getBoundingClientRect().bottom,
        h: innerHeight,
      }));
      expect(g.sobraY, 'a mesa obriga a rolar').toBeLessThanOrEqual(1);
      expect(g.fundoAcoes, 'ações cortadas embaixo').toBeLessThanOrEqual(g.h);
      expect((await areaSob(page, '.tela-mesa > .placar', '.dica-mesa')) ?? 0, 'área do placar sob a dica (px²)').toBeLessThanOrEqual(4);
    } finally {
      await ctx.close();
    }
  });
}

/**
 * F2.4: com a janela de família aberta, o rodapé tem duas linhas e passa da reserva de 62px
 * da --reserva-mesa. Nada da mão pode ficar sob ele.
 */
for (const [largura, altura] of RETRATOS) {
  test('rodapé com janela de família não cobre a mão - ' + largura + 'x' + altura, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: largura, height: altura });
    await mesaComFamilia(page, 'QA Janela');
    const janela = page.locator('.rodape-mesa .janela-familia');
    await expect(async () => {
      if (!(await janela.isVisible())) await agirNoRitual(page).catch(() => false);
      await expect(janela).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 60_000, intervals: [300] });
    // No modo rápido do E2E a janela dura 1 a 2 s e fecha antes de as cartas pousarem: mede as caixas
    // do layout da mão (que já existem durante o voo) com a janela aberta, e confere que ela ainda estava.
    const foto = testInfo.outputPath('janela-familia-' + largura + 'x' + altura + '.png');
    const g = await page.evaluate(() => {
      scrollTo(0, 0);
      const rodape = document.querySelector('.rodape-mesa')!.getBoundingClientRect();
      const cartas = Array.from(document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta'))
        .map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0);
      return {
        janelaAberta: !!document.querySelector('.rodape-mesa .janela-familia'),
        topoRodape: rodape.top, alturaRodape: rodape.height, cartas: cartas.length, fundoCartas: Math.max(0, ...cartas.map((r) => r.bottom)),
      };
    });
    await page.screenshot({ path: foto });
    await testInfo.attach('janela-familia', { path: foto, contentType: 'image/png' });
    expect(g.janelaAberta, 'a janela de família fechou antes da medição').toBe(true);
    // A janela abre com a mão já distribuída (é antes da 1ª carta).
    expect(g.cartas, 'a mão não está na tela com a janela de família').toBeGreaterThan(0);
    expect(g.fundoCartas, `cartas sob o rodapé de ${Math.round(g.alturaRodape)}px`).toBeLessThanOrEqual(g.topoRodape + 1);
  });
}

/** F2.5 (O5 do ciclo 1): o nome do assento de cima ficava atrás do monte. */
for (const [largura, altura] of [[320, 568], [360, 740], [390, 844]] as const) {
  test('nome do assento de cima livre do monte, personagens e cadeiras - ' + largura + 'x' + altura, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Monte');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
    for (const vista of ['personagens', 'cadeiras'] as const) {
      if (vista === 'cadeiras') {
        await page.getByRole('button', { name: 'Visual da mesa' }).click();
        await page.getByRole('button', { name: 'Cadeiras (vista de cima)' }).click();
        await expect(page.locator('.tela-mesa')).toHaveAttribute('data-visualizacao', 'cadeiras');
      }
      // O monte troca de lugar com o pé: amostra o ritual e o começo das mãos.
      let pior = 0;
      let amostras = 0;
      const ate = Date.now() + 25_000;
      while (Date.now() < ate) {
        await agirNoRitual(page).catch(() => false);
        const a = await areaSob(page, '[data-testid="assento-cima"] .assento-nome', '[data-testid="monte"]');
        if (a !== null) { amostras++; pior = Math.max(pior, a); }
        await page.waitForTimeout(150);
      }
      expect(amostras, `${vista}: monte e nome de cima não apareceram juntos`).toBeGreaterThan(0);
      expect(pior, `${vista}: área do nome de cima sob o monte (px²)`).toBeLessThanOrEqual(4);
    }
  });
}

/**
 * No desktop o rodapé fica na coluna à direita da mão: a janela de família e o "Pedir família fechada"
 * encostavam nas cartas (pedido do André, 1857x912). Agora há folga de pelo menos 32px, sem sair da tela.
 */
for (const [largura, altura] of [[1857, 912], [1440, 900], [1280, 800], [1024, 768]] as const) {
  test('desktop: janela de família afastada da mão - ' + largura + 'x' + altura, async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: largura, height: altura }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    try {
      await mesaComFamilia(page, 'QA Folga');
      const janela = page.locator('.rodape-mesa .janela-familia');
      await expect(async () => {
        if (!(await janela.isVisible())) await agirNoRitual(page).catch(() => false);
        await expect(janela).toBeVisible({ timeout: 300 });
      }).toPass({ timeout: 60_000, intervals: [300] });
      const g = await page.evaluate(() => {
        const rodape = document.querySelector('.rodape-mesa')!;
        const filhos = Array.from(rodape.querySelectorAll('.janela-familia, .acao')).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
        // A caixa de layout da mão (as cartas podem estar em voo/giradas na distribuição).
        const mao = document.querySelector('.tela-mesa > .minha-mao')!.getBoundingClientRect();
        return {
          janelaAberta: !!rodape.querySelector('.janela-familia'),
          folga: Math.min(...filhos.map((r) => r.left)) - mao.right,
          direita: Math.max(...filhos.map((r) => r.right)),
          largura: innerWidth,
          sobraX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const foto = testInfo.outputPath('familia-folga-' + largura + 'x' + altura + '.png');
      await page.screenshot({ path: foto });
      await testInfo.attach('familia-folga', { path: foto, contentType: 'image/png' });
      expect(g.janelaAberta, 'a janela de família fechou antes da medição').toBe(true);
      expect(g.folga, 'folga entre a mão e a janela de família (px)').toBeGreaterThanOrEqual(32);
      expect(g.direita, 'janela de família saiu da tela').toBeLessThanOrEqual(g.largura);
      expect(g.sobraX, 'rolagem horizontal').toBeLessThanOrEqual(0);
    } finally {
      await ctx.close();
    }
  });
}

/**
 * Pedido do André (2026-11-16): no desktop, "Jogar coberta" fica ao lado das cartas e estava
 * colado na última carta da mão. Folga mínima de 24 px entre a carta e o botão.
 */
for (const [largura, altura] of [[1440, 900], [1280, 800], [1024, 768]] as const) {
  test('desktop: "Jogar coberta" afastado das cartas - ' + largura + 'x' + altura, async ({ browser }, testInfo) => {
    test.setTimeout(150_000);
    const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: largura, height: altura }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await page.getByLabel('Apelido').fill('QA Coberta');
      await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
      await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
      const coberta = page.getByRole('button', { name: 'Jogar coberta' });
      const jogavel = page.getByTestId('minha-mao').locator('button.carta-botao:enabled');
      const deNovo = page.getByRole('button', { name: 'Jogar de novo' });
      // Joga a 1ª vaza até aparecer "Jogar coberta" (só vale da 2ª em diante).
      await expect(async () => {
        if (await deNovo.isVisible()) await deNovo.click({ timeout: 1_000 }).catch(() => {});
        await agirNoRitual(page).catch(() => false);
        if (!(await coberta.isVisible()) && (await jogavel.count()) > 0) await jogavel.first().click({ timeout: 1_000 }).catch(() => {});
        await expect(coberta).toBeVisible({ timeout: 300 });
      }).toPass({ timeout: 120_000, intervals: [300] });
      await expect.poll(() => page.evaluate(() => Array.from(
        document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta'),
      ).every((c) => c.getAnimations().length === 0))).toBe(true);
      const g = await page.evaluate(() => {
        const botao = document.querySelector('[data-testid="minha-mao"] .alternar-coberta')!.getBoundingClientRect();
        const cartas = Array.from(document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta')).map((c) => c.getBoundingClientRect());
        return { folga: botao.left - Math.max(...cartas.map((r) => r.right)), mesmaLinha: cartas.some((r) => r.bottom > botao.top && r.top < botao.bottom) };
      });
      const foto = testInfo.outputPath('coberta-folga-' + largura + 'x' + altura + '.png');
      await page.screenshot({ path: foto });
      await testInfo.attach('coberta-folga', { path: foto, contentType: 'image/png' });
      expect(g.mesmaLinha, 'o botão deveria estar ao lado das cartas neste tamanho').toBe(true);
      expect(g.folga, 'folga entre a última carta e "Jogar coberta" (px)').toBeGreaterThanOrEqual(24);
    } finally {
      await ctx.close();
    }
  });
}

/**
 * Print do André (2026-11-26, celular ~430px no navegador do Instagram): "Jogar coberta" aparecia
 * como texto em duas linhas numa caixa escura encostada na 2ª carta, solto e sem hierarquia.
 * Agora é um botão curto ("Coberta" + versinho de carta) ao lado da mão, centrado na altura das
 * cartas e afastado da última, com alvo de toque de pelo menos 44px.
 */
for (const [largura, altura] of [[320, 568], [360, 640], [360, 740], [390, 844], [430, 932]] as const) {
  test('celular: "Jogar coberta" alinhado à mão, numa linha - ' + largura + 'x' + altura, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/');
    await page.getByLabel('Apelido').fill('QA Coberta');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
    const coberta = page.getByRole('button', { name: 'Jogar coberta' });
    const jogavel = page.getByTestId('minha-mao').locator('button.carta-botao:enabled');
    const deNovo = page.getByRole('button', { name: 'Jogar de novo' });
    // "Jogar coberta" só vale da 2ª vaza em diante.
    await expect(async () => {
      if (await deNovo.isVisible()) await deNovo.click({ timeout: 1_000 }).catch(() => {});
      await agirNoRitual(page).catch(() => false);
      if (!(await coberta.isVisible()) && (await jogavel.count()) > 0) await jogavel.first().click({ timeout: 1_000 }).catch(() => {});
      await expect(coberta).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 120_000, intervals: [300] });
    await expect(page.locator('.tela-mesa[data-dando~="baixo"]')).toHaveCount(0, { timeout: 10_000 });
    await expect.poll(() => page.evaluate(() => Array.from(
      document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta'),
    ).every((c) => c.getAnimations().length === 0))).toBe(true);
    const g = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="minha-mao"] .alternar-coberta')!;
      const botao = el.getBoundingClientRect();
      const rotulo = el.querySelector('.alternar-coberta-rotulo');
      const linhaRotulo = rotulo ? parseFloat(getComputedStyle(rotulo).lineHeight) : NaN;
      const cartas = Array.from(document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta')).map((c) => c.getBoundingClientRect());
      const topo = Math.min(...cartas.map((r) => r.top));
      const base = Math.max(...cartas.map((r) => r.bottom));
      return {
        folga: botao.left - Math.max(...cartas.map((r) => r.right)),
        desvioCentro: Math.abs((botao.top + botao.bottom) / 2 - (topo + base) / 2),
        largura: botao.width,
        altura: botao.height,
        direita: botao.right,
        alturaRotulo: rotulo ? rotulo.getBoundingClientRect().height : NaN,
        linhaRotulo,
        sobraX: document.documentElement.scrollWidth - innerWidth,
      };
    });
    const foto = testInfo.outputPath('coberta-celular-' + largura + 'x' + altura + '.png');
    await page.screenshot({ path: foto });
    await testInfo.attach('coberta-celular', { path: foto, contentType: 'image/png' });
    expect(g.folga, 'folga entre a última carta e "Jogar coberta" (px)').toBeGreaterThanOrEqual(8);
    expect(g.desvioCentro, '"Jogar coberta" fora do centro vertical das cartas (px)').toBeLessThanOrEqual(6);
    expect(g.largura, 'alvo de toque estreito').toBeGreaterThanOrEqual(44);
    expect(g.altura, 'alvo de toque baixo').toBeGreaterThanOrEqual(44);
    expect(g.alturaRotulo, 'rótulo quebrou em mais de uma linha').toBeLessThanOrEqual(g.linhaRotulo * 1.2);
    expect(g.direita, '"Jogar coberta" saiu da tela').toBeLessThanOrEqual(largura);
    expect(g.sobraX, 'rolagem horizontal').toBeLessThanOrEqual(0);
  });
}
