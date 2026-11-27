import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { agirNoRitual } from './apoio';

/**
 * Anúncio grande do pedido: TRUCO! (e aumentos) e FAMÍLIA FECHADA! aparecem grandes no meio da
 * mesa, sem passar da largura da tela, sem cobrir o rodapé de ações e sem pegar clique.
 *
 * A placa dura 1,6 s e os bots do E2E respondem na hora: medir com idas e voltas do Playwright
 * corria contra eles. Um observador dentro da página (vigiarAnuncios) mede cada placa depois da
 * "batida" de entrada (450 ms), e o teste confere esses registros.
 */
type Vista = 'personagens' | 'cadeiras' | '3d';

interface Medida {
  esquerda: number;
  direita: number;
  fundo: number;
  topoRodape: number;
  larguraTela: number;
  ponteiro: string;
  larguraDoc: number;
  /** O que está por cima do meio da placa ("anúncio" = nada). */
  porCima: string;
}
interface Registro {
  texto: string;
  aria: string | null;
  /** Animações na placa logo ao entrar (0 com movimento reduzido). */
  animacoes: number;
  /** null: saiu antes da batida (o resumo da mão tomou a tela). */
  medida: Medida | null;
  sumiu: boolean;
}

function vigiarAnuncios() {
  type W = { __anuncios: Registro[]; __alvo?: string | null; __agoraReal?: () => number };
  const w = window as unknown as W;
  w.__anuncios = [];
  const medir = (a: HTMLElement): Medida => {
    const r = a.getBoundingClientRect();
    const rodape = document.querySelector('.rodape-mesa')?.getBoundingClientRect() ?? null;
    // elementFromPoint pula quem tem pointer-events: none: liga só durante a medida.
    a.style.pointerEvents = 'auto';
    const e = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    a.style.pointerEvents = '';
    return {
      esquerda: r.left,
      direita: r.right,
      fundo: r.bottom,
      topoRodape: rodape && rodape.height > 0 ? rodape.top : Infinity,
      larguraTela: innerWidth,
      ponteiro: getComputedStyle(a).pointerEvents,
      larguraDoc: document.documentElement.scrollWidth,
      porCima: !e || a.contains(e) ? 'anúncio' : e.tagName.toLowerCase() + '.' + [...e.classList].join('.'),
    };
  };
  const vistos = new Map<Element, Registro>();
  new MutationObserver(() => {
    for (const [el, reg] of vistos) {
      if (!el.isConnected) {
        reg.sumiu = true;
        vistos.delete(el);
      }
    }
    const a = document.querySelector<HTMLElement>('[data-testid="anuncio-grande"]');
    if (!a || vistos.has(a)) return;
    const reg: Registro = { texto: a.textContent ?? '', aria: a.getAttribute('aria-hidden'), animacoes: a.getAnimations().length, medida: null, sumiu: false };
    vistos.set(a, reg);
    w.__anuncios.push(reg);
    setTimeout(() => {
      if (!a.isConnected) return;
      reg.medida = medir(a);
      // Só para a foto: a captura com a cena 3D (WebGL) leva ~0,8 s e saía depois de a placa sumir.
      // Congela a animação da placa e o relógio da página até o teste fotografar e soltar.
      if (w.__alvo && new RegExp(w.__alvo).test(reg.texto)) {
        w.__alvo = null;
        a.getAnimations().forEach((x) => x.pause());
        w.__agoraReal = Date.now;
        const congelado = Date.now();
        Date.now = () => congelado;
      }
    }, 450);
  }).observe(document, { subtree: true, childList: true });
}

async function abrirMesa(page: Page, largura: number, altura: number, vista: Vista, familia = false) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript((v) => {
    try { localStorage.setItem('truco:visualizacao-mesa', v); } catch { /* sem armazenamento */ }
  }, vista);
  await page.addInitScript(vigiarAnuncios);
  await page.goto('/');
  if (familia) {
    await page.getByText('Regras da mesa', { exact: true }).click();
    await page.getByLabel('Variante').selectOption('mineiro');
    await page.getByLabel('Família', { exact: true }).selectOption('fechada');
  }
  await page.getByLabel('Apelido').fill('QA Anuncio');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
  await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
}

