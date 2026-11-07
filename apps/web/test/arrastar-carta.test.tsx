import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DISTANCIA_JOGAR, Mao } from '../src/componentes/Mao';

// jsdom não tem PointerEvent: sem ele o fireEvent manda um Event sem clientX/pointerId.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventFalso extends MouseEvent {
    pointerId: number;
    constructor(tipo: string, init: PointerEventInit = {}) {
      super(tipo, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventFalso }).PointerEvent = PointerEventFalso;
}

const cartas = [
  { valor: '4', naipe: 'paus' },
  { valor: '7', naipe: 'copas' },
  { valor: 'A', naipe: 'espadas' },
] as const;

function montar(jogaveis = [0, 1, 2]) {
  const aoJogar = vi.fn();
  render(<Mao cartas={[...cartas]} jogaveis={jogaveis} cobriveis={[]} variante="mineiro" vira={null} aoJogar={aoJogar} />);
  return aoJogar;
}

/** Pega a carta, arrasta até (dx, dy) e solta; o navegador ainda dispara o clique depois. */
function arrastar(el: HTMLElement, dx: number, dy: number) {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 100, clientY: 500 });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 100 + dx / 2, clientY: 500 + dy / 2 });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 100 + dx, clientY: 500 + dy });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 100 + dx, clientY: 500 + dy });
  fireEvent.click(el);
}

describe('segurar e arrastar a carta', () => {
  test('soltar acima da mão joga a carta (uma vez só, o clique depois não repete)', () => {
    const aoJogar = montar();
    arrastar(screen.getByRole('button', { name: /^7 de copas/ }), 10, -(DISTANCIA_JOGAR + 30));
    expect(aoJogar).toHaveBeenCalledTimes(1);
    expect(aoJogar).toHaveBeenCalledWith(1, false);
  });

  test('soltar perto da mão devolve a carta sem jogar', () => {
    const aoJogar = montar();
    arrastar(screen.getByRole('button', { name: /^4 de paus/ }), 40, -20);
    expect(aoJogar).not.toHaveBeenCalled();
  });

  test('toque continua jogando; carta que não pode ser jogada não arrasta', () => {
    const aoJogar = montar([2]);
    fireEvent.click(screen.getByRole('button', { name: /^A de espadas|^Ás de espadas/ }));
    expect(aoJogar).toHaveBeenCalledWith(2, false);
    arrastar(screen.getByRole('button', { name: /^4 de paus/ }), 0, -200);
    expect(aoJogar).toHaveBeenCalledTimes(1);
  });

  test('enquanto arrasta, a carta acompanha e avisa quando soltar já joga', () => {
    montar();
    const el = screen.getByRole('button', { name: /^7 de copas/ });
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 100, clientY: 500 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 120, clientY: 450 });
    expect(el).toHaveClass('arrastando');
    expect(el).not.toHaveClass('vai-jogar');
    expect(el.style.translate).toBe('20px -50px');
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 120, clientY: 500 - DISTANCIA_JOGAR - 5 });
    expect(el).toHaveClass('vai-jogar');
  });
});
