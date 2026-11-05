import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { acoesValidas, reduce, visaoDoJogador } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BarraAcoes } from '../src/componentes/BarraAcoes';
import { agruparAcoes } from '../src/logica/acoes';
import { botaoBate } from '../src/logica/batida';
import { distribuida, PAULISTA } from './fixtures';

let t = 0;
beforeEach(() => {
  t = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => t);
});
afterEach(() => vi.restoreAllMocks());

/** Cadeira 1 diante de um truco: pode pedir Seis. */
function barraComSeis() {
  const s = reduce(distribuida(PAULISTA), { tipo: 'truco', cadeira: 0 });
  const v = visaoDoJogador(s, 1);
  const ordem: string[] = [];
  const aoEscolher = vi.fn(() => ordem.push('acao'));
  const aoBater = vi.fn((_forca: number) => ordem.push('batida'));
  render(
    <BarraAcoes
      botoes={agruparAcoes(acoesValidas(s, 1), v).botoes}
      pedido={null}
      aoEscolher={aoEscolher}
      bate={(b) => botaoBate(b, v.mao)}
      aoBater={aoBater}
    />,
  );
  return { aoEscolher, aoBater, ordem, seis: screen.getByRole('button', { name: 'Seis!' }) };
}

describe('BarraAcoes: bater na mesa', () => {
  test('segurar o Seis! carrega e, ao soltar, envia o pedido e depois a batida com força > 0', () => {
    const { aoEscolher, aoBater, ordem, seis } = barraComSeis();
    fireEvent.pointerDown(seis, { button: 0, pointerId: 1 });
    expect(seis).toHaveClass('carregando');
    t += 900;
    fireEvent.pointerUp(seis, { button: 0, pointerId: 1 });
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoEscolher).toHaveBeenCalledWith({ tipo: 'aumentar', cadeira: 1 });
    expect(aoBater).toHaveBeenCalledTimes(1);
    expect(aoBater.mock.calls[0][0]).toBeCloseTo(0.75);
    expect(ordem).toEqual(['acao', 'batida']);
    expect(seis).not.toHaveClass('carregando');
  });

  test('toque rápido: só o pedido, sem batida', () => {
    const { aoEscolher, aoBater, seis } = barraComSeis();
    fireEvent.pointerDown(seis, { button: 0, pointerId: 1 });
    t += 100;
    fireEvent.pointerUp(seis, { button: 0, pointerId: 1 });
    fireEvent.click(seis, { detail: 1 });
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoBater).not.toHaveBeenCalled();
  });

  test('clique comum (userEvent) envia o pedido uma vez', async () => {
    const user = userEvent.setup();
    const { aoEscolher, aoBater, seis } = barraComSeis();
    await user.click(seis);
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoBater).not.toHaveBeenCalled();
  });

  test('toque longo cancelado pelo navegador ainda envia o pedido (e a batida)', () => {
    const { aoEscolher, aoBater, seis } = barraComSeis();
    fireEvent.pointerDown(seis, { button: 0, pointerId: 1 });
    t += 2000;
    fireEvent.pointerCancel(seis, { pointerId: 1 });
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoBater).toHaveBeenCalledWith(1);
  });

  test('teclado: Enter é pedido sem batida; segurar Espaço carrega', () => {
    const { aoEscolher, aoBater, seis } = barraComSeis();
    fireEvent.keyDown(seis, { key: 'Enter' });
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoBater).not.toHaveBeenCalled();
    fireEvent.keyDown(seis, { key: ' ' });
    t += 50;
    fireEvent.keyDown(seis, { key: ' ', repeat: true });
    t += 1300;
    fireEvent.keyUp(seis, { key: ' ' });
    expect(aoEscolher).toHaveBeenCalledTimes(2);
    expect(aoBater).toHaveBeenCalledWith(1);
  });

  test('Espaço rápido: pedido sem batida; clique sintético logo depois não duplica', () => {
    const { aoEscolher, aoBater, seis } = barraComSeis();
    fireEvent.keyDown(seis, { key: ' ' });
    t += 60;
    fireEvent.keyUp(seis, { key: ' ' });
    fireEvent.click(seis, { detail: 0 });
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoBater).not.toHaveBeenCalled();
  });

  test('clique sem ponteiro (leitor de tela) envia o pedido', () => {
    const { aoEscolher, seis } = barraComSeis();
    fireEvent.click(seis, { detail: 0 });
    expect(aoEscolher).toHaveBeenCalledTimes(1);
  });

  test('Truco (nível 1) é botão comum: segurar não bate', () => {
    const s = distribuida(PAULISTA);
    const v = visaoDoJogador(s, 0);
    const aoEscolher = vi.fn();
    const aoBater = vi.fn();
    render(
      <BarraAcoes botoes={agruparAcoes(acoesValidas(s, 0), v).botoes} pedido={null} aoEscolher={aoEscolher} bate={(b) => botaoBate(b, v.mao)} aoBater={aoBater} />,
    );
    const truco = screen.getByRole('button', { name: 'Truco!' });
    fireEvent.pointerDown(truco, { button: 0, pointerId: 1 });
    t += 1500;
    fireEvent.pointerUp(truco, { button: 0, pointerId: 1 });
    fireEvent.click(truco, { detail: 1 });
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoBater).not.toHaveBeenCalled();
  });
});
