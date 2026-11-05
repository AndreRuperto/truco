import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { CartaVisual } from '../src/componentes/CartaVisual';
import { c } from './fixtures';

describe('CartaVisual', () => {
  test('carta comum: valor e naipe nos cantos', () => {
    render(<CartaVisual carta={c('Ae')} variante="mineiro" vira={null} />);
    const carta = screen.getByRole('img', { name: 'Ás de espadas — Espadilha' });
    expect(carta).toHaveClass('preta', 'manilha');
    expect(carta).toHaveTextContent('A♠');
  });

  test('coringa vermelho: rótulo "Coringa", visual próprio, sem selo de manilha', () => {
    render(<CartaVisual carta={c('Cc')} variante="mineiro" vira={null} />);
    const carta = screen.getByRole('img', { name: 'Coringa' });
    expect(carta).toHaveClass('coringa', 'vermelha');
    expect(carta).not.toHaveClass('manilha');
    expect(carta.querySelectorAll('.canto')).toHaveLength(2);
    for (const canto of carta.querySelectorAll('.canto')) expect(canto).toHaveTextContent('C★');
    expect(carta.querySelector('.naipe-central')).toHaveTextContent('★');
    expect(carta.querySelector('.selo')).toBeNull();
    expect(carta).not.toHaveTextContent('♥');
  });

  test('coringa preto', () => {
    render(<CartaVisual carta={c('Cp')} variante="mineiro" vira={null} tamanho="pequena" />);
    expect(screen.getByRole('img', { name: 'Coringa' })).toHaveClass('coringa', 'preta', 'pequena');
  });
});
