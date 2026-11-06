import { render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

const deslizarDe = vi.fn();
vi.mock('../src/componentes/animacaoMesa', () => ({ deslizarDe: (...a: unknown[]) => deslizarDe(...a) }));
const { Monte } = await import('../src/componentes/Monte');

afterEach(() => deslizarDe.mockClear());

describe('Monte', () => {
  test('desliza quando muda de mão', () => {
    const { rerender } = render(<Monte qtd={40} dono={3} minha={0} />);
    rerender(<Monte qtd={40} dono={2} minha={0} />);
    expect(deslizarDe).toHaveBeenCalledTimes(1);
  });

  test('depois de sumir (0 cartas) reaparece no lugar, sem partir do ponto velho', () => {
    const { rerender } = render(<Monte qtd={40} dono={3} minha={0} />);
    rerender(<Monte qtd={0} dono={3} minha={0} />);
    rerender(<Monte qtd={40} dono={2} minha={0} />);
    expect(deslizarDe).not.toHaveBeenCalled();
  });

  test('mede de novo quando a contagem muda', () => {
    const ret = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    const { rerender } = render(<Monte qtd={40} dono={3} minha={0} />);
    const antes = ret.mock.calls.length;
    rerender(<Monte qtd={37} dono={3} minha={0} />);
    expect(ret.mock.calls.length).toBeGreaterThan(antes);
    ret.mockRestore();
  });
});
