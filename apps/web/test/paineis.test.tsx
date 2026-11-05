import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Cronometro } from '../src/componentes/Cronometro';
import { PainelFalas } from '../src/componentes/PainelFalas';
import { PainelSinais } from '../src/componentes/PainelSinais';
import { Toast } from '../src/componentes/Toast';

describe('PainelSinais', () => {
  test('o aviso só fala em interceptação quando a mesa permite', () => {
    const { rerender } = render(<PainelSinais chanceInterceptar={0} aoEnviar={vi.fn()} ultimo={null} />);
    const painel = screen.getByRole('region', { name: 'Sinais' });
    expect(painel).toHaveTextContent('Só seu parceiro vê.');
    expect(painel).not.toHaveTextContent(/intercept/i);
    rerender(<PainelSinais chanceInterceptar={0.25} aoEnviar={vi.fn()} ultimo={null} />);
    expect(painel).toHaveTextContent('Só seu parceiro vê — mas os adversários podem interceptar.');
  });

  test('sem mão limpa: 8 sinais, sem o de coringa', () => {
    render(<PainelSinais chanceInterceptar={0} aoEnviar={vi.fn()} ultimo={null} />);
    const painel = screen.getByRole('region', { name: 'Sinais' });
    expect(within(painel).getAllByRole('button')).toHaveLength(8);
    expect(within(painel).queryByRole('button', { name: /Coringa/ })).toBeNull();
  });

  test('com mão limpa: 9 sinais; o de coringa envia "coringa"', async () => {
    const user = userEvent.setup();
    const aoEnviar = vi.fn();
    render(<PainelSinais chanceInterceptar={0} aoEnviar={aoEnviar} ultimo={null} maoLimpa />);
    const painel = screen.getByRole('region', { name: 'Sinais' });
    expect(within(painel).getAllByRole('button')).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: 'Piscar os dois olhos — Coringa' }));
    expect(aoEnviar).toHaveBeenCalledWith('coringa');
  });

  test('8 sinais; clicar envia', async () => {
    const user = userEvent.setup();
    const aoEnviar = vi.fn();
    render(<PainelSinais chanceInterceptar={0} aoEnviar={aoEnviar} ultimo={null} />);
    const painel = screen.getByRole('region', { name: 'Sinais' });
    expect(within(painel).getAllByRole('button')).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: 'Piscar — Zap' }));
    expect(aoEnviar).toHaveBeenCalledWith('zap');
  });

  test('mostra o sinal recebido do parceiro e o interceptado', () => {
    const em = Date.now();
    const { rerender } = render(<PainelSinais chanceInterceptar={0} aoEnviar={vi.fn()} ultimo={{ sinal: 'tres', interceptado: false, nome: 'Bot Tião', em }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Bot Tião (parceiro): 😛 Língua — tenho 3');
    rerender(<PainelSinais chanceInterceptar={0} aoEnviar={vi.fn()} ultimo={{ sinal: 'zap', interceptado: true, nome: 'Bot Zé', em }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Interceptado de Bot Zé: 😉 Piscar — Zap');
    rerender(<PainelSinais chanceInterceptar={0} aoEnviar={vi.fn()} ultimo={{ sinal: 'coringa', interceptado: false, nome: 'Bot Tião', em }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Bot Tião (parceiro): 😆 Piscar os dois olhos — Coringa');
  });

  test('o último sinal recebido some depois de ~8 s', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(100_000);
      const ultimo = { sinal: 'zap' as const, interceptado: false, nome: 'Bot Tião', em: 100_000 };
      render(<PainelSinais chanceInterceptar={0} aoEnviar={vi.fn()} ultimo={ultimo} />);
      act(() => {
        vi.advanceTimersByTime(7_000);
      });
      expect(screen.getByRole('status')).toHaveTextContent('Bot Tião');
      act(() => {
        vi.advanceTimersByTime(1_500);
      });
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test('sinal antigo não aparece ao abrir o painel', () => {
    render(<PainelSinais chanceInterceptar={0} aoEnviar={vi.fn()} ultimo={{ sinal: 'zap', interceptado: false, nome: 'Bot Tião', em: Date.now() - 60_000 }} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('PainelFalas', () => {
  test('clicar envia a fala', async () => {
    const user = userEvent.setup();
    const aoEnviar = vi.fn();
    render(<PainelFalas aoEnviar={aoEnviar} />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: 'Bora!' }));
    expect(aoEnviar).toHaveBeenCalledWith('bora');
  });
});

describe('Cronometro', () => {
  test('segundos e urgência', () => {
    const { rerender } = render(<Cronometro prazo={{ cadeiras: [0], ate: 20_000 }} agora={5_000} />);
    expect(screen.getByRole('timer')).toHaveAccessibleName('Sua vez: 15 segundos');
    rerender(<Cronometro prazo={{ cadeiras: [0], ate: 20_000 }} agora={16_000} />);
    expect(screen.getByRole('timer')).toHaveClass('urgente');
  });
});

describe('Cronometro: barra', () => {
  const escala = (el: HTMLElement) => el.querySelector<HTMLElement>('.cronometro-barra')!.style.transform;

  test('o total é o tempo que restava quando o prazo chegou, não 20 s fixos', () => {
    const { container, rerender } = render(<Cronometro prazo={{ cadeiras: [0], ate: 30_000 }} agora={0} />);
    expect(escala(container)).toBe('scaleX(1)');
    rerender(<Cronometro prazo={{ cadeiras: [0], ate: 30_000 }} agora={15_000} />);
    expect(escala(container)).toBe('scaleX(0.5)');
    // prazo novo (outra decisão): recalcula o total
    rerender(<Cronometro prazo={{ cadeiras: [0], ate: 40_000 }} agora={30_000} />);
    expect(escala(container)).toBe('scaleX(1)');
    rerender(<Cronometro prazo={{ cadeiras: [0], ate: 40_000 }} agora={35_000} />);
    expect(escala(container)).toBe('scaleX(0.5)');
  });
});

describe('Toast', () => {
  test('botão Fechar acessível pelo teclado', async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    render(<Toast erro={{ id: 3, mensagem: 'opa' }} aoFechar={aoFechar} />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(aoFechar).toHaveBeenCalledWith(3);
  });

  test('some sozinho depois de 3,5 s', () => {
    vi.useFakeTimers();
    try {
      const aoFechar = vi.fn();
      render(<Toast erro={{ id: 7, mensagem: 'não é sua vez' }} aoFechar={aoFechar} />);
      expect(screen.getByRole('alert')).toHaveTextContent('não é sua vez');
      act(() => {
        vi.advanceTimersByTime(3_500);
      });
      expect(aoFechar).toHaveBeenCalledWith(7);
    } finally {
      vi.useRealTimers();
    }
  });
});