const registros = (page: Page) => page.evaluate(() => (window as unknown as { __anuncios: Registro[] }).__anuncios);

/** Marca o texto que a próxima placa medida deve ter para congelar e fotografar. Devolve o índice de partida. */
async function prepararFoto(page: Page, texto: RegExp): Promise<number> {
  return page.evaluate((alvo) => {
    const w = window as unknown as { __anuncios: Registro[]; __alvo?: string | null };
    w.__alvo = alvo;
    return w.__anuncios.length;
  }, texto.source);
}

/** Desfaz o congelamento da foto (relógio e animação) e cancela um pedido de foto pendente. */
const soltarRelogio = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __agoraReal?: () => number; __alvo?: string | null };
    w.__alvo = null;
    if (w.__agoraReal) {
      Date.now = w.__agoraReal;
      w.__agoraReal = undefined;
    }
    document.querySelector('[data-testid="anuncio-grande"]')?.getAnimations().forEach((x) => x.play());
  });

/**
 * Confere a placa que entrou desde "desde" com o texto pedido. false quando ela saiu antes da
 * batida porque o adversário correu na hora e o resumo da mão tomou a tela (de propósito: o
 * resultado manda), para quem chama tentar outro pedido.
 */
async function conferirAnuncio(page: Page, testInfo: TestInfo, nome: string, texto: RegExp, desde: number): Promise<boolean> {
  // A placa medida com o texto pedido. Se o bot aumenta antes da batida (TRUCO! vira SEIS!), a
  // primeira some sem medida e vale a seguinte. Nenhuma medida em 3 s: o resumo da mão tomou a tela.
  let reg: Registro | undefined;
  const achou = await expect
    .poll(async () => {
      reg = (await registros(page)).slice(desde).find((r) => texto.test(r.texto) && r.medida !== null);
      return !!reg;
    }, { timeout: 3_000 })
    .toBe(true)
    .then(() => true, () => false);
  if (!achou) {
    await soltarRelogio(page);
    return false;
  }
  const g = reg!.medida!;

  const foto = testInfo.outputPath(nome + '.png');
  // Em escala CSS: a foto em alta densidade do Pixel 7 é bem mais lenta.
  await page.screenshot({ path: foto, scale: 'css' });
  await soltarRelogio(page);
  await testInfo.attach(nome, { path: foto, contentType: 'image/png' });

  expect(reg!.aria, 'a placa deve ficar fora do leitor de tela (o pedido já é lido)').toBe('true');
  expect(g.esquerda, 'anúncio sai pela esquerda').toBeGreaterThanOrEqual(0);
  expect(g.direita, 'anúncio sai pela direita').toBeLessThanOrEqual(g.larguraTela);
  expect(g.fundo, 'anúncio cobre o rodapé de ações').toBeLessThanOrEqual(g.topoRodape);
  expect(g.porCima, 'algo cobre o anúncio').toBe('anúncio');
  expect(g.ponteiro, 'anúncio não pode pegar clique').toBe('none');
  expect(g.larguraDoc, 'documento passa da largura da tela').toBeLessThanOrEqual(g.larguraTela + 1);
  // E some sozinho.
  await expect(page.getByTestId('anuncio-grande')).toBeHidden({ timeout: 4_000 });
  return true;
}

/**
 * Joga até o botão "Truco!" estar disponível e o aperta. Diferente de `ateMinhaVezComAcao`, aceita
 * quando um bot pede truco (aí as cartas ficam bloqueadas até responder) e segue quando a mão acaba.
 */
