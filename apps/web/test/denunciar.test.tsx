import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Denunciar } from '../src/componentes/Denunciar';

const PESSOAS = [
  { cadeira: 1 as const, nome: 'bia' },
  { cadeira: 3 as const, nome: 'Zé' },
];

describe('Denunciar (F6.5)', () => {
  test('escolhe a pessoa, escreve o motivo e envia; a resposta aparece num status', async () => {
    const user = userEvent.setup();
    const aoDenunciar = vi.fn();
    const { rerender } = render(<Denunciar pessoas={PESSOAS} resposta={null} aoDenunciar={aoDenunciar} aoFechar={vi.fn()} />);
    const dialogo = screen.getByRole('dialog', { name: 'Denunciar' });
    expect(dialogo).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Quem'), 'Zé');
    await user.type(screen.getByLabelText(/Motivo/), 'xingou no chat');
    await user.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
    expect(aoDenunciar).toHaveBeenCalledWith(3, 'xingou no chat');
    rerender(<Denunciar pessoas={PESSOAS} resposta={{ id: 1, resultado: 'ok' }} aoDenunciar={aoDenunciar} aoFechar={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Denúncia enviada');
  });

  test('motivo é obrigatório e tem no máximo 140 letras', async () => {
    const user = userEvent.setup();
    const aoDenunciar = vi.fn();
    render(<Denunciar pessoas={PESSOAS} resposta={null} aoDenunciar={aoDenunciar} aoFechar={vi.fn()} />);
    expect(screen.getByLabelText(/Motivo/)).toHaveAttribute('maxLength', '140');
    await user.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
    expect(aoDenunciar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Diga o motivo');
  });

  test('respostas de erro viram frases: repetida, sem conta', () => {
    const p = { pessoas: PESSOAS, aoDenunciar: vi.fn(), aoFechar: vi.fn() };
    const { rerender } = render(<Denunciar {...p} resposta={{ id: 1, resultado: 'repetida' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('já denunciou');
    rerender(<Denunciar {...p} resposta={{ id: 2, resultado: 'sem-conta' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Entre na sua conta');
  });

  test('Esc e o botão Fechar fecham', async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    render(<Denunciar pessoas={PESSOAS} resposta={null} aoDenunciar={vi.fn()} aoFechar={aoFechar} />);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).toHaveBeenCalledTimes(2);
  });
});
