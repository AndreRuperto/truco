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
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar).toHaveBeenCalledWith({
      nome: 'Ana',
      variante: 'mineiro',
      humanos: 2,
      nivelBot: 'dificil',
      regras: { pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'onzeAOnze', familia: 'fechada' },
      chanceInterceptarSinal: 0,
      chaveRegras: '2-4-8-10-12|m10:1|m11:onzeAOnze|fam:fechada|int:0',
      modo: 'desafio',
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
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar.mock.calls[0][0]).toMatchObject({
      nome: 'Jogador',
      variante: 'paulista',
      regras: { pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'qualquerDupla', familia: 'aberta' },
    });
  });

  test('interceptação de sinais: padrão "Nunca"; escolher manda a chance', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} />);
    const campo = screen.getByLabelText('Adversários podem interceptar sinais');
    expect(campo).toHaveDisplayValue('Nunca');
    await user.selectOptions(campo, 'Às vezes');
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar.mock.calls[0][0]).toMatchObject({ chanceInterceptarSinal: 0.25, chaveRegras: expect.stringMatching(/\|int:0\.25$/) });
    await user.selectOptions(campo, 'Fácil');
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar.mock.calls[1][0]).toMatchObject({ chanceInterceptarSinal: 0.5 });
  });

  test('preenche o apelido salvo; botão Ranqueada chama aoRanqueada', async () => {
    const user = userEvent.setup();
    localStorage.setItem(CHAVE_APELIDO, 'Bia');
    const aoRanqueada = vi.fn();
    render(<Lobby aoJogar={vi.fn()} aoRanqueada={aoRanqueada} />);
    expect(screen.getByLabelText('Apelido')).toHaveValue('Bia');
    await user.click(screen.getByRole('button', { name: 'Ranqueada' }));
    expect(aoRanqueada).toHaveBeenCalled();
  });

  test('regras ficam num bloco recolhível com o resumo de uma linha', async () => {
    const user = userEvent.setup();
    render(<Lobby aoJogar={vi.fn()} />);
    const resumo = screen.getByText('Regras da mesa').closest('summary')!;
    expect(resumo.closest('details')).not.toHaveAttribute('open');
    expect(resumo).toHaveTextContent('Paulista, 1-3-6-9-12, mão de 11, sem família, 3 bots fáceis');
    await user.selectOptions(screen.getByLabelText('Humanos'), '2');
    expect(resumo).toHaveTextContent('2 bots fáceis');
  });

  test('mesa privada: chama aoCriarPrivada em vez de aoJogar', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    const aoCriarPrivada = vi.fn();
    render(<Lobby aoJogar={aoJogar} aoCriarPrivada={aoCriarPrivada} />);
    await user.click(screen.getByLabelText('Mesa privada (só entra quem tiver o link)'));
    await user.click(screen.getByRole('button', { name: 'Criar mesa privada' }));
    expect(aoJogar).not.toHaveBeenCalled();
    expect(aoCriarPrivada.mock.calls[0][0]).toMatchObject({ modo: 'privada' });
  });
});
