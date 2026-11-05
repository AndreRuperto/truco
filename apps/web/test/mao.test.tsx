import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Mao } from '../src/componentes/Mao';
import { c } from './fixtures';

const CARTAS = [c('4o'), c('7c'), c('Ae')]; // mineiro: 7♥ = Copas, A♠ = Espadilha

describe('Mao', () => {
  test('só as jogáveis ficam habilitadas; clicar joga aberta', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Mao cartas={CARTAS} jogaveis={[0, 2]} cobriveis={[]} variante="mineiro" vira={null} aoJogar={aoJogar} />);
    expect(screen.getByRole('button', { name: '4 de ouros' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '7 de copas — Copas' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Ás de espadas — Espadilha' }));
    expect(aoJogar).toHaveBeenCalledWith(2, false);
    expect(screen.queryByRole('button', { name: 'Jogar coberta' })).toBeNull();
  });

  test('modo coberta: liga, joga virada e desliga', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Mao cartas={CARTAS} jogaveis={[0, 1, 2]} cobriveis={[0, 1, 2]} variante="mineiro" vira={null} aoJogar={aoJogar} />);
    const alternar = screen.getByRole('button', { name: 'Jogar coberta' });
    expect(alternar).toHaveAttribute('aria-pressed', 'false');
    await user.click(alternar);
    expect(alternar).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '4 de ouros (coberta)' }));
    expect(aoJogar).toHaveBeenCalledWith(0, true);
    expect(alternar).toHaveAttribute('aria-pressed', 'false');
  });

  test('mão de ferro: três versos, escolho um às cegas', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Mao cartas={[null, null, null]} jogaveis={[0, 1, 2]} cobriveis={[]} variante="paulista" vira={c('5p')} aoJogar={aoJogar} />);
    expect(screen.getAllByRole('button', { name: /^Carta virada/ })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Carta virada 2' }));
    expect(aoJogar).toHaveBeenCalledWith(1, false);
  });
});
