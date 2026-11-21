import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  CHAVE_PREFERENCIAS,
  formInicial,
  lerPreferenciasLocais,
  limparPreferencias,
  PREFERENCIAS_PADRAO,
  preferenciasDe,
} from '../src/logica/lobby';
import { Lobby } from '../src/telas/Lobby';

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('preferências da tela inicial (lógica)', () => {
  test('padrão da casa: mineiro, 1-3-6-9-12, mão de 11 e de ferro, família fechada, mão limpa, bots difíceis, sinais às vezes', () => {
    expect(PREFERENCIAS_PADRAO).toEqual({
      variante: 'mineiro',
      pontuacao: '1-3-6-9-12',
      maoDe10: true,
      maoDe11: 'onzeAOnze',
      familia: 'fechada',
      maoLimpa: true,
      humanos: 1,
      nivelBot: 'dificil',
      chanceInterceptarSinal: 0.25,
      tempoFamiliaS: 20,
      sinais: false,
    });
    expect(formInicial('Ana')).toEqual({ ...PREFERENCIAS_PADRAO, nome: 'Ana', privada: false, provocacoes: true, ritmo: 'calmo', tempoJogadaS: 20 });
  });

  test('o que está salvo vai por cima do padrão; preferenciasDe tira apelido e privada', () => {
    const f = formInicial('Ana', { variante: 'paulista', maoLimpa: false });
    expect(f).toMatchObject({ variante: 'paulista', maoLimpa: false, nivelBot: 'dificil' });
    expect(preferenciasDe({ ...f, privada: true })).not.toHaveProperty('nome');
    expect(preferenciasDe({ ...f, privada: true })).not.toHaveProperty('privada');
  });

  test('limparPreferencias descarta campos estranhos e valores fora das opções', () => {
    expect(limparPreferencias(null)).toBeNull();
    expect(limparPreferencias({ lixo: 1 })).toBeNull();
    expect(limparPreferencias({ variante: 'paulista', humanos: 7, chanceInterceptarSinal: 0.3, nivelBot: 'facil' })).toEqual({
      variante: 'paulista',
      nivelBot: 'facil',
    });
  });

  test('preferência antiga com mão de ferro "qualquer dupla" (opção removida) vira o 11 a 11', () => {
    expect(limparPreferencias({ maoDe11: 'qualquerDupla' })).toEqual({ maoDe11: 'onzeAOnze' });
    expect(limparPreferencias({ maoDe11: 'off' })).toEqual({ maoDe11: 'off' });
  });

  test('localStorage quebrado não derruba a leitura', () => {
    localStorage.setItem(CHAVE_PREFERENCIAS, '{não é json');
    expect(lerPreferenciasLocais()).toBeNull();
  });
});

describe('Lobby lembra as regras', () => {
  test('abre no padrão da casa', () => {
    render(<Lobby aoJogar={() => {}} />);
    expect(screen.getByLabelText('Variante')).toHaveValue('mineiro');
    expect(screen.getByLabelText('Pontuação')).toHaveValue('1-3-6-9-12');
    expect(screen.getByLabelText('Bots')).toHaveValue('dificil');
    expect(screen.getByRole('checkbox', { name: /Mão limpa/ })).toBeChecked();
    expect(screen.getByText(/salvas neste aparelho/)).toBeInTheDocument();
  });

  test('mudar uma regra grava no aparelho e, com conta, manda para a conta depois de uma pausa', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const aoSalvarNaConta = vi.fn();
    render(<Lobby aoJogar={() => {}} preferenciasConta={null} aoSalvarNaConta={aoSalvarNaConta} />);
    expect(screen.getByText(/salvas na sua conta/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Bots'), 'facil');
    expect(lerPreferenciasLocais()).toMatchObject({ nivelBot: 'facil' });
    expect(aoSalvarNaConta).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(aoSalvarNaConta).toHaveBeenCalledTimes(1);
    expect(aoSalvarNaConta.mock.calls[0][0]).toMatchObject({ nivelBot: 'facil', variante: 'mineiro' });
  });

  test('abrir a tela não grava nada; as da conta chegam depois e aparecem no formulário', () => {
    const aoSalvarNaConta = vi.fn();
    const { rerender } = render(<Lobby aoJogar={() => {}} aoSalvarNaConta={aoSalvarNaConta} />);
    expect(localStorage.getItem(CHAVE_PREFERENCIAS)).toBeNull();
    rerender(
      <Lobby aoJogar={() => {}} aoSalvarNaConta={aoSalvarNaConta} preferenciasConta={{ ...PREFERENCIAS_PADRAO, variante: 'paulista', maoLimpa: false, nivelBot: 'facil' }} />,
    );
    expect(screen.getByLabelText('Variante')).toHaveValue('paulista');
    expect(screen.getByLabelText('Bots')).toHaveValue('facil');
    expect(aoSalvarNaConta).not.toHaveBeenCalled();
  });

  test('o que ficou no aparelho vale na próxima visita', () => {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify({ ...PREFERENCIAS_PADRAO, pontuacao: '2-4-8-10-12' }));
    render(<Lobby aoJogar={() => {}} />);
    expect(screen.getByLabelText('Pontuação')).toHaveValue('2-4-8-10-12');
  });
});
