import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { distribuida, msgEstado, PAULISTA } from './fixtures';

const acoesFalsas = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn(), provocar: vi.fn() });
const snap = (msg: EstadoLoja['msg'], provocacoes: EstadoLoja['provocacoes'] = []): EstadoLoja => ({ status: 'na-mesa', msg, eventos: [], erro: null, chat: [], salaId: 'r1', provocacoes });
const comRegra = (ligada: boolean) => ({ ...msgEstado(distribuida(PAULISTA), 0), provocacoes: ligada });

afterEach(() => vi.useRealTimers());

describe('provocações na mesa', () => {
  test('tocar no nome de outro jogador abre "Provocar"; clicar manda o alvo e fecha', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    render(<TelaMesa snap={snap(comRegra(true))} acoes={acoes} />);
    const direita = screen.getByTestId('assento-direita');
    const nome = within(direita).getByRole('button', { name: /provocar/ });
    expect(nome).toHaveAttribute('aria-expanded', 'false');
    await user.click(nome);
    expect(nome).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(direita).getByRole('button', { name: 'Provocar' }));
    expect(acoes.provocar).toHaveBeenCalledWith(1);
    expect(within(direita).queryByRole('button', { name: 'Provocar' })).toBeNull();
    // Recarregando: abre de novo e o botão está desligado.
    await user.click(nome);
    expect(within(direita).getByRole('button', { name: 'Provocar (recarregando)' })).toBeDisabled();
  });

  test('Esc fecha o botão; o meu assento não vira botão', async () => {
    const user = userEvent.setup();
    render(<TelaMesa snap={snap(comRegra(true))} acoes={acoesFalsas()} />);
    const nome = within(screen.getByTestId('assento-cima')).getByRole('button', { name: /provocar/ });
    await user.click(nome);
    await user.keyboard('{Escape}');
    expect(nome).toHaveAttribute('aria-expanded', 'false');
    expect(within(screen.getByTestId('assento-baixo')).queryByRole('button', { name: /provocar/ })).toBeNull();
  });

  test('regra desligada (ou sem a ação): nome não é botão', () => {
    const { unmount } = render(<TelaMesa snap={snap(comRegra(false))} acoes={acoesFalsas()} />);
    expect(screen.queryByRole('button', { name: /: provocar/ })).toBeNull();
    unmount();
    const { provocar: _, ...semAcao } = acoesFalsas();
    render(<TelaMesa snap={snap(comRegra(true))} acoes={semAcao} />);
    expect(screen.queryByRole('button', { name: /: provocar/ })).toBeNull();
  });

  test('provocação recebida aparece no assento do alvo e some depois de 1,6 s', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const p = { id: 1, de: 0 as const, para: 1 as const, efeito: 'laco' as const, em: Date.now() };
    const { rerender } = render(<TelaMesa snap={snap(comRegra(true), [p])} acoes={acoesFalsas()} />);
    const efeito = within(screen.getByTestId('assento-direita')).getByTestId('provocacao');
    expect(efeito).toHaveAttribute('data-efeito', 'laco');
    expect(efeito).toHaveTextContent('laçado!');
    vi.advanceTimersByTime(2_000);
    rerender(<TelaMesa snap={snap(comRegra(true), [p])} acoes={acoesFalsas()} />);
    expect(screen.queryByTestId('provocacao')).toBeNull();
  });

  test('quando o alvo sou eu, a região da mesa anuncia quem provocou', () => {
    const p = { id: 2, de: 1 as const, para: 0 as const, efeito: 'po-de-giz' as const, em: Date.now() };
    render(<TelaMesa snap={snap(comRegra(true), [p])} acoes={acoesFalsas()} />);
    expect(screen.getByTestId('anuncio-mesa')).toHaveTextContent('Bot Zé soprou pó de giz em você!');
    expect(within(screen.getByTestId('assento-baixo')).getByTestId('provocacao')).toHaveAttribute('data-efeito', 'po-de-giz');
  });
});
