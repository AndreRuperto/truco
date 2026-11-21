import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Lobby } from '../src/telas/Lobby';

beforeEach(() => localStorage.clear());

// Pedido do André (2026-11-21): um "?" que explica cada regra, e nada entre parênteses nos rótulos.
describe('ajuda das regras da mesa', () => {
  test('cada regra tem o seu "?"; tocar abre a explicação, tocar de novo fecha', async () => {
    const user = userEvent.setup();
    render(<Lobby aoJogar={vi.fn()} aoCriarPrivada={vi.fn()} />);
    await user.click(screen.getByText('Regras da mesa'));
    const grade = document.querySelector('.regras-grade') as HTMLElement;
    const ajudas = within(grade).getAllByRole('button', { name: /^O que é/ });
    // Variante, pontuação, família, mão de ferro, tempo de família, tempo por jogada, humanos, bots,
    // sinais, provocações, interceptar, mão de 11, mão limpa (o padrão é mineiro com família).
    expect(ajudas.length).toBeGreaterThanOrEqual(12);

    const variante = screen.getByRole('button', { name: 'O que é Variante?' });
    expect(variante).toHaveAttribute('aria-expanded', 'false');
    await user.click(variante);
    expect(variante).toHaveAttribute('aria-expanded', 'true');
    const texto = document.getElementById(variante.getAttribute('aria-controls')!)!;
    expect(texto).toHaveTextContent(/vira/);
    expect(texto).toHaveTextContent(/manilhas são fixas/);
    // O campo passa a ser descrito pela explicação (leitor de tela).
    expect(screen.getByLabelText('Variante')).toHaveAttribute('aria-describedby', texto.id);
    await user.click(variante);
    expect(variante).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(texto.id)).toBeNull();
  });

  test('o "?" não muda a regra (nem marca/desmarca a caixa ao lado)', async () => {
    const user = userEvent.setup();
    render(<Lobby aoJogar={vi.fn()} />);
    await user.click(screen.getByText('Regras da mesa'));
    const sinais = screen.getByRole('checkbox', { name: 'Sinais entre parceiros' });
    const antes = (sinais as HTMLInputElement).checked;
    await user.click(screen.getByRole('button', { name: 'O que é Sinais entre parceiros?' }));
    expect((sinais as HTMLInputElement).checked).toBe(antes);
    expect(screen.getByText(/combinados com o parceiro/)).toBeInTheDocument();
  });

  test('nenhum rótulo nem opção das regras tem texto entre parênteses', async () => {
    const user = userEvent.setup();
    render(<Lobby aoJogar={vi.fn()} aoCriarPrivada={vi.fn()} />);
    await user.click(screen.getByText('Regras da mesa'));
    const textos = [...document.querySelectorAll('.lobby-principal label, .regras-grade label, .regras-grade option')].map((e) => e.textContent ?? '');
    expect(textos.filter((t) => /[()]/.test(t))).toEqual([]);
    // Os textos que saíram dos parênteses estão no "?".
    await user.click(screen.getByRole('button', { name: 'O que é Mesa privada?' }));
    expect(screen.getByText(/Só entra quem tiver o link/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'O que é Provocações?' }));
    expect(screen.getByText(/Toque no nome de alguém/)).toBeInTheDocument();
  });
});
