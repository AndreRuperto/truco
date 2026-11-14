import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { AvisoBonus } from '../src/componentes/AvisoBonus';
import { avisoDosBonus } from '../src/logica/lojaApp';

const lanc = (motivo: string, delta: number) => ({ motivo, delta, moeda: 'fichas' }) as never;

describe('avisoDosBonus', () => {
  test('sem bônus, sem aviso', () => {
    expect(avisoDosBonus([])).toBeNull();
  });
  test('cadastro vira o vale de boas-vindas com o total ganho', () => {
    expect(avisoDosBonus([lanc('cadastro', 1000), lanc('diario', 100)])).toEqual({
      tipo: 'boas-vindas',
      fichas: 1100 });
  });
  test('bônus do dia', () => {
    expect(avisoDosBonus([lanc('diario', 100)])).toEqual({ tipo: 'diario', fichas: 100 });
  });
  test('resgate', () => {
    expect(avisoDosBonus([lanc('resgate', 480)])).toEqual({
      tipo: 'resgate',
      fichas: 500 });
  });
});

describe('AvisoBonus', () => {
  test('bônus do dia: cartão que some sozinho quando a barra de tempo acaba', () => {
    const fechar = vi.fn();
    render(<AvisoBonus aviso={{ tipo: 'diario', fichas: 100 }} aoFechar={fechar} />);
    const caixa = screen.getByRole('status');
    expect(caixa).toHaveClass('aviso-bonus', 'aviso-cartao');
    expect(caixa).toHaveTextContent('Bônus do dia');
    expect(caixa).toHaveTextContent('+100 Fichas');
    expect(screen.queryByRole('button', { name: 'Guardar no bolso' })).toBeNull();
    fireEvent.animationEnd(screen.getByTestId('aviso-bonus-tempo'));
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  test('bônus do dia: o X fecha antes', async () => {
    const fechar = vi.fn();
    render(<AvisoBonus aviso={{ tipo: 'diario', fichas: 100 }} aoFechar={fechar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  test('resgate usa o mesmo cartão com o saldo novo', () => {
    render(<AvisoBonus aviso={{ tipo: 'resgate', fichas: 500 }} aoFechar={() => {}} />);
    const caixa = screen.getByRole('status');
    expect(caixa).toHaveClass('aviso-cartao');
    expect(caixa).toHaveTextContent('Resgate do dia');
    expect(caixa).toHaveTextContent('500 Fichas');
  });

  test('boas-vindas: vale de papel, sem botão de ação, que também some sozinho', async () => {
    const fechar = vi.fn();
    render(
      <AvisoBonus
        aviso={{ tipo: 'boas-vindas', fichas: 1100 }}
        aoFechar={fechar}
      />,
    );
    const caixa = screen.getByRole('status');
    expect(caixa).toHaveClass('aviso-bonus', 'aviso-vale');
    expect(caixa).toHaveTextContent('Bem-vindo ao boteco');
    expect(caixa).toHaveTextContent('+1.100 Fichas');
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Fechar aviso']);
    fireEvent.animationEnd(screen.getByTestId('aviso-bonus-tempo'));
    expect(fechar).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(fechar).toHaveBeenCalledTimes(2);
  });
});
