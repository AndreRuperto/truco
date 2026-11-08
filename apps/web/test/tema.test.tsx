import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import postcss from 'postcss';
import { afterEach, describe, expect, test } from 'vitest';
import { Cabecalho } from '../src/componentes/Cabecalho';
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

describe('botão de tema no cabeçalho', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.tema;
  });

  test('automático → claro → escuro → automático; marca o <html> e lembra', async () => {
    const user = userEvent.setup();
    render(<Cabecalho pronta usuario={null} aoSair={() => {}} />);
    const botao = () => screen.getByRole('button', { name: /^Tema:/ });
    expect(botao()).toHaveAccessibleName('Tema: Automático. Tocar muda para Claro.');
    await user.click(botao());
    expect(document.documentElement.dataset.tema).toBe('claro');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('claro');
    await user.click(botao());
    expect(document.documentElement.dataset.tema).toBe('escuro');
    expect(lerTema()).toBe('escuro');
    await user.click(botao());
    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(localStorage.getItem(CHAVE_TEMA)).toBeNull();
    expect(botao()).toHaveAccessibleName('Tema: Automático. Tocar muda para Claro.');
  });

  test('abre no tema salvo; valor estranho vira automático', () => {
    localStorage.setItem(CHAVE_TEMA, 'escuro');
    const { unmount } = render(<Cabecalho pronta usuario={null} aoSair={() => {}} />);
    expect(screen.getByRole('button', { name: /^Tema: Escuro/ })).toBeInTheDocument();
    unmount();
    localStorage.setItem(CHAVE_TEMA, 'roxo');
    expect(lerTema()).toBe('auto');
  });
});
