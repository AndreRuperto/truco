import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { CartaVisual } from '../src/componentes/CartaVisual';
import { c } from './fixtures';

describe('CartaVisual', () => {
  test('carta comum: valor e naipe nos cantos', () => {
    render(<CartaVisual carta={c('Ae')} variante="mineiro" vira={null} />);
    const carta = screen.getByRole('img', { name: 'Ás de espadas — Espadilha' });
    expect(carta).toHaveClass('preta');
    // Nada na carta diz que ela é manilha: quem joga tem que saber (o nome fica só no rótulo acessível).
    expect(carta).not.toHaveClass('manilha');
    expect(carta.querySelector('.selo')).toBeNull();
    expect(carta).not.toHaveTextContent('Espadilha');
    expect(carta).toHaveTextContent('A♠');
  });

  test('coringa vermelho: rótulo "Coringa", visual próprio, sem selo de manilha', () => {
    render(<CartaVisual carta={c('Cc')} variante="mineiro" vira={null} />);
    const carta = screen.getByRole('img', { name: 'Coringa' });
    expect(carta).toHaveClass('coringa', 'vermelha');
    expect(carta).not.toHaveClass('manilha');
    expect(carta.querySelectorAll('.canto')).toHaveLength(2);
    // Cada canto traz a palavra (carta larga) e "C" + chapéu (média/estreita); o CSS escolhe.
    for (const canto of carta.querySelectorAll('.canto')) {
      expect(canto).toHaveAttribute('aria-hidden', 'true');
      expect(canto.querySelector('.coringa-palavra')?.textContent).toBe('CORINGA');
      expect(canto.querySelector('.coringa-curto')?.textContent).toBe('C');
      expect(canto.querySelector('.coringa-curto svg[data-simbolo="coringa"]')).not.toBeNull();
      expect(canto.querySelector('.coringa-c')?.textContent).toBe('C');
    }
    // O chapéu sozinho continua no DOM para a carta estreita; a estrela saiu.
    expect(carta.querySelector('.naipe-central svg[data-simbolo="coringa"]')).not.toBeNull();
    expect(carta).not.toHaveTextContent('★');
    expect(carta.querySelector('.selo')).toBeNull();
    expect(carta).not.toHaveTextContent(/[♥♠♦♣]/);
  });

  test.each([
    ['Cc', 'vermelha'],
    ['Cp', 'preta'],
  ])('coringa %s: bobo da corte desenhado, decorativo', (id, cor) => {
    render(<CartaVisual carta={c(id)} variante="mineiro" vira={null} />);
    const carta = screen.getByRole('img', { name: 'Coringa' });
    expect(carta).toHaveClass('coringa', cor, 'figurada');
    const svgs = carta.querySelectorAll('svg[data-figura]');
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute('data-figura', 'coringa');
    expect(svgs[0]).toHaveAttribute('aria-hidden', 'true');
    // Os quatro naipes ao pé da figura, cada um na cor do seu naipe.
    expect(svgs[0].querySelectorAll('.fig-naipe-vermelho')).toHaveLength(2);
    expect(svgs[0].querySelectorAll('.fig-naipe-preto')).toHaveLength(2);
    expect(carta.querySelector('.selo')).toBeNull();
  });

  test('coringa preto', () => {
    render(<CartaVisual carta={c('Cp')} variante="mineiro" vira={null} tamanho="pequena" />);
    expect(screen.getByRole('img', { name: 'Coringa' })).toHaveClass('coringa', 'preta', 'pequena');
  });

  test('coringa nunca é manilha nem ganha selo, mesmo com vira', () => {
    render(<CartaVisual carta={c('Cp')} variante="paulista" vira={c('Kc')} />);
    const carta = screen.getByRole('img', { name: 'Coringa' });
    expect(carta).not.toHaveClass('manilha');
    expect(carta.querySelector('.selo')).toBeNull();
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

  test('figura que é manilha não ganha selo com o nome', () => {
    render(<CartaVisual carta={c('Kp')} variante="paulista" vira={c('Jo')} />);
    const carta = screen.getByRole('img', { name: 'Rei de paus — Zap' });
    expect(carta.querySelector('svg[data-figura="rei"]')).not.toBeNull();
    expect(carta.querySelector('.selo')).toBeNull();
    expect(carta).not.toHaveTextContent('Zap');
  });

  test('Ás: ornamento simples; A♠ com o ornamento da espadilha', () => {
    render(<CartaVisual carta={c('Ac')} variante="mineiro" vira={null} />);
    const copas = screen.getByRole('img', { name: 'Ás de copas' });
    expect(copas.querySelector('svg[data-figura="as"]')).toHaveAttribute('data-ornamento', 'simples');
    render(<CartaVisual carta={c('Ae')} variante="mineiro" vira={null} />);
    const espadilha = screen.getByRole('img', { name: 'Ás de espadas — Espadilha' });
    expect(espadilha.querySelector('svg[data-figura="as"]')).toHaveAttribute('data-ornamento', 'espadilha');
    expect(espadilha).not.toHaveTextContent('Espadilha');
  });

  test('carta comum não ganha figura', () => {
    render(<CartaVisual carta={c('7c')} variante="mineiro" vira={null} />);
    const carta = screen.getByRole('img', { name: '7 de copas — Copas' });
    expect(carta).not.toHaveClass('figurada');
    expect(carta.querySelector('svg')).toBeNull();
    expect(carta.querySelector('.figura')).toBeNull();
  });

  test('só o coringa ganha o bobo; as figuras não', () => {
    render(<CartaVisual carta={c('Kc')} variante="paulista" vira={null} />);
    expect(screen.getByRole('img', { name: 'Rei de copas' }).querySelector('svg[data-figura="coringa"]')).toBeNull();
  });
});
