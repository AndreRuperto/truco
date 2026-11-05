import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { CHAVE_APELIDO } from '../src/logica/lobby';
import { Lobby } from '../src/telas/Lobby';

describe('Lobby', () => {
  test('monta as opções da sala a partir do formulário e lembra o apelido', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} />);
    await user.type(screen.getByLabelText('Apelido'), 'Ana');
    await user.selectOptions(screen.getByLabelText('Variante'), 'mineiro');
    expect(screen.getByLabelText('Pontuação')).toHaveValue('2-4-8-10-12');
    expect(screen.getByLabelText('Mão de 10')).toBeChecked();
    expect(screen.getByLabelText('Família')).toHaveValue('fechada');
    await user.selectOptions(screen.getByLabelText('Mão de 11'), 'onzeAOnze');
    await user.selectOptions(screen.getByLabelText('Humanos'), '2');
    await user.selectOptions(screen.getByLabelText('Bots'), 'dificil');
    await user.click(screen.getByRole('button', { name: 'Jogar' }));
    expect(aoJogar).toHaveBeenCalledWith({
      nome: 'Ana',
      variante: 'mineiro',
      humanos: 2,
      nivelBot: 'dificil',
      regras: { pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'onzeAOnze', familia: 'fechada' },
    });
    expect(localStorage.getItem(CHAVE_APELIDO)).toBe('Ana');
  });

  test('ligar mão de 10 e trocar pontuação/família', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} />);
    await user.click(screen.getByLabelText('Mão de 10'));
    await user.selectOptions(screen.getByLabelText('Pontuação'), '2-4-8-10-12');
    await user.selectOptions(screen.getByLabelText('Família'), 'aberta');
    await user.click(screen.getByRole('button', { name: 'Jogar' }));
    expect(aoJogar.mock.calls[0][0]).toMatchObject({
      nome: 'Jogador',
      variante: 'paulista',
      regras: { pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'qualquerDupla', familia: 'aberta' },
    });
  });

  test('preenche o apelido salvo; ranqueada fica para depois', () => {
    localStorage.setItem(CHAVE_APELIDO, 'Bia');
    render(<Lobby aoJogar={vi.fn()} />);
    expect(screen.getByLabelText('Apelido')).toHaveValue('Bia');
    expect(screen.getByRole('button', { name: 'Ranqueada (em breve)' })).toBeDisabled();
  });
});
