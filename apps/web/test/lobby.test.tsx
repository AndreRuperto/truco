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
    // Trocar de variante põe as regras da ranqueada dela (mantém humanos, bots e sinais).
    await user.selectOptions(screen.getByLabelText('Variante'), 'paulista');
    await user.selectOptions(screen.getByLabelText('Variante'), 'mineiro');
    expect(screen.getByLabelText('Pontuação')).toHaveValue('2-4-8-10-12');
    expect(screen.getByLabelText('Mão de 10')).toBeChecked();
    expect(screen.getByLabelText('Família')).toHaveValue('fechada');
    await user.selectOptions(screen.getByLabelText('Mão de ferro'), 'off');
    await user.selectOptions(screen.getByLabelText('Humanos'), '2');
    await user.selectOptions(screen.getByLabelText('Bots'), 'dificil');
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar).toHaveBeenCalledWith({
      nome: 'Ana',
      variante: 'mineiro',
      humanos: 2,
      nivelBot: 'dificil',
      regras: { pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'off', familia: 'fechada', maoLimpa: false },
      chanceInterceptarSinal: 0.25,
      tempoFamiliaS: 20,
      sinais: false,
      provocacoes: true,
      ritmo: 'calmo',
      tempoJogadaS: 20,
      chaveRegras: '2-4-8-10-12|m10:1|m11:off|fam:fechada|lim:0|int:0.25|tf:20|sin:0',
      modo: 'desafio',
      cacife: 0,
    });
    expect(localStorage.getItem(CHAVE_APELIDO)).toBe('Ana');
  });

  test('o rótulo segue a pontuação (mão de 11 / de 10); desligar e trocar pontuação/família', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} />);
    await user.selectOptions(screen.getByLabelText('Variante'), 'paulista');
    expect(screen.getByLabelText('Mão de 11')).toBeChecked();
    expect(screen.getByRole('option', { name: 'Só no 11 a 11' })).toBeInTheDocument();
    await user.click(screen.getByLabelText('Mão de 11'));
    await user.selectOptions(screen.getByLabelText('Pontuação'), '2-4-8-10-12');
    expect(screen.getByLabelText('Mão de 10')).not.toBeChecked();
    expect(screen.getByRole('option', { name: 'Só no 10 a 10' })).toBeInTheDocument();
    // Família só existe no mineiro: no paulista o campo nem aparece e a mesa vai sem ela.
    expect(screen.queryByLabelText('Família')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar.mock.calls[0][0]).toMatchObject({
      nome: 'Jogador',
      variante: 'paulista',
      regras: { pontuacao: '2-4-8-10-12', maoDe10: false, maoDe11: 'onzeAOnze', familia: 'off' },
    });
  });

  test('mão limpa: só aparece no mineiro, entra no resumo e nas opções; some ao voltar ao paulista', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} />);
    await user.selectOptions(screen.getByLabelText('Variante'), 'paulista');
    expect(screen.queryByLabelText(/Mão limpa/)).toBeNull();
    await user.selectOptions(screen.getByLabelText('Variante'), 'mineiro');
    const caixa = screen.getByRole('checkbox', { name: /Mão limpa/ });
    expect(caixa).not.toBeChecked();
    // O que era o "(sem 4 a 7, com 2 coringas)" agora está no "?".
    await user.click(screen.getByRole('button', { name: 'O que é Mão limpa?' }));
    expect(screen.getByText(/4, 5, 6 e 7 comuns e põe 2 coringas/)).toBeInTheDocument();
    await user.click(caixa);
    const resumo = screen.getByText('Regras da mesa').closest('summary')!;
    expect(resumo).toHaveTextContent('mão limpa');
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar.mock.calls[0][0]).toMatchObject({ variante: 'mineiro', regras: { maoLimpa: true }, chaveRegras: expect.stringContaining('|lim:1|') });
    await user.selectOptions(screen.getByLabelText('Variante'), 'paulista');
    expect(screen.queryByLabelText(/Mão limpa/)).toBeNull();
    expect(resumo).not.toHaveTextContent('mão limpa');
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar.mock.calls[1][0]).toMatchObject({ variante: 'paulista', regras: { maoLimpa: false } });
    await user.selectOptions(screen.getByLabelText('Variante'), 'mineiro');
    expect(screen.getByRole('checkbox', { name: /Mão limpa/ })).not.toBeChecked();
  });

  test('sinais: desligados no mineiro, ligados no paulista; ligar mostra a interceptação', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} />);
    const sinais = screen.getByRole('checkbox', { name: 'Sinais entre parceiros' });
    expect(sinais).not.toBeChecked();
    expect(screen.queryByLabelText('Adversários podem interceptar sinais')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar.mock.calls[0][0]).toMatchObject({ sinais: false, chaveRegras: expect.stringContaining('|sin:0') });
    await user.selectOptions(screen.getByLabelText('Variante'), 'paulista');
    expect(sinais).toBeChecked();
    await user.selectOptions(screen.getByLabelText('Variante'), 'mineiro');
    expect(sinais).not.toBeChecked();
    await user.click(sinais);
    aoJogar.mockClear();
    const campo = screen.getByLabelText('Adversários podem interceptar sinais');
    expect(campo).toHaveDisplayValue('Às vezes');
    await user.selectOptions(campo, 'Nunca');
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar.mock.calls[0][0]).toMatchObject({ chanceInterceptarSinal: 0, chaveRegras: expect.stringContaining('|int:0|') });
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
    expect(resumo).toHaveTextContent(
      'Mineiro, 1-3-6-9-12, mão de 11, mão de ferro, família fechada, mão limpa, 3 bots difíceis, sem sinais',
    );
    await user.selectOptions(screen.getByLabelText('Humanos'), '2');
    expect(resumo).toHaveTextContent('2 bots difíceis');
  });

  test('mesa privada: o dono escolhe "Sem limite" de tempo por jogada; o padrão continua 20 s', async () => {
    const user = userEvent.setup();
    const aoCriarPrivada = vi.fn();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} aoCriarPrivada={aoCriarPrivada} />);
    // Mesa pública: escolhe 15, 20 ou 30 s, mas nunca "Sem limite" (o relógio segura as mesas com desconhecidos).
    await user.click(screen.getByText('Regras da mesa'));
    expect(screen.getByLabelText('Tempo por jogada')).toHaveValue('20');
    expect(screen.queryByRole('option', { name: 'Sem limite' })).toBeNull();
    await user.click(screen.getByLabelText('Mesa privada'));
    expect(screen.getByLabelText('Tempo por jogada')).toHaveValue('20');
    await user.selectOptions(screen.getByLabelText('Tempo por jogada'), 'semLimite');
    expect(screen.getByText(/sem limite de tempo/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Criar mesa privada' }));
    expect(aoCriarPrivada.mock.calls[0][0]).toMatchObject({ modo: 'privada', semLimiteDeTempo: true });
  });

  test('sem limite não vaza para a mesa pública ao desmarcar "Mesa privada"', async () => {
    const user = userEvent.setup();
    const aoCriarPrivada = vi.fn();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} aoCriarPrivada={aoCriarPrivada} />);
    await user.click(screen.getByLabelText('Mesa privada'));
    await user.selectOptions(screen.getByLabelText('Tempo por jogada'), 'semLimite');
    await user.click(screen.getByLabelText('Mesa privada'));
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar.mock.calls[0][0]).not.toHaveProperty('semLimiteDeTempo');
  });

  test('mesa privada: chama aoCriarPrivada em vez de aoJogar', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    const aoCriarPrivada = vi.fn();
    render(<Lobby aoJogar={aoJogar} aoCriarPrivada={aoCriarPrivada} />);
    await user.click(screen.getByLabelText('Mesa privada'));
    await user.click(screen.getByRole('button', { name: 'Criar mesa privada' }));
    expect(aoJogar).not.toHaveBeenCalled();
    expect(aoCriarPrivada.mock.calls[0][0]).toMatchObject({ modo: 'privada' });
  });
});
