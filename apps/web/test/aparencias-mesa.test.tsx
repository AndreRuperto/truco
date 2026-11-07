import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SeletorAparenciaMesa } from '../src/componentes/SeletorAparenciaMesa';
import { aparenciaPermitida, CHAVE_APARENCIA_MESA, lerAparenciaMesa, salvarAparenciaMesa, superficieAtual } from '../src/logica/aparenciaMesa';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('aparências disponíveis na partida', () => {
  test('madeira é padrão, preferência válida persiste e sem conta não libera feltro', () => {
    expect(lerAparenciaMesa()).toBe('madeira');
    salvarAparenciaMesa('feltro');
    expect(localStorage.getItem(CHAVE_APARENCIA_MESA)).toBe('feltro');
    expect(aparenciaPermitida(lerAparenciaMesa(), false)).toBe('madeira');
    expect(aparenciaPermitida(lerAparenciaMesa(), true)).toBe('feltro');
    expect(superficieAtual('feltro', true)).toBe('plastico');
    expect(superficieAtual('madeira', true)).toBe('plastico');
    salvarAparenciaMesa('plastico');
    expect(lerAparenciaMesa()).toBe('plastico');
    localStorage.setItem(CHAVE_APARENCIA_MESA, 'valor-invalido');
    expect(lerAparenciaMesa()).toBe('madeira');
  });

  test('visitante pode usar madeira e plástico, mas feltro Premium exige conta', async () => {
    const user = userEvent.setup();
    const aoEscolher = vi.fn();
    render(<SeletorAparenciaMesa valor="madeira" temConta={false} aoEscolher={aoEscolher} aoFechar={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Aparência da mesa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Feltro de clube/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Plástico de bar/ }));
    expect(aoEscolher).toHaveBeenCalledWith('plastico');
    expect(screen.getByText(/entre na sua conta/i)).toBeInTheDocument();
  });

  test('usuário logado experimenta feltro sem cobrança e mantém alternativa madeira', async () => {
    const user = userEvent.setup();
    const aoEscolher = vi.fn();
    const aoFechar = vi.fn();
    render(<SeletorAparenciaMesa valor="madeira" temConta={true} aoEscolher={aoEscolher} aoFechar={aoFechar} />);
    const feltro = screen.getByRole('button', { name: /Feltro de clube/ });
    expect(feltro).toBeEnabled();
    await user.click(feltro);
    expect(aoEscolher).toHaveBeenCalledWith('feltro');
    expect(screen.getByText(/prévia gratuita para contas/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fechar personalização' }));
    expect(aoFechar).toHaveBeenCalledOnce();
  });
});
