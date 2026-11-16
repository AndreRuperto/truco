import { reduce, visaoDoJogador } from '@truco/engine';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CentroMesa, MOSTRA_RODADA_MS } from '../src/componentes/CentroMesa';
import { FamiliasNaMesa } from '../src/componentes/FamiliasNaMesa';
import { distribuida, jogar, MINEIRO, PAULISTA } from './fixtures';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const nome = (c: number) => `Jogador ${c}`;

describe('revelação das famílias fechadas', () => {
  test('os adversários veem uma carta por vez quando conferem', () => {
    const pendente = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    const conferida = reduce(pendente, { tipo: 'conferir', cadeira: 1, conferir: true });
    const { rerender } = render(<FamiliasNaMesa visao={visaoDoJogador(pendente, 1)} nome={nome} />);
    expect(screen.getByTestId('familia').querySelectorAll('.carta.verso')).toHaveLength(3);
    rerender(<FamiliasNaMesa visao={visaoDoJogador(conferida, 1)} nome={nome} />);
    const lateral = screen.getByTestId('familia-conferida');
    expect(lateral.querySelectorAll('.carta.verso')).toHaveLength(3);
    act(() => vi.advanceTimersByTime(320));
    expect(lateral.querySelectorAll('.carta.verso')).toHaveLength(2);
    act(() => vi.advanceTimersByTime(320));
    expect(lateral.querySelectorAll('.carta.verso')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(320));
    expect(lateral.querySelectorAll('.carta.verso')).toHaveLength(0);
  });

  test('carta jogada logo depois de conferir: a família só sai depois de revelar as três', () => {
    const pendente = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    const conferida = reduce(pendente, { tipo: 'conferir', cadeira: 1, conferir: true });
    const jogou = jogar(conferida, [[conferida.mao!.vez, 0]]);
    const { rerender } = render(<FamiliasNaMesa visao={visaoDoJogador(pendente, 1)} nome={nome} />);
    rerender(<FamiliasNaMesa visao={visaoDoJogador(conferida, 1)} nome={nome} />);
    rerender(<FamiliasNaMesa visao={visaoDoJogador(jogou, 1)} nome={nome} />);
    const fig = screen.getByTestId('familia-conferida');
    act(() => vi.advanceTimersByTime(960));
    expect(fig.querySelectorAll('.carta.verso')).toHaveLength(0);
    act(() => vi.advanceTimersByTime(700));
    expect(screen.queryByTestId('familia-conferida')).toBeNull();
  });

  test('1ª rodada fechada logo depois de conferir: a família sai na hora (a pilha ocupa o canto)', () => {
    const pendente = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    const conferida = reduce(pendente, { tipo: 'conferir', cadeira: 1, conferir: true });
    let fechou = conferida;
    for (let k = 0; k < 4; k++) fechou = jogar(fechou, [[fechou.mao!.vez, 0]]);
    expect(fechou.fase, 'a 1ª rodada destas mãos não canga').not.toBe('empilhando');
    expect(fechou.mao!.rodadas.length).toBe(1);
    const { rerender } = render(<FamiliasNaMesa visao={visaoDoJogador(conferida, 1)} nome={nome} />);
    rerender(<FamiliasNaMesa visao={visaoDoJogador(fechou, 1)} nome={nome} />);
    expect(screen.queryByTestId('familia-conferida')).toBeNull();
  });

  test('carta jogada muito depois de conferir: a família sai na hora', () => {
    const pendente = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    const conferida = reduce(pendente, { tipo: 'conferir', cadeira: 1, conferir: true });
    const { rerender } = render(<FamiliasNaMesa visao={visaoDoJogador(conferida, 1)} nome={nome} />);
    act(() => vi.advanceTimersByTime(5_000));
    rerender(<FamiliasNaMesa visao={visaoDoJogador(jogar(conferida, [[conferida.mao!.vez, 0]]), 1)} nome={nome} />);
    expect(screen.queryByTestId('familia-conferida')).toBeNull();
  });

  test('quem entrar depois da conferência vê as três sem esperar', () => {
    const pendente = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    const conferida = reduce(pendente, { tipo: 'conferir', cadeira: 1, conferir: true });
    render(<FamiliasNaMesa visao={visaoDoJogador(conferida, 1)} nome={nome} />);
    expect(screen.getByTestId('familia-conferida').querySelectorAll('.carta.verso')).toHaveLength(0);
  });
});

describe('cangada na segunda rodada', () => {
  // Cada um mostra a sua na vez dele (o motor revela uma por vez): as cartas entram no centro como
  // jogadas normais, sem a lateral que antes escalonava as quatro reveladas de uma vez.
  test('cada carta mostrada aparece no centro na hora, uma por vez, sem lateral', () => {
    let s = jogar(distribuida(PAULISTA, [
      ['3o', '4o', '5o'],
      ['3e', '4e', '5e'],
      ['4c', '5c', '6c'],
      ['4p', '5p', '6p'],
    ], [0, 0], '7o'), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.fase).toBe('empilhando');
    for (const cadeira of [0, 1, 2, 3] as const) s = reduce(s, { tipo: 'empilhar', cadeira, indice: 0 });
    const v0 = visaoDoJogador(s, 0);
    const { rerender } = render(<CentroMesa mao={v0.mao} ultimaMao={v0.ultimaMao} minha={0} variante="paulista" />);
    act(() => vi.advanceTimersByTime(MOSTRA_RODADA_MS));
    for (let n = 1; n <= 3; n++) {
      s = reduce(s, { tipo: 'mostrar', cadeira: s.mao!.vez });
      const v = visaoDoJogador(s, 0);
      rerender(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={0} variante="paulista" />);
      expect(screen.getByTestId('centro').querySelectorAll('.jogada')).toHaveLength(n);
    }
    s = reduce(s, { tipo: 'mostrar', cadeira: s.mao!.vez });
    const v = visaoDoJogador(s, 0);
    rerender(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={0} variante="paulista" />);
    expect(screen.getByTestId('centro').querySelectorAll('.jogada')).toHaveLength(4);
    expect(screen.queryByTestId('cangada-lateral')).toBeNull();
  });
});

describe('cangada no mineiro', () => {
  test('as de cima viram juntas e ficam à vista até a 1ª de baixo ser aberta', () => {
    let s = jogar(distribuida(MINEIRO, [
      ['3o', '5o', '6o'],
      ['3e', '2e', '6e'],
      ['4o', '5e', 'Qo'],
      ['4e', '5c', 'Qe'],
    ]), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.fase).toBe('empilhando');
    const v0 = visaoDoJogador(s, 0);
    const { rerender } = render(<CentroMesa mao={v0.mao} ultimaMao={v0.ultimaMao} minha={0} variante="mineiro" />);
    for (const cadeira of [0, 1, 2, 3] as const) s = reduce(s, { tipo: 'empilhar', cadeira, indice: 0 });
    let v = visaoDoJogador(s, 0);
    rerender(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={0} variante="mineiro" />);
    expect(screen.getByTestId('centro').querySelectorAll('.jogada')).toHaveLength(4);
    act(() => vi.advanceTimersByTime(MOSTRA_RODADA_MS * 5));
    expect(screen.getByTestId('centro').querySelectorAll('.jogada'), 'as de cima continuam à vista').toHaveLength(4);
    s = reduce(s, { tipo: 'mostrar', cadeira: s.mao!.vez });
    v = visaoDoJogador(s, 0);
    rerender(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={0} variante="mineiro" />);
    expect(screen.getByTestId('centro').querySelectorAll('.jogada')).toHaveLength(1);
  });
});
