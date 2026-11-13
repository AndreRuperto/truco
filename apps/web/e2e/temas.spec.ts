import { expect, test, type Page } from '@playwright/test';

/**
 * F2.7 do plano MVP: tema (claro/escuro) × aparência da mesa × vista, nos retratos mais comuns.
 * O tema escuro NA MESA nunca tinha sido testado. Feltro e tampos da loja exigem conta ou item
 * no inventário: ficam fora desta matriz (registrados em docs/qa-frontend/qa-fase2-2026-11.md).
 * Contraste: mesma conta do teste do anel de foco (luminância relativa WCAG via canvas).
 */
const TEMAS = ['claro', 'escuro'] as const;
const APARENCIAS = ['madeira', 'plastico'] as const;
const VISTAS = ['personagens', 'cadeiras', '3d'] as const;
const TELAS = [[360, 740], [390, 844]] as const;

async function medir(page: Page) {
  return page.evaluate(() => {
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
    const razao = (a: string, b: string) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    /** Primeiro fundo opaco do elemento para cima (o que está de fato atrás dele). */
    const fundo = (el: Element | null): string => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const num = document.querySelector('.placar-num');
    const icone = document.querySelector('.barra-mesa .icone-mesa');
    const rodape = document.querySelector('.rodape-mesa')?.getBoundingClientRect();
    const cartas = Array.from(document.querySelectorAll('[data-testid="minha-mao"] .carta-botao .carta'))
      .map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0);
    return {
      scrollW: document.documentElement.scrollWidth,
      w: innerWidth,
      contrastePlacar: num ? razao(getComputedStyle(num).color, fundo(num)) : null,
      // Controle: o fundo do ícone contra o que está atrás da barra (WCAG 1.4.11).
      contrasteIcone: icone ? razao(fundo(icone), fundo(icone.parentElement!.parentElement)) : null,
      bordaIcone: icone ? razao(getComputedStyle(icone).borderTopColor, fundo(icone.parentElement!.parentElement)) : null,
      fundoCartas: cartas.length ? Math.max(...cartas.map((r) => r.bottom)) : null,
      topoRodape: rodape?.top ?? null,
      tema: document.documentElement.dataset.tema ?? null,
      vista: document.querySelector('.tela-mesa')?.getAttribute('data-visualizacao') ?? null,
      superficie: document.querySelector('[data-testid="tampo"]')?.getAttribute('data-superficie') ?? null,
    };
  });
}

for (const [largura, altura] of TELAS) {
  for (const tema of TEMAS) {
    for (const aparencia of APARENCIAS) {
      for (const vista of VISTAS) {
        test(`tema ${tema} · ${aparencia} · ${vista} - ${largura}x${altura}`, async ({ page }, testInfo) => {
          test.setTimeout(90_000);
          await page.setViewportSize({ width: largura, height: altura });
          await page.addInitScript(([t, a, v]) => {
            try {
              if (!sessionStorage.getItem('qa-temas')) {
                localStorage.setItem('truco:tema', t);
                localStorage.setItem('truco:aparencia-mesa', a);
                localStorage.setItem('truco:visualizacao-mesa', v);
                sessionStorage.setItem('qa-temas', '1');
              }
            } catch { /* sem armazenamento */ }
          }, [tema, aparencia, vista] as const);
          await page.goto('/');
          await page.getByLabel('Apelido').fill('QA Tema');
          await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();
          await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 15_000 });
          await expect(page.locator('.placar-num').first()).toBeVisible();
          await page.waitForTimeout(1_500);

          const foto = testInfo.outputPath(`tema-${tema}-${aparencia}-${vista}-${largura}x${altura}.png`);
          await page.screenshot({ path: foto });
          await testInfo.attach('mesa', { path: foto, contentType: 'image/png' });

          const m = await medir(page);
          expect(m.tema, 'tema aplicado').toBe(tema);
          expect(m.vista, 'vista aplicada').toBe(vista);
          if (vista !== '3d') expect(m.superficie, 'aparência aplicada').toBe(aparencia);
          expect(m.scrollW, 'rolagem horizontal').toBeLessThanOrEqual(m.w + 1);
          expect(m.contrastePlacar ?? 0, 'contraste do número do placar').toBeGreaterThanOrEqual(4.5);
          expect(Math.max(m.contrasteIcone ?? 0, m.bordaIcone ?? 0), 'contraste do ícone da barra (fundo ou borda)').toBeGreaterThanOrEqual(3);
          if (m.fundoCartas !== null && m.topoRodape !== null) {
            expect(m.fundoCartas, 'mão sob o rodapé').toBeLessThanOrEqual(m.topoRodape + 1);
          }

          // Persistência: recarregar mantém as três escolhas (o init script não regrava: sessionStorage).
          await page.reload();
          await expect(page.locator('.tela-mesa')).toBeVisible({ timeout: 20_000 });
          const r = await medir(page);
          expect(r.tema, 'tema depois de recarregar').toBe(tema);
          expect(r.vista, 'vista depois de recarregar').toBe(vista);
          if (vista !== '3d') expect(r.superficie, 'aparência depois de recarregar').toBe(aparencia);
        });
      }
    }
  }
}
