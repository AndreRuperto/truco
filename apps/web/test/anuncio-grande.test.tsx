import { reduce } from '@truco/engine';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AnuncioGrande } from '../src/componentes/AnuncioGrande';
import { anuncioGrande, DURACAO_ANUNCIO_MS, type Evento } from '../src/logica/eventos';
import type { EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { distribuida, MINEIRO, msgEstado, naSegundaRodada, PAULISTA } from './fixtures';

const ev = (id: number, em: number, texto: string, tipo: 'acao' | 'fala' = 'acao', de: 0 | 1 | 2 | 3 = 1): Evento => ({ id, em, tipo, de, texto });

describe('anuncioGrande: quais falas viram o anúncio grande no meio da mesa', () => {
  test('pedido de truco e aumentos (ação de verdade) viram anúncio', () => {
    for (const texto of ['TRUCO!', 'SEIS!', 'NOVE!', 'DOZE!']) {
      expect(anuncioGrande([ev(1, 1_000, texto)], 1_100)).toEqual({ id: 1, de: 1, tipo: 'truco', texto });
    }
  });

  test('o desafio da família fechada vira anúncio; aberta e outras respostas não', () => {
    expect(anuncioGrande([ev(2, 0, 'Família fechada!')], 10)).toEqual({ id: 2, de: 1, tipo: 'familia', texto: 'FAMÍLIA FECHADA!' });
    for (const texto of ['Família aberta!', 'Família!', 'Aceito!', 'Corro!', 'Cortei.']) {
      expect(anuncioGrande([ev(3, 0, texto)], 10)).toBeNull();
    }
  });

  test('a fala "TRUCO!" do painel de falas é provocação, não pedido: não vira anúncio', () => {
    expect(anuncioGrande([ev(4, 0, 'TRUCO!', 'fala')], 10)).toBeNull();
  });

  test('some depois da duração e mostra só o mais recente', () => {
    const eventos = [ev(5, 0, 'TRUCO!', 'acao', 0), ev(6, 500, 'SEIS!', 'acao', 1), ev(7, 600, 'Aceito!', 'acao', 0)];
    expect(anuncioGrande(eventos, 700)?.texto).toBe('SEIS!');
    expect(anuncioGrande(eventos, 500 + DURACAO_ANUNCIO_MS)).toBeNull();
    expect(DURACAO_ANUNCIO_MS).toBeLessThanOrEqual(2_000);
  });
});

describe('AnuncioGrande (componente)', () => {
  test('mostra a palavra e quem pediu, sem bloquear cliques e fora do leitor de tela', () => {
    render(<AnuncioGrande anuncio={{ id: 1, de: 1, tipo: 'truco', texto: 'TRUCO!' }} quem="Bot Zé" />);
    const el = screen.getByTestId('anuncio-grande');
    expect(el).toHaveTextContent('TRUCO!');
    expect(el).toHaveTextContent('Bot Zé');
    // O pedido já é anunciado pela região da mesa ("Pediram Truco! Vale 3.") e a família pela etapa.
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveAttribute('data-tipo', 'truco');
  });

  test('sem anúncio, nada na tela', () => {
    const { container } = render(<AnuncioGrande anuncio={null} quem="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

const acoesFalsas = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() });
const snap = (msg: EstadoLoja['msg'], eventos: Evento[] = []): EstadoLoja => ({ status: 'na-mesa', msg, eventos, erro: null, chat: [], salaId: 'r1' });

describe('TelaMesa: anúncio grande', () => {
  test('truco pedido: anúncio grande + a região que já anunciava continua (uma leitura só)', () => {
    const s = reduce(naSegundaRodada(distribuida(PAULISTA)), { tipo: 'truco', cadeira: 0 });
    render(<TelaMesa snap={snap(msgEstado(s, 1), [ev(1, Date.now(), 'TRUCO!', 'acao', 0)])} acoes={acoesFalsas()} />);
    const grande = screen.getByTestId('anuncio-grande');
    expect(grande).toHaveTextContent('TRUCO!');
    expect(grande).toHaveTextContent('Ana');
    expect(grande).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('anuncio-mesa')).toHaveTextContent('Pediram Truco! Vale 3.');
    // Os botões de resposta continuam lá.
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeInTheDocument();
  });

  test('família fechada pedida: anúncio grande + a etapa que já anunciava', () => {
    const t = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    render(<TelaMesa snap={snap(msgEstado(t, 1), [ev(1, Date.now(), 'Família fechada!', 'acao', 0)])} acoes={acoesFalsas()} />);
    expect(screen.getByTestId('anuncio-grande')).toHaveTextContent('FAMÍLIA FECHADA!');
    expect(screen.getByTestId('anuncio-grande')).toHaveTextContent('Ana');
    expect(screen.getByTestId('etapa')).toHaveTextContent('Ana pediu família fechada. Conferir?');
  });

  test('correram na hora: o resumo da mão manda, sem placa meio escondida atrás dele', () => {
    let s = naSegundaRodada(distribuida(PAULISTA));
    s = reduce(reduce(s, { tipo: 'truco', cadeira: 0 }), { tipo: 'correr', cadeira: 1 });
    render(<TelaMesa snap={snap(msgEstado(s, 0), [ev(1, Date.now(), 'TRUCO!', 'acao', 0)])} acoes={acoesFalsas()} />);
    expect(screen.getByTestId('fim-mao')).toBeInTheDocument();
    expect(screen.queryByTestId('anuncio-grande')).toBeNull();
  });

  test('com o manual aberto (janela modal), a placa não passa por cima', async () => {
    const user = userEvent.setup();
    const s = reduce(naSegundaRodada(distribuida(PAULISTA)), { tipo: 'truco', cadeira: 0 });
    render(<TelaMesa snap={snap(msgEstado(s, 1), [ev(1, Date.now(), 'TRUCO!', 'acao', 0)])} acoes={acoesFalsas()} />);
    expect(screen.getByTestId('anuncio-grande')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Como jogar' }));
    expect(screen.queryByTestId('anuncio-grande')).toBeNull();
  });

  test('evento velho: sem anúncio', () => {
    const s = reduce(naSegundaRodada(distribuida(PAULISTA)), { tipo: 'truco', cadeira: 0 });
    render(<TelaMesa snap={snap(msgEstado(s, 0), [ev(1, Date.now() - 10_000, 'TRUCO!', 'acao', 1)])} acoes={acoesFalsas()} />);
    expect(screen.queryByTestId('anuncio-grande')).toBeNull();
  });
});