async function pedirTruco(page: Page, antes: () => Promise<unknown> = async () => {}, timeout = 120_000): Promise<void> {
  const truco = page.getByRole('button', { name: 'Truco!', exact: true });
  const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
  const limite = Date.now() + timeout;
  while (Date.now() < limite) {
    if (await truco.isEnabled({ timeout: 200 }).catch(() => false) && (await truco.isVisible())) {
      await antes();
      if (await truco.click({ timeout: 1_000 }).then(() => true).catch(() => false)) return;
    }
    if (!(await agirNoRitual(page).catch(() => false))) {
      let agiu = false;
      for (const nome of ['Aceitar', 'Jogar a mão', 'Jogar de novo', 'Sem família']) {
        const b = page.getByRole('button', { name: nome, exact: true });
        if (await b.isVisible()) { agiu = await b.click({ timeout: 800 }).then(() => true).catch(() => false); break; }
      }
      // Sem truco na 1ª rodada: joga uma carta para a partida andar.
      if (!agiu && (await carta.isVisible())) {
        await page.waitForTimeout(600);
        if (!(await truco.isVisible()) || !(await truco.isEnabled({ timeout: 200 }).catch(() => false))) {
          await carta.click({ timeout: 800 }).catch(() => {});
        }
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error('o botão Truco! não ficou disponível a tempo');
}

const telas: [number, number, Vista][] = [
  [320, 568, 'personagens'],
  [360, 640, 'personagens'],
  [360, 740, 'personagens'],
  [390, 844, 'personagens'],
  [430, 932, 'personagens'],
  [1440, 900, 'personagens'],
  [390, 844, 'cadeiras'],
  [390, 844, '3d'],
  [1440, 900, 'cadeiras'],
];

for (const [largura, altura, vista] of telas) {
  test(`TRUCO! grande ao pedir truco - ${largura}x${altura} ${vista}`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await abrirMesa(page, largura, altura, vista);
    // Com os bots rápidos, às vezes correm na hora e o resumo da mão toma a tela: tenta outro truco.
    const texto = /^(VocêTRUCO|.+(SEIS|NOVE|DOZE))!$/;
    for (let tentativa = 1; ; tentativa++) {
      let desde = 0;
      await pedirTruco(page, async () => { desde = await prepararFoto(page, texto); });
      if (await conferirAnuncio(page, testInfo, `truco-${largura}x${altura}-${vista}`, texto, desde)) break;
      expect(tentativa, 'correram em todos os truco pedidos').toBeLessThan(5);
    }
  });
}

for (const [largura, altura] of [[320, 568], [390, 844]] as const) {
  test(`FAMÍLIA FECHADA! grande ao desafiar - ${largura}x${altura}`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await abrirMesa(page, largura, altura, 'personagens', true);
    const pedir = page.getByRole('button', { name: 'Pedir família fechada', exact: true });
    const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
    const limite = Date.now() + 120_000;
    while (!(await pedir.isVisible())) {
      if (Date.now() > limite) throw new Error('a janela de família não abriu');
      if (!(await agirNoRitual(page).catch(() => false))) {
        for (const nome of ['Aceitar', 'Jogar a mão', 'Jogar de novo']) {
          const b = page.getByRole('button', { name: nome, exact: true });
          if (await b.isVisible()) { await b.click({ timeout: 800 }).catch(() => {}); break; }
        }
        if (await carta.isVisible()) await carta.click({ timeout: 800 }).catch(() => {});
      }
      await page.waitForTimeout(100);
    }
    const texto = /^VocêFAMÍLIA FECHADA!$/;
    const desde = await prepararFoto(page, texto);
    await pedir.click();
    expect(await conferirAnuncio(page, testInfo, `familia-${largura}x${altura}`, texto, desde), 'a placa saiu antes da batida').toBe(true);
  });
}

test('movimento reduzido: o anúncio só aparece, sem animação', async ({ page }) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await abrirMesa(page, 390, 844, 'personagens');
  let desde = 0;
  await pedirTruco(page, async () => { desde = (await registros(page)).length; });
  let reg: Registro | undefined;
  await expect.poll(async () => {
    reg = (await registros(page)).slice(desde).find((r) => /(TRUCO|SEIS|NOVE|DOZE)!$/.test(r.texto));
    return !!reg;
  }, { timeout: 5_000 }).toBe(true);
  expect(reg!.animacoes, 'animações na placa com movimento reduzido').toBe(0);
  await expect(page.getByTestId('anuncio-grande')).toBeHidden({ timeout: 4_000 });
});
