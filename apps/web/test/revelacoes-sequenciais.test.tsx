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
  test('revela as cartas na lateral, em ordem, sem mostrar as quatro no centro de uma vez', () => {
    let s = jogar(distribuida(PAULISTA, [
      ['3o', '4o', '5o'],
      ['3e', '4e', '5e'],
      ['4c', '5c', '6c'],
      ['4p', '5p', '6p'],
    ], [0, 0], '7o'), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.fase).toBe('empilhando');
    for (const cadeira of [0, 1, 2, 3] as const) s = reduce(s, { tipo: 'empilhar', cadeira, indice: 0 });
    s = reduce(s, { tipo: 'mostrar', cadeira: s.mao!.vez });
    const v = visaoDoJogador(s, 0);
    render(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={0} variante="paulista" />);
    const lateral = screen.getByTestId('cangada-lateral');
    expect(screen.getByTestId('centro').querySelectorAll('.jogada')).toHaveLength(0);
    expect(lateral).toHaveAttribute('data-abertas', '0');
    expect(lateral.querySelectorAll('.carta.verso')).toHaveLength(4);
    for (let i = 1; i <= 4; i++) {
      act(() => vi.advanceTimersByTime(250));
      expect(lateral).toHaveAttribute('data-abertas', String(i));
      expect(lateral.querySelectorAll('.carta.verso')).toHaveLength(4 - i);
    }
    act(() => vi.advanceTimersByTime(MOSTRA_RODADA_MS - 1_000));
    expect(screen.queryByTestId('cangada-lateral')).toBeNull();
  });

  test('a lateral da cangada não passa para a mão seguinte (sai quando chega mão nova sem rodada)', () => {
    let s = jogar(distribuida(PAULISTA, [
      ['3o', '4o', '5o'],
      ['3e', '4e', '5e'],
      ['4c', '5c', '6c'],
      ['4p', '5p', '6p'],
    ], [0, 0], '7o'), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    for (const cadeira of [0, 1, 2, 3] as const) s = reduce(s, { tipo: 'empilhar', cadeira, indice: 0 });
    s = reduce(s, { tipo: 'mostrar', cadeira: s.mao!.vez });
    const v = visaoDoJogador(s, 0);
    const { rerender } = render(<CentroMesa mao={v.mao} ultimaMao={v.ultimaMao} minha={0} variante="paulista" />);
    expect(screen.getByTestId('cangada-lateral')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    // Antes de MOSTRA_RODADA_MS, a mesa já está na mão seguinte (modo rápido, bots ligeiros).
    const nova = visaoDoJogador(distribuida(PAULISTA), 0);
    expect(nova.mao!.rodadasJogadas).toHaveLength(0);
    rerender(<CentroMesa mao={nova.mao} ultimaMao={null} minha={0} variante="paulista" />);
    expect(screen.queryByTestId('cangada-lateral')).toBeNull();
  });
});
