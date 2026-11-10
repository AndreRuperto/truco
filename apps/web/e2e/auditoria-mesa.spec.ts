import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agirNoRitual } from './apoio';

/**
 * Auditoria do Ciclo 1 (roadmap 2026-11-09): mede tampo, assentos, centro, mão e ações
 * nos breakpoints-alvo, com a mão já distribuída, e grava JSON + screenshots em
 * test-results/auditoria-mesa. Só registra, não reprova: os critérios vêm depois da análise.
 * Rodar só quando quiser: TRUCO_AUDITORIA=1 pnpm exec playwright test e2e/auditoria-mesa.spec.ts
 */
const VIEWPORTS = [
  [320, 568], [360, 640], [360, 740], [360, 780], [360, 800],
  [390, 844], [430, 932], [768, 1024], [1440, 900],
] as const;

const SAIDA = join(process.cwd(), 'test-results', 'auditoria-mesa');

async function medir(page: Page) {
  return page.evaluate(() => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const um = (s: string) => r(document.querySelector(s));
    const todos = (s: string) => Array.from(document.querySelectorAll(s)).map(r);
    const sobrepoe = (a: DOMRect, b: DOMRect) =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
      Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    // Sobreposição entre assentos e o centro (cartas em jogo) — indica colisão visual.
    const blocos = ['[data-testid="assento-cima"]', '[data-testid="assento-esquerda"]', '[data-testid="assento-direita"]', '[data-testid="assento-baixo"]', '[data-testid="centro"]']
      .map((s) => [s, document.querySelector(s)?.getBoundingClientRect()] as const)
      .filter((x): x is readonly [string, DOMRect] => !!x[1]);
    const colisoes: { a: string; b: string; px: number }[] = [];
    for (let i = 0; i < blocos.length; i++)
      for (let j = i + 1; j < blocos.length; j++) {
        const px = Math.round(sobrepoe(blocos[i][1], blocos[j][1]));
        if (px > 0) colisoes.push({ a: blocos[i][0], b: blocos[j][0], px });
      }
    // Interativos fora da viewport na horizontal, ou cobertos por outro elemento.
    const cortados = Array.from(document.querySelectorAll('.tela-mesa button:not([disabled])'))
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const b = el.getBoundingClientRect();
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        const topo = cy >= 0 && cy <= innerHeight ? document.elementFromPoint(cx, cy) : null;
        return {
          nome: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 24) ?? '',
          foraX: b.left < -1 || b.right > innerWidth + 1,
          coberto: topo !== null && !el.contains(topo) && !topo.contains(el),
          abaixoDaDobra: b.top > innerHeight,
        };
      })
      .filter((x) => x.foraX || x.coberto || x.abaixoDaDobra);
    const tampo = document.querySelector('[data-testid="tampo"]')?.getBoundingClientRect();
    const centro = document.querySelector('[data-testid="centro"]')?.getBoundingClientRect();
    const mao = document.querySelector('[data-testid="minha-mao"]')?.getBoundingClientRect();
    const rodape = document.querySelector('.rodape-mesa')?.getBoundingClientRect();
    const cs = getComputedStyle(document.querySelector('.tela-mesa')!);
    return {
      viewport: { w: innerWidth, h: innerHeight },
      documento: { scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight },
      vars: {
        alturaMesa: cs.getPropertyValue('--altura-mesa-mobile').trim(),
        cartaC: cs.getPropertyValue('--carta-c').trim(),
        cartaL: cs.getPropertyValue('--carta-l').trim(),
        gridRows: cs.gridTemplateRows,
      },
      barra: um('.barra-mesa'),
      placar: um('.tela-mesa > .placar'),
      arena: um('.mesa-ambiente') ?? um('.mesa-3d'),
      tampo: um('[data-testid="tampo"]'),
      centro: um('[data-testid="centro"]'),
      cartasCentro: todos('[data-testid="centro"] .carta'),
      assentos: Object.fromEntries(['cima', 'esquerda', 'direita', 'baixo'].map((p) => [p, um(`[data-testid="assento-${p}"]`)])),
      mao: um('[data-testid="minha-mao"]'),
      cartasMao: todos('[data-testid="minha-mao"] .carta-botao'),
      cronometro: um('.tela-mesa > .cronometro'),
      rodape: um('.rodape-mesa'),
      acoes: todos('.barra-acoes .acao'),
      // Proporções úteis para a análise.
      razoes: {
        arenaSobreViewport: tampo ? +(tampo.height / innerHeight).toFixed(3) : null,
        centroSobreTampo: tampo && centro ? +((centro.width * centro.height) / (tampo.width * tampo.height)).toFixed(3) : null,
        maoVisivelSemRolar: mao ? mao.bottom <= innerHeight : null,
        rodapeVisivelSemRolar: rodape ? rodape.bottom <= innerHeight : null,
        sobraAbaixoDoRodape: rodape ? Math.round(innerHeight - rodape.bottom) : null,
      },
      colisoes,
      cortados,
    };
  });
}

/** Chega a um estado com a mão na tela (passa pelo ritual de embaralhar/cortar). */
async function ateMaoDistribuida(page: Page) {
  const carta = page.getByTestId('minha-mao').locator('button.carta-botao');
  const limite = Date.now() + 40_000;
  while (Date.now() < limite) {
    if ((await carta.count()) >= 3) return true;
    try { await agirNoRitual(page); } catch { /* estado mudou */ }
    await page.waitForTimeout(200);
  }
  return false;
}

test.skip(!process.env.TRUCO_AUDITORIA, 'auditoria sob demanda (TRUCO_AUDITORIA=1)');

for (const [w, h] of VIEWPORTS) {
  test(`auditoria da mesa ${w}x${h}`, async ({ page }) => {
    mkdirSync(SAIDA, { recursive: true });
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await page.getByLabel('Apelido').fill('Auditoria');
    await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
    await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });

    const resultado: Record<string, unknown> = {};
    // Antes de distribuir (ritual) e depois, com a mão na tela.
    await page.screenshot({ path: join(SAIDA, `${w}x${h}-personagens-ritual.png`) });
    resultado.ritual = await medir(page);
    resultado.distribuiu = await ateMaoDistribuida(page);
    await page.waitForTimeout(600); // animação de distribuição
    await page.screenshot({ path: join(SAIDA, `${w}x${h}-personagens.png`) });
    await page.screenshot({ path: join(SAIDA, `${w}x${h}-personagens-full.png`), fullPage: true });
    resultado.personagens = await medir(page);

    await page.getByRole('button', { name: 'Visual da mesa' }).click();
    await page.getByRole('button', { name: 'Cadeiras (vista de cima)' }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SAIDA, `${w}x${h}-cadeiras.png`) });
    resultado.cadeiras = await medir(page);

    writeFileSync(join(SAIDA, `${w}x${h}.json`), JSON.stringify(resultado, null, 2));
  });
}
