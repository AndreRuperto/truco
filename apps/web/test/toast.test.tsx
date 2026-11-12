import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Toast } from '../src/componentes/Toast';

describe('Toast', () => {
  test('erro: alerta (interrompe o leitor de tela), some em 3,5 s', () => {
    vi.useFakeTimers();
    const fechar = vi.fn();
    render(<Toast erro={{ id: 1, mensagem: 'mesa cheia' }} aoFechar={fechar} />);
    const t = screen.getByRole('alert');
    expect(t).toHaveClass('toast');
    expect(t).not.toHaveClass('toast-aviso');
    vi.advanceTimersByTime(3_500);
    expect(fechar).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  // Ciclo 4: o resumo da volta não é erro; tom de lousa, status e mais tempo para ler.
  test('aviso: status (não interrompe), tom de lousa, some em 6 s', () => {
    vi.useFakeTimers();
    const fechar = vi.fn();
    render(<Toast erro={{ id: 2, mensagem: 'Enquanto você esteve fora: Nós 2 → 3, Eles 4 → 4.', tipo: 'aviso' }} aoFechar={fechar} />);
    const t = screen.getByRole('status');
    expect(t).toHaveClass('toast', 'toast-aviso');
    expect(screen.queryByRole('alert')).toBeNull();
    vi.advanceTimersByTime(3_500);
    expect(fechar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_500);
    expect(fechar).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });
});
