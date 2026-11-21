import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Lobby } from '../src/telas/Lobby';

beforeEach(() => localStorage.clear());

/** Rótulos das regras na ordem da tela, com o grupo de cada um. */
function ordem(): string[] {
  const grade = document.querySelector('.regras-grade')!;
  return [...grade.querySelectorAll('.regras-grupo, .campo-rotulo label, .campo-check')].map((e) =>
    e.classList.contains('regras-grupo') ? `# ${e.textContent}` : (e.textContent ?? '').trim(),
  );
}

// Pedido do André (2026-11-21): as regras em três grupos, cada uma perto da que tem a ver com ela.
describe('regras da mesa em grupos', () => {
  test('Jogo, Jogadores e tempo, Na mesa — com mão de 11 junto da mão de ferro e interceptar logo abaixo de sinais', async () => {
    const user = userEvent.setup();
    render(<Lobby aoJogar={vi.fn()} />);
    await user.click(screen.getByText('Regras da mesa'));
    // Padrão da casa: mineiro, família fechada, mão limpa, sinais desligados.
    await user.click(screen.getByRole('checkbox', { name: 'Sinais entre parceiros' }));
    expect(ordem()).toEqual([
      '# Jogo',
      'Variante',
      'Pontuação',
      'Família',
      'Mão de ferro',
      'Mão de 11',
      'Mão limpa',
      '# Jogadores e tempo',
      'Humanos',
      'Bots',
      'Tempo por jogada',
      'Tempo para pedir família',
      '# Na mesa',
      'Sinais entre parceiros',
      'Adversários podem interceptar sinais',
      'Provocações',
    ]);
    const grupos = within(document.querySelector('.regras-grade') as HTMLElement).getAllByRole('heading');
    expect(grupos.map((g) => g.textContent)).toEqual(['Jogo', 'Jogadores e tempo', 'Na mesa']);
  });

  test('com 4 humanos não há bot: o campo "Bots" some', async () => {
    const user = userEvent.setup();
    render(<Lobby aoJogar={vi.fn()} />);
    await user.click(screen.getByText('Regras da mesa'));
    expect(screen.getByLabelText('Bots')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Humanos'), '4');
    expect(screen.queryByLabelText('Bots')).toBeNull();
  });
});
