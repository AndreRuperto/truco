import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import { GuiaOrdem } from '../src/componentes/GuiaOrdem';
import { ordemDasCartas } from '../src/logica/ordem';
import { c } from './fixtures';

const mineiro = { variante: 'mineiro', maoLimpa: false } as const;
const paulista = { variante: 'paulista', maoLimpa: false } as const;
const texto = (o: ReturnType<typeof ordemDasCartas>) => o.degraus.map((d) => `${d.valor}${d.naipe ? d.naipe[0] : ''}`).join(' ');

describe('ordemDasCartas', () => {
  test('mineiro: 4 manilhas fixas, depois 3 2 A K J Q 7 6 5 4', () => {
    const o = ordemDasCartas(mineiro, null, []);
    expect(texto(o)).toBe('4p 7c Ae 7o 3 2 A K J Q 7 6 5 4');
    expect(o.degraus.slice(0, 4).every((d) => d.grupo === 'manilha')).toBe(true);
    expect(o.manilhasPendentes).toBe(false);
  });

  test('mineiro com mão limpa: coringa entre as manilhas e o 3, sem 4 a 7 comuns', () => {
    const o = ordemDasCartas({ variante: 'mineiro', maoLimpa: true }, null, []);
    expect(texto(o)).toBe('4p 7c Ae 7o C 3 2 A K J Q');
    expect(o.degraus[4].grupo).toBe('coringa');
  });

  test('paulista com vira: manilhas da carta seguinte (♣ ♥ ♠ ♦) e esse valor sai das comuns', () => {
    const o = ordemDasCartas(paulista, c('Jo'), []);
    expect(texto(o)).toBe('Kp Kc Ke Ko 3 2 A J Q 7 6 5 4');
  });

  test('paulista sem vira: manilhas pendentes, só as comuns', () => {
    const o = ordemDasCartas(paulista, null, []);
    expect(o.manilhasPendentes).toBe(true);
    expect(texto(o)).toBe('3 2 A K J Q 7 6 5 4');
  });

  test('marca a minha mão: manilha pelo naipe, comuns pelo valor (duas iguais contam 2)', () => {
    const o = ordemDasCartas(mineiro, null, [c('Ae'), c('Kc'), c('Ko'), null]);
    const minhas = o.degraus.filter((d) => d.minhas > 0).map((d) => [d.valor, d.minhas]);
    expect(minhas).toEqual([
      ['A', 1],
      ['K', 2],
    ]);
    // O A♠ é manilha: o Ás comum não fica marcado.
    expect(o.degraus.find((d) => d.grupo === 'comum' && d.valor === 'A')?.minhas).toBe(0);
  });
});

describe('GuiaOrdem', () => {
  beforeEach(() => localStorage.clear());

  test('abre e fecha pelo botão; sem nome de manilha; minha carta anunciada', async () => {
    const user = userEvent.setup();
    render(<GuiaOrdem regras={mineiro} vira={null} mao={[c('4p'), c('3c')]} />);
    const botao = screen.getByRole('button', { name: 'Ordem' });
    if (botao.getAttribute('aria-expanded') !== 'true') await user.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const lista = screen.getByRole('list', { name: /da mais forte para a mais fraca/ });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens[0]).toHaveAccessibleName('4 de paus, você tem uma');
    expect(within(lista).getByRole('listitem', { name: '3, você tem uma' })).toHaveClass('minha');
    expect(lista).not.toHaveTextContent(/Zap|Copas|Espadilha|Pica-fumo/);
    await user.click(botao);
    expect(screen.queryByRole('list')).toBeNull();
    expect(localStorage.getItem('truco.guiaOrdem')).toBe('0');
  });
});
