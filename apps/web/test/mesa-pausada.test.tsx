import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { MesaPausada } from '../src/componentes/MesaPausada';

describe('MesaPausada', () => {
  test('quem pode pausar vê o tempo que falta e o Continuar (com foco)', async () => {
    const aoRetomar = vi.fn();
    render(<MesaPausada restamMs={9 * 60_000 + 5_000} quem={null} aoRetomar={aoRetomar} />);
    const caixa = screen.getByRole('dialog', { name: 'Mesa pausada' });
    expect(caixa).toHaveTextContent('Volta sozinha em 9:05');
    const continuar = screen.getByRole('button', { name: 'Continuar' });
    expect(continuar).toHaveFocus();
    await userEvent.click(continuar);
    expect(aoRetomar).toHaveBeenCalledOnce();
  });

  test('os outros veem quem pausou, sem botão', () => {
    render(<MesaPausada restamMs={30_000} quem="Admin Zé" />);
    expect(screen.getByRole('dialog', { name: 'Mesa pausada' })).toHaveTextContent('Admin Zé pausou a mesa.');
    expect(screen.getByText(/Volta sozinha em 0:30/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
