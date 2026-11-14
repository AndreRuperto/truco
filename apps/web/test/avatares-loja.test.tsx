import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Avatar, DESENHOS_LOJA } from '../src/componentes/Avatar';

// Mesma lista do catálogo do servidor (apps/server/test/loja-regras.test.ts confere o outro lado).
const AVATARES_DA_LOJA = ['avatar-violeiro', 'avatar-garrafa', 'avatar-caramelo', 'avatar-mao', 'avatar-dono', 'avatar-vo'];

describe('avatares da loja', () => {
  test('todo avatar do catálogo tem desenho', () => {
    expect(Object.keys(DESENHOS_LOJA).sort()).toEqual([...AVATARES_DA_LOJA].sort());
  });

  test.each(AVATARES_DA_LOJA)('%s aparece como desenho, não como inicial', (id) => {
    const { container } = render(<Avatar apelido="ana" avatar={`loja:${id}`} tamanho={40} />);
    const avatar = container.querySelector('.avatar')!;
    expect(avatar).toHaveClass('avatar-pronto');
    expect(avatar.querySelector('svg')).not.toBeNull();
    expect(avatar.textContent).not.toBe('A');
  });

  test('violeiro tem pescoço ligando a cabeça à camisa', () => {
    const { container } = render(<Avatar apelido="ana" avatar="loja:avatar-violeiro" />);
    const pescoco = container.querySelector('[data-parte="pescoco"]');
    expect(pescoco).not.toBeNull();
    const cabeca = container.querySelector('[data-parte="cabeca"]')!;
    const camisa = container.querySelector('[data-parte="camisa"]')!;
    const topo = Number(pescoco!.getAttribute('y'));
    const base = topo + Number(pescoco!.getAttribute('height'));
    // O pescoço começa dentro da cabeça e termina dentro da camisa (sem fundo entre eles).
    const baseCabeca = Number(cabeca.getAttribute('cy')) + Number(cabeca.getAttribute('r'));
    const topoCamisa = Number(camisa.getAttribute('data-topo'));
    expect(topo).toBeLessThan(baseCabeca);
    expect(base).toBeGreaterThan(topoCamisa);
  });
});
