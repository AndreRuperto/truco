import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DUR_RIFFLE, useAnimacaoRitual } from '../src/componentes/animacaoMesa';
import type { Movimento } from '../src/rede/loja';

function Palco({ movimentos }: { movimentos: Movimento[] }) {
  const camada = useRef<HTMLDivElement>(null);
  useAnimacaoRitual(movimentos, 0, camada);
  return (
    <div>
      <div data-testid="monte" />
      <div ref={camada} />
    </div>
  );
}
const mov = (id: number, msg: Movimento['msg']): Movimento => ({ id, msg });
const riffle = (id: number) => mov(id, { cadeira: 3, tipo: 'embaralhar' });
const anim = () => screen.getByTestId('monte').dataset.anim;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAnimacaoRitual', () => {
  test('o que já estava na loja ao abrir a tela não anima; o novo marca o monte e solta depois', () => {
    const { rerender } = render(<Palco movimentos={[riffle(1)]} />);
    expect(anim()).toBeUndefined();
    rerender(<Palco movimentos={[riffle(1), riffle(2)]} />);
    expect(anim()).toBe('embaralhar');
    act(() => {
      vi.advanceTimersByTime(DUR_RIFFLE);
    });
    expect(anim()).toBeUndefined();
  });

  test('distribuir e cortar marcam o monte', () => {
    const { rerender } = render(<Palco movimentos={[]} />);
    rerender(<Palco movimentos={[mov(1, { cadeira: 2, tipo: 'cortar', fracao: 0.4 })]} />);
    expect(anim()).toBe('cortar');
    rerender(
      <Palco
        movimentos={[mov(1, { cadeira: 2, tipo: 'cortar', fracao: 0.4 }), mov(2, { cadeira: 3, tipo: 'distribuir', modo: 'subindo', ordem: [0, 1, 2, 3] })]}
      />,
    );
    expect(anim()).toBe('distribuir');
  });

  test('a mesma lista (re-render sem ação nova) não anima de novo', () => {
    const lista = [riffle(1)];
    const { rerender } = render(<Palco movimentos={[]} />);
    rerender(<Palco movimentos={lista} />);
    act(() => {
      vi.advanceTimersByTime(DUR_RIFFLE);
    });
    rerender(<Palco movimentos={[...lista]} />);
    expect(anim()).toBeUndefined();
  });

  test('desmontar no meio limpa os timers sem erro', () => {
    const { rerender, unmount } = render(<Palco movimentos={[]} />);
    rerender(<Palco movimentos={[mov(1, { cadeira: 1, tipo: 'familia', aberta: false }), mov(2, { cadeira: 2, tipo: 'conferir', conferir: true })]} />);
    unmount();
    expect(() => vi.runAllTimers()).not.toThrow();
  });

  test('prefers-reduced-motion: nada se move', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const { rerender } = render(<Palco movimentos={[]} />);
    rerender(<Palco movimentos={[riffle(1)]} />);
    expect(anim()).toBeUndefined();
  });
});
