import type { MesaFisica, Rachadura } from '@truco/protocolo';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Tampo } from '../src/componentes/Tampo';

const rach = (id: number, extra: Partial<Rachadura> = {}): Rachadura => ({
  id,
  cadeira: 0,
  x: 0.5,
  y: 0.9,
  angulo: 270,
  tamanho: 0.3,
  semente: 100 + id,
  ...extra,
});
const madeira = (rachaduras: Rachadura[] = []): MesaFisica => ({ tipo: 'madeira', rachaduras, dano: 1 });

afterEach(() => vi.useRealTimers());

describe('Tampo', () => {
  test('visitantes começam na madeira clássica, sem rachaduras', () => {
    render(
      <Tampo fisica={madeira()} minha={0}>
        <span>cartas</span>
      </Tampo>,
    );
    const tampo = screen.getByTestId('tampo');
    expect(tampo).toHaveClass('tampo');
    expect(tampo).not.toHaveClass('tampo-feltro');
    expect(tampo).toHaveAttribute('data-superficie', 'madeira');
    expect(tampo).not.toHaveClass('tampo-plastico');
    expect(tampo).toHaveTextContent('cartas');
    expect(tampo.querySelectorAll('.rachadura')).toHaveLength(0);
  });

  test('sem mesaFisica (servidor antigo) é a madeira de sempre', () => {
    render(<Tampo minha={0}>x</Tampo>);
    expect(screen.getByTestId('tampo')).toHaveClass('tampo');
    expect(screen.getByTestId('tampo')).toHaveAttribute('data-superficie', 'madeira');
  });

  test('feltro é opcional; plástico pode ser escolhido e a quebra física prevalece', () => {
    const { rerender } = render(<Tampo minha={0} fisica={madeira()} aparencia="feltro">x</Tampo>);
    expect(screen.getByTestId('tampo')).toHaveClass('tampo-feltro');
    expect(screen.getByTestId('tampo')).toHaveAttribute('data-superficie', 'feltro');

    rerender(<Tampo minha={0} fisica={madeira()} aparencia="plastico">x</Tampo>);
    expect(screen.getByTestId('tampo')).toHaveClass('tampo-plastico');
    expect(screen.getByTestId('tampo')).toHaveAttribute('data-superficie', 'plastico');

    rerender(<Tampo minha={0} fisica={{ tipo: 'plastico', rachaduras: [], dano: 0 }} aparencia="madeira">x</Tampo>);
    expect(screen.getByTestId('tampo')).toHaveAttribute('data-superficie', 'plastico');
  });

  test('desenha cada rachadura sob as cartas, na posição relativa de quem olha', () => {
    const { container } = render(
      <Tampo fisica={madeira([rach(1), rach(2, { cadeira: 2, x: 0.5, y: 0.1, angulo: 90 })])} minha={1}>
        x
      </Tampo>,
    );
    const svg = container.querySelector('svg.rachaduras')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    const gs = svg.querySelectorAll('.rachadura');
    expect(gs).toHaveLength(2);
    // a da cadeira 0 aparece à esquerda para a cadeira 1, apontando para dentro
    expect(gs[0].getAttribute('transform')).toBe('translate(10 50) rotate(0)');
    // cada uma tem linha principal e ramificações
    expect(gs[0].querySelectorAll('path.fenda').length).toBeGreaterThanOrEqual(3);
    // determinística: mesma semente, mesmo desenho
    const d = gs[0].querySelector('path.fenda')!.getAttribute('d');
    const outro = render(<Tampo fisica={madeira([rach(1)])} minha={1}>y</Tampo>);
    expect(outro.container.querySelector('.rachadura path.fenda')!.getAttribute('d')).toBe(d);
  });

  test('mesa de plástico: classe própria e marcas em vez de rachaduras', () => {
    const { container } = render(
      <Tampo fisica={{ tipo: 'plastico', rachaduras: [rach(1)], dano: 0 }} minha={0}>
        x
      </Tampo>,
    );
    expect(screen.getByTestId('tampo')).toHaveClass('tampo-plastico');
    expect(screen.getByTestId('tampo')).not.toHaveClass('tampo-feltro');
    expect(screen.getByTestId('tampo')).toHaveAttribute('data-superficie', 'plastico');
    expect(container.querySelectorAll('.marca')).toHaveLength(1);
    expect(container.querySelectorAll('.rachadura:not(.marca)')).toHaveLength(0);
  });

  test('a estampa da cerveja Zapada só aparece na mesa de plástico', () => {
    const madeiraR = render(<Tampo fisica={madeira()} minha={0}>x</Tampo>);
    expect(madeiraR.queryByTestId('estampa')).toBeNull();
    madeiraR.unmount();
    render(
      <Tampo fisica={{ tipo: 'plastico', rachaduras: [], dano: 0 }} minha={0}>
        x
      </Tampo>,
    );
    const estampa = screen.getByTestId('estampa');
    expect(estampa).toHaveAttribute('aria-hidden', 'true');
    expect(estampa).toHaveTextContent('ZAPADA');
  });

  test('batida nova: o tampo treme e aparece o TUM!, que some depois', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <Tampo fisica={madeira()} minha={0} batida={null}>
        x
      </Tampo>,
    );
    rerender(
      <Tampo fisica={madeira()} minha={0} batida={{ id: 7, em: Date.now(), de: 1, forca: 0.8 }}>
        x
      </Tampo>,
    );
    expect(screen.getByTestId('tampo')).toHaveClass('tremendo');
    expect(screen.getByText('TUM!')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1500));
    expect(screen.getByTestId('tampo')).not.toHaveClass('tremendo');
    expect(screen.queryByText('TUM!')).toBeNull();
  });

  test('quebra: mostra os pedaços de madeira caindo sobre a mesa de plástico', () => {
    vi.useFakeTimers();
    const plastico: MesaFisica = { tipo: 'plastico', rachaduras: [], dano: 0 };
    const { container } = render(
      <Tampo fisica={plastico} minha={0} batida={{ id: 3, em: Date.now(), de: 0, forca: 1, rachadura: rach(5), quebrou: true }}>
        x
      </Tampo>,
    );
    expect(container.querySelectorAll('.quebra .pedaco')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent(/quebrou/i);
    act(() => void vi.advanceTimersByTime(1500));
    expect(container.querySelector('.quebra')).toBeNull();
  });
});
