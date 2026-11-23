import { chaveRegras } from '@truco/protocolo';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { duracaoNoRitmo } from '../src/componentes/animacaoMesa';
import { formInicial, limparPreferencias, opcoesDeEntrada, preferenciasDe } from '../src/logica/lobby';
import type { EstadoLoja } from '../src/rede/loja';
import { Lobby } from '../src/telas/Lobby';
import { TelaMesa } from '../src/telas/Mesa';
import { distribuida, msgEstado, PAULISTA } from './fixtures';

vi.mock('../src/som/sintese', () => ({ destravarAudio: vi.fn(), sintetizar: vi.fn() }));
beforeEach(() => localStorage.clear());

// Pedido do André (2026-11-20): o ritmo é escolhido no menu inicial ("Calmo", o novo, ou "Rápido",
// o de antes), e o tempo por jogada também se escolhe ao criar a mesa.
describe('ritmo e tempo por jogada no lobby', () => {
  test('padrão calmo e 20 s; a chave da sala leva ritmo e tempo como o servidor calcula', () => {
    const f = formInicial('Ana');
    expect(opcoesDeEntrada(f)).toMatchObject({ ritmo: 'calmo', tempoJogadaS: 20 });
    const o = opcoesDeEntrada({ ...f, ritmo: 'rapido', tempoJogadaS: 30 });
    expect(o).toMatchObject({ ritmo: 'rapido', tempoJogadaS: 30 });
    expect(o.chaveRegras).toBe(chaveRegras({ variante: f.variante, ...o.regras }, o.chanceInterceptarSinal, o.tempoFamiliaS, o.sinais, o.provocacoes, 'rapido', 30));
  });

  // Pedido do André (2026-11-22): o ritmo vale para a mesa inteira, então mora nas regras da mesa,
  // no grupo "Jogadores e tempo", logo antes do tempo por jogada, com o "?" explicando.
  test('o ritmo fica nas regras da mesa, em "Jogadores e tempo", com o "?"', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} />);
    expect(screen.getByRole('radiogroup', { name: 'Ritmo da mesa', hidden: true })).not.toBeVisible();
    await user.click(screen.getByText('Regras da mesa'));
    const grupo = screen.getByRole('radiogroup', { name: 'Ritmo da mesa' });
    expect(grupo.closest('.regras-grade')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'O que é Ritmo da mesa?' }));
    expect(screen.getByText(/Calmo: os bots pensam com calma/)).toBeVisible();
    expect(screen.getByRole('radio', { name: /Calmo/ })).toBeChecked();
    expect(grupo).toBeVisible();
    await user.click(screen.getByRole('radio', { name: /Rápido/ }));
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar).toHaveBeenCalledWith(expect.objectContaining({ ritmo: 'rapido' }));
  });

  test('tempo por jogada: 15, 20 ou 30 s em toda mesa; "Sem limite" só na privada', async () => {
    const user = userEvent.setup();
    const aoJogar = vi.fn();
    render(<Lobby aoJogar={aoJogar} aoCriarPrivada={vi.fn()} />);
    await user.click(screen.getByText('Regras da mesa'));
    const tempo = screen.getByLabelText('Tempo por jogada');
    expect([...tempo.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['15 segundos', '20 segundos', '30 segundos']);
    await user.selectOptions(tempo, '30');
    await user.click(screen.getByRole('button', { name: 'Jogar agora' }));
    expect(aoJogar).toHaveBeenCalledWith(expect.objectContaining({ tempoJogadaS: 30 }));
    await user.click(screen.getByLabelText(/Mesa privada/));
    expect([...screen.getByLabelText('Tempo por jogada').querySelectorAll('option')].map((o) => o.textContent)).toContain('Sem limite');
  });

  test('as preferências lembram ritmo e tempo', () => {
    const p = preferenciasDe({ ...formInicial('Ana'), ritmo: 'rapido', tempoJogadaS: 15 });
    expect(p).toMatchObject({ ritmo: 'rapido', tempoJogadaS: 15 });
    expect(limparPreferencias({ ritmo: 'rapido', tempoJogadaS: 15 })).toEqual({ ritmo: 'rapido', tempoJogadaS: 15 });
    expect(limparPreferencias({ ritmo: 'turbo', tempoJogadaS: 7 })).toBeNull();
  });
});

describe('animações no ritmo da mesa', () => {
  const snap = (msg: NonNullable<EstadoLoja['msg']>): EstadoLoja => ({ status: 'na-mesa', msg, eventos: [], erro: null, chat: [], salaId: 'r1' });
  const acoes = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() });

  test('rápido encurta as animações para o ritmo de antes; calmo volta ao normal', () => {
    const { unmount } = render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA), 0, { ritmo: 'rapido' }))} acoes={acoes()} />);
    expect(duracaoNoRitmo(500)).toBe(400);
    unmount();
    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA), 0, { ritmo: 'calmo' }))} acoes={acoes()} />);
    expect(duracaoNoRitmo(500)).toBe(500);
  });
});

describe('sala de espera conta o ritmo e o tempo', () => {
  test('resumo das regras', async () => {
    const { resumoRegras } = await import('../src/logica/textos');
    expect(resumoRegras(PAULISTA, 0, true, false, 'rapido', 15)).toEqual(expect.arrayContaining(['Ritmo rápido', '15 segundos por jogada']));
    expect(resumoRegras(PAULISTA, 0, true, true, 'calmo', 20)).toEqual(expect.arrayContaining(['Ritmo calmo', 'Sem limite de tempo por jogada']));
  });
});
