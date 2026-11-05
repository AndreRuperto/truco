import { reduce, visaoDoJogador } from '@truco/engine';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { CentroMesa } from '../src/componentes/CentroMesa';
import { distribuida, jogar, PAULISTA } from './fixtures';

// Paulista, vira 7♦ (manilha = Dama). A cadeira 0 tem os 3 e o 2: leva as duas rodadas.
const MAOS = [
  ['3o', '3e', '2o'],
  ['4e', '5e', '6e'],
  ['4c', '5c', '6c'],
  ['4p', '5p', '6p'],
];
const inicio = () => distribuida(PAULISTA, MAOS, [0, 0], '7o');

const jogadaDe = (pos: string) => document.querySelector(`.jogada.pos-${pos}`) as HTMLElement | null;

describe('CentroMesa', () => {
  test('cada jogada fica na posição da cadeira, relativa a mim', () => {
    const s = jogar(inicio(), [[0, 0], [1, 0], [2, 0]]);
    const v = visaoDoJogador(s, 1);
    render(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={1} variante="paulista" />);
    // Eu sou a 1: a 0 fica à esquerda, a 2 à direita, a 1 embaixo; a 3 (cima) ainda não jogou.
    expect(within(jogadaDe('esquerda')!).getByRole('img', { name: /^3 de ouros/ })).toBeInTheDocument();
    expect(within(jogadaDe('baixo')!).getByRole('img', { name: /^4 de espadas/ })).toBeInTheDocument();
    expect(within(jogadaDe('direita')!).getByRole('img', { name: /^4 de copas/ })).toBeInTheDocument();
    expect(jogadaDe('cima')).toBeNull();
  });

  test('carta coberta de outro jogador aparece como verso', () => {
    let s = jogar(inicio(), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0, coberta: true });
    const v = visaoDoJogador(s, 1);
    render(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={1} variante="paulista" />);
    expect(within(jogadaDe('esquerda')!).getByRole('img', { name: 'carta virada' })).toBeInTheDocument();
  });

  test('no paulista mostra a vira', () => {
    const v = visaoDoJogador(inicio(), 0);
    render(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={0} variante="paulista" />);
    const vira = screen.getByTestId('centro').querySelector('.vira') as HTMLElement;
    expect(within(vira).getByRole('img', { name: /^7 de ouros/ })).toBeInTheDocument();
  });

  test('entre mãos: cartas da última rodada esmaecidas, vira e rodadas da mão que acabou', () => {
    const s = jogar(inicio(), [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]]);
    const v = visaoDoJogador(s, 0);
    expect(v.mao).toBeNull();
    render(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={0} variante="paulista" />);
    const centro = screen.getByTestId('centro');
    const baixo = within(jogadaDe('baixo')!).getByRole('img', { name: /^3 de espadas/ });
    expect(baixo).toHaveClass('esmaecida');
    expect(within(jogadaDe('direita')!).getByRole('img', { name: /^5 de espadas/ })).toHaveClass('esmaecida');
    expect(centro.querySelectorAll('.jogada')).toHaveLength(4);
    expect(within(centro.querySelector('.vira') as HTMLElement).getByRole('img', { name: /^7 de ouros/ })).toBeInTheDocument();
    expect(within(centro).getByLabelText('Rodadas').querySelectorAll('.marcador.nos')).toHaveLength(2);
  });
});
