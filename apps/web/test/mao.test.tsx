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

  test('coringa na mão vira botão "Coringa"', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Mao cartas={[c('Cc'), c('3o'), c('4p')]} jogaveis={[0, 1, 2]} cobriveis={[]} variante="mineiro" vira={null} aoJogar={aoJogar} />);
    await user.click(screen.getByRole('button', { name: 'Coringa' }));
    expect(aoJogar).toHaveBeenCalledWith(0, false);
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

  test('"Jogar coberta" é um botão curto: uma palavra visível, verso desenhado e o nome completo para leitor de tela', () => {
    render(<Mao cartas={CARTAS.slice(0, 2)} jogaveis={[0, 1]} cobriveis={[0, 1]} variante="mineiro" vira={null} aoJogar={vi.fn()} />);
    const alternar = screen.getByRole('button', { name: 'Jogar coberta' });
    // Uma palavra só: no celular o texto em duas linhas ("Jogar / coberta") ficava solto ao lado da mão.
    expect(alternar).toHaveTextContent(/^Coberta$/);
    expect(alternar).toHaveAttribute('title', 'Jogar a próxima carta virada para baixo');
    const verso = alternar.querySelector('.alternar-coberta-verso');
    expect(verso).not.toBeNull();
    expect(verso).toHaveAttribute('aria-hidden', 'true');
  });

  test('modo coberta pelo teclado: Tab chega ao botão, espaço liga e Enter desliga', async () => {
    const user = userEvent.setup();
    render(<Mao cartas={CARTAS.slice(0, 2)} jogaveis={[0, 1]} cobriveis={[0, 1]} variante="mineiro" vira={null} aoJogar={vi.fn()} />);
    const alternar = screen.getByRole('button', { name: 'Jogar coberta' });
    await user.tab();
    await user.tab();
    await user.tab();
    expect(alternar).toHaveFocus();
    await user.keyboard(' ');
    expect(alternar).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '4 de ouros (coberta)' })).toBeEnabled();
    await user.keyboard('{Enter}');
    expect(alternar).toHaveAttribute('aria-pressed', 'false');
  });

  test('modo coberta desliga quando deixa de poder cobrir', async () => {
    const user = userEvent.setup();
    const props = { cartas: CARTAS, jogaveis: [0, 1, 2], variante: 'mineiro' as const, vira: null, aoJogar: vi.fn() };
    const { rerender } = render(<Mao {...props} cobriveis={[0, 1, 2]} />);
    await user.click(screen.getByRole('button', { name: 'Jogar coberta' }));
    rerender(<Mao {...props} cobriveis={[]} />);
    expect(screen.queryByRole('button', { name: 'Jogar coberta' })).toBeNull();
    rerender(<Mao {...props} cobriveis={[0, 1, 2]} />);
    expect(screen.getByRole('button', { name: 'Jogar coberta' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '4 de ouros' })).toBeEnabled();
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
