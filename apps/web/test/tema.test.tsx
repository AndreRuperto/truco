import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import postcss from 'postcss';
import { afterEach, describe, expect, test } from 'vitest';
import { Cabecalho } from '../src/componentes/Cabecalho';
import { PreferenciasTema } from '../src/componentes/PreferenciasTema';
import { CHAVE_TEMA, lerTema } from '../src/logica/tema';
import { prefixar, semEsquema, temaManual } from '../tema-css';

const transformar = (css: string) => postcss([temaManual()]).process(css, { from: undefined }).css;

describe('plugin do tema (CSS)', () => {
  test('prefixa sem mudar a especificidade', () => {
    expect(prefixar(':root', "[data-tema='claro']")).toBe(":root:where([data-tema='claro'])");
    expect(prefixar('html body', ':not([data-tema])')).toBe('html:where(:not([data-tema])) body');
    expect(prefixar('.tampo > .carta', "[data-tema='escuro']")).toBe(":where(:root[data-tema='escuro']) .tampo > .carta");
    expect(prefixar(':root-ish', ':x')).toBe(':where(:root:x) :root-ish');
  });

  test('tira o prefers-color-scheme e mantém o resto da media query', () => {
    expect(semEsquema('(prefers-color-scheme: light)')).toBe('');
    expect(semEsquema('(prefers-color-scheme: dark) and (max-width: 600px)')).toBe('(max-width: 600px)');
    expect(semEsquema('screen and (prefers-color-scheme: dark)')).toBe('screen');
  });

  test('cada bloco vira automático (sem data-tema) + escolhido à mão', () => {
    const css = transformar(`
      :root { --fundo: preto; }
      @media (prefers-color-scheme: light) {
        :root { --fundo: branco; }
        body, .x { cor: tinta; }
      }
      @media (prefers-color-scheme: dark) and (max-width: 600px) {
        .y { cor: giz; }
        @keyframes z { from { opacity: 0; } }
      }
    `);
    expect(css).toContain('@media (prefers-color-scheme: light)');
    expect(css).toContain(':root:where(:not([data-tema])) { --fundo: branco; }');
    expect(css).toContain(":root:where([data-tema='claro']) { --fundo: branco; }");
    expect(css).toContain(":where(:root[data-tema='claro']) body, :where(:root[data-tema='claro']) .x");
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain(":where(:root[data-tema='escuro']) .y");
    expect(css).toContain(':where(:root:not([data-tema])) .y');
    expect(css).not.toContain('where(:root:not([data-tema])) from');
    // a regra base (fora de media query) fica como estava
    expect(css).toContain(':root { --fundo: preto; }');
  });
});

describe('tema dentro do perfil, sem ocupar a navegação', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.tema;
  });

  test('o cabeçalho fica sem botão de tema e mantém a ajuda', () => {
    render(<Cabecalho pronta usuario={null} aoSair={() => {}} />);
    expect(screen.queryByRole('button', { name: /^Tema:/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Como jogar' })).toHaveAttribute('href', '#/como-jogar');
  });

  test('troca entre claro, escuro e automático, salvando preferência neste aparelho', async () => {
    const user = userEvent.setup();
    render(<PreferenciasTema />);
    const claro = screen.getByRole('button', { name: 'Claro' });
    const escuro = screen.getByRole('button', { name: 'Escuro' });
    const auto = screen.getByRole('button', { name: 'Automático' });

    expect(auto).toHaveAttribute('aria-pressed', 'true');
    await user.click(claro);
    expect(claro).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.tema).toBe('claro');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('claro');

    await user.click(escuro);
    expect(escuro).toHaveAttribute('aria-pressed', 'true');
    expect(lerTema()).toBe('escuro');
    expect(document.documentElement.dataset.tema).toBe('escuro');

    await user.click(auto);
    expect(auto).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(localStorage.getItem(CHAVE_TEMA)).toBeNull();
  });

  test('ao reabrir o perfil usa a preferência armazenada; valor inválido vira automático', () => {
    localStorage.setItem(CHAVE_TEMA, 'escuro');
    const { unmount } = render(<PreferenciasTema />);
    expect(screen.getByRole('button', { name: 'Escuro' })).toHaveAttribute('aria-pressed', 'true');
    unmount();
    localStorage.setItem(CHAVE_TEMA, 'roxo');
    render(<PreferenciasTema />);
    expect(screen.getByRole('button', { name: 'Automático' })).toHaveAttribute('aria-pressed', 'true');
    expect(lerTema()).toBe('auto');
  });
});
