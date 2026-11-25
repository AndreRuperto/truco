import { expect, type Page, test } from '@playwright/test';

/**
 * F6.1 do plano MVP: contraste nas telas fora da mesa (as de F2.8), nos dois temas, em 390×844.
 * Texto normal ≥ 4,5:1; texto grande (≥ 24 px, ou ≥ 18,66 px em negrito) ≥ 3:1; borda de campo
 * de formulário ≥ 3:1. Mesma conta de luminância dos outros E2E (cor computada → canvas → WCAG).
 * Fica de fora (e é contado como "sem medida"): texto sobre imagem ou degradê, desabilitado e oculto.
 */
const API = 'http://127.0.0.1:2570';

interface Falha {
  texto: string;
  seletor: string;
  razao: number;
  minimo: number;
}

async function medirContraste(page: Page): Promise<{ falhas: Falha[]; medidos: number; semMedida: number }> {
  return page.evaluate(() => {
    const rgba = (cor: string) => {
      const c = document.createElement('canvas').getContext('2d')!;
      c.clearRect(0, 0, 1, 1);
      c.fillStyle = cor;
      c.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const mistura = (cima: number[], baixo: number[]) => [0, 1, 2].map((i) => cima[i] * cima[3] + baixo[i] * (1 - cima[3])).concat(1);
    /** Fundo de verdade atrás do elemento: compõe as camadas semitransparentes até achar uma opaca. null = imagem/degradê no caminho. */
    const fundo = (el: Element | null): number[] | null => {
      const camadas: number[][] = [];
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== 'none' && e !== document.body) return null;
        const c = rgba(cs.backgroundColor);
        if (c[3] > 0) camadas.push(c);
        if (c[3] >= 0.99) break;
      }
      let base = camadas.length && camadas.at(-1)![3] >= 0.99 ? camadas.pop()! : rgba(getComputedStyle(document.body).backgroundColor);
      for (const c of camadas.reverse()) base = mistura(c, base);
      return base;
    };
    const razao = (a: number[], b: number[]) => {
      const x = lum(a);
      const y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      if (el.closest('[aria-hidden="true"], .visualmente-oculto, .so-leitor, [disabled], [inert]')) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
    };
    const seletor = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
    const falhas: { texto: string; seletor: string; razao: number; minimo: number }[] = [];
    let medidos = 0;
    let semMedida = 0;
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const texto = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      const campo = el.matches('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea');
      if ((!texto && !campo) || !visivel(el)) continue;
      const cs = getComputedStyle(el);
      if (texto) {
        const atras = fundo(el);
        if (!atras) {
          semMedida++;
        } else {
          const cor = mistura(rgba(cs.color), atras);
          const px = parseFloat(cs.fontSize);
          const grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
          const minimo = grande ? 3 : 4.5;
          const r = razao(cor, atras);
          medidos++;
          if (r < minimo) falhas.push({ texto: texto.slice(0, 40), seletor: seletor(el), razao: Math.round(r * 100) / 100, minimo });
        }
      }
      if (campo) {
        const atras = fundo(el.parentElement);
        const proprio = rgba(cs.backgroundColor);
        if (!atras) {
          semMedida++;
        } else {
          // O campo se destaca pela borda ou pelo próprio fundo (o que for maior).
          const borda = parseFloat(cs.borderTopWidth) > 0 ? razao(mistura(rgba(cs.borderTopColor), atras), atras) : 0;
          const caixa = proprio[3] > 0 ? razao(mistura(proprio, atras), atras) : 0;
          const r = Math.max(borda, caixa);
          medidos++;
          if (r < 3) falhas.push({ texto: `[campo] ${(el as HTMLInputElement).name || el.id}`, seletor: seletor(el), razao: Math.round(r * 100) / 100, minimo: 3 });
        }
      }
    }
    // Nome acessível (leitor de tela): botão, link e campo com nome; imagem com alt.
    const nome = (el: Element) =>
      (el.getAttribute('aria-label') ?? '').trim() ||
      (el.getAttribute('aria-labelledby') ?? '').trim() ||
      (el.getAttribute('title') ?? '').trim() ||
      ((el as HTMLInputElement).labels?.length ? 'label' : '') ||
      (el.textContent ?? '').trim() ||
      Array.from(el.querySelectorAll('img[alt]')).map((i) => i.getAttribute('alt')).join('').trim();
    for (const el of Array.from(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, img, [role=img]'))) {
      if (!el.getBoundingClientRect().width || el.closest('[aria-hidden="true"]')) continue;
      if (el.matches('img')) {
        if (!el.hasAttribute('alt')) falhas.push({ texto: '[imagem sem alt]', seletor: seletor(el), razao: 0, minimo: 0 });
      } else if (!nome(el)) {
        falhas.push({ texto: '[sem nome acessível]', seletor: seletor(el), razao: 0, minimo: 0 });
      }
    }
    return { falhas, medidos, semMedida };
  });
}

const PUBLICAS = ['#/', '#/salas', '#/como-jogar', '#/entrar', '#/ranking/paulista', '#/loja', '#/privacidade', '#/termos'];
const COM_CONTA = ['#/perfil', '#/historico', '#/loja', '#/fila'];
const ADMIN = ['#/admin', '#/admin/usuarios', '#/admin/auditoria', '#/admin/partidas'];

async function entrar(page: Page, email: string, ip: string): Promise<void> {
  await page.route('**/api/auth/**', (r) => r.continue({ headers: { ...r.request().headers(), 'x-forwarded-for': ip } }));
  await page.goto('/#/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText(/Enviamos um link/)).toBeVisible();
  const { emails } = await (await page.request.get(`${API}/api/teste/emails`)).json();
  await page.goto(emails.filter((e: { para: string }) => e.para === email).at(-1).link);
  await expect(page.getByTestId('usuario-logado')).toBeVisible({ timeout: 15_000 });
}

async function percorrer(page: Page, rotas: string[], tema: string): Promise<string[]> {
  const relatorio: string[] = [];
  for (const rota of rotas) {
    await page.goto(`/${rota}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const { falhas, medidos, semMedida } = await medirContraste(page);
    relatorio.push(`${tema} ${rota}: ${medidos} medidos, ${semMedida} sem medida, ${falhas.length} abaixo`);
    for (const f of falhas) relatorio.push(`  ${f.razao}:1 (mín. ${f.minimo}) ${f.seletor} "${f.texto}"`);
  }
  return relatorio;
}

for (const tema of ['light', 'dark'] as const) {
  test.describe(`contraste, tema ${tema === 'light' ? 'claro' : 'escuro'}`, () => {
    test.use({ colorScheme: tema, viewport: { width: 390, height: 844 } });

    test('telas públicas', async ({ page }, info) => {
      const r = await percorrer(page, PUBLICAS, tema);
      await info.attach('contraste.txt', { body: r.join('\n'), contentType: 'text/plain' });
      console.log(r.join('\n'));
      expect(r.filter((l) => l.startsWith('  ')), 'textos e campos abaixo do mínimo').toEqual([]);
    });

    test('telas de conta e admin', async ({ page }, info) => {
      test.setTimeout(90_000);
      await entrar(page, 'admin.qa@teste.dev', tema === 'light' ? '192.0.2.71' : '192.0.2.72');
      const r = await percorrer(page, [...COM_CONTA, ...ADMIN], tema);
      await info.attach('contraste.txt', { body: r.join('\n'), contentType: 'text/plain' });
      console.log(r.join('\n'));
      expect(r.filter((l) => l.startsWith('  ')), 'textos e campos abaixo do mínimo').toEqual([]);
    });
  });
}
