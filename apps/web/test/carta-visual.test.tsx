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
    for (const canto of carta.querySelectorAll('.canto')) expect(canto.textContent).toBe('★');
    expect(carta.querySelector('.naipe-central')).toHaveTextContent('★');
    expect(carta.querySelector('.selo')).toBeNull();
    expect(carta).not.toHaveTextContent('♥');
  });

  test('coringa preto', () => {
    render(<CartaVisual carta={c('Cp')} variante="mineiro" vira={null} tamanho="pequena" />);
    expect(screen.getByRole('img', { name: 'Coringa' })).toHaveClass('coringa', 'preta', 'pequena');
  });

  test.each([
    ['Kc', 'rei', 'Rei de copas'],
    ['Qe', 'dama', 'Dama de espadas'],
    ['Jo', 'valete', 'Valete de ouros'],
  ])('%s: figura desenhada (%s), decorativa, com o mesmo rótulo', (id, figura, rotulo) => {
    render(<CartaVisual carta={c(id)} variante="paulista" vira={null} />);
    const carta = screen.getByRole('img', { name: rotulo });
    expect(carta).toHaveClass('figurada');
    const svg = carta.querySelector(`svg[data-figura="${figura}"]`);
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // O naipe simples continua no DOM para a carta estreita (o CSS troca).
    expect(carta.querySelector('.naipe-central')).toHaveTextContent(/[♥♠♦]/);
  });

  test('figura que é manilha mantém o selo', () => {
    render(<CartaVisual carta={c('Kp')} variante="paulista" vira={c('Jo')} />);
    const carta = screen.getByRole('img', { name: 'Rei de paus — Zap' });
    expect(carta.querySelector('svg[data-figura="rei"]')).not.toBeNull();
    expect(carta.querySelector('.selo')).toHaveTextContent('Zap');
  });

  test('Ás: ornamento simples; A♠ com o ornamento da espadilha', () => {
    render(<CartaVisual carta={c('Ac')} variante="mineiro" vira={null} />);
    const copas = screen.getByRole('img', { name: 'Ás de copas' });
    expect(copas.querySelector('svg[data-figura="as"]')).toHaveAttribute('data-ornamento', 'simples');
    render(<CartaVisual carta={c('Ae')} variante="mineiro" vira={null} />);
    const espadilha = screen.getByRole('img', { name: 'Ás de espadas — Espadilha' });
    expect(espadilha.querySelector('svg[data-figura="as"]')).toHaveAttribute('data-ornamento', 'espadilha');
    expect(espadilha.querySelector('.selo')).toHaveTextContent('Espadilha');
  });

  test('carta comum e coringa não ganham figura', () => {
    render(<CartaVisual carta={c('7c')} variante="mineiro" vira={null} />);
    render(<CartaVisual carta={c('Cp')} variante="mineiro" vira={null} />);
    for (const nome of ['7 de copas — Copas', 'Coringa']) {
      const carta = screen.getByRole('img', { name: nome });
      expect(carta).not.toHaveClass('figurada');
      expect(carta.querySelector('svg')).toBeNull();
      expect(carta.querySelector('.figura')).toBeNull();
    }
  });
});
