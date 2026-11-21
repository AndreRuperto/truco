import { reduce } from '@truco/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { TreinadorTutorial } from '../src/componentes/TreinadorTutorial';
import { distribuida, jogar, msgEstado, naSegundaRodada, PAULISTA } from './fixtures';

const nome = (c: number) => `Jogador ${c}`;
const props = { nome, aoPular: vi.fn(), aoTerminar: vi.fn() };

describe('treinador do tutorial', () => {
  test('mostra o passo novo, com o progresso e "Pular tutorial"', async () => {
    const user = userEvent.setup();
    const aoPular = vi.fn();
    render(<TreinadorTutorial {...props} msg={msgEstado(distribuida(PAULISTA), 0)} aoPular={aoPular} />);
    const painel = screen.getByRole('complementary', { name: 'Tutorial' });
    expect(painel).toHaveAttribute('data-passo', 'primeira-carta');
    expect(screen.getByRole('heading', { name: 'Sua vez de jogar' })).toBeInTheDocument();
    expect(painel).toHaveTextContent('já viu 1 de 7');
    await user.click(screen.getByRole('button', { name: 'Pular tutorial' }));
    expect(aoPular).toHaveBeenCalledOnce();
  });

  test('"Recolher" vira uma etiqueta; passo já visto não abre de novo; passo novo abre sozinho', async () => {
    const user = userEvent.setup();
    const s = distribuida(PAULISTA);
    const { rerender } = render(<TreinadorTutorial {...props} msg={msgEstado(s, 0)} />);
    await user.click(screen.getByRole('button', { name: 'Recolher' }));
    expect(screen.getByRole('complementary', { name: 'Tutorial' })).toHaveAttribute('data-passo', 'recolhido');
    expect(screen.getByRole('button', { name: 'Abrir o tutorial (já viu 1 de 7)' })).toHaveTextContent('Tutorial · 1/7');
    // "Pular" continua à mão, mesmo recolhido.
    expect(screen.getByRole('button', { name: 'Pular' })).toBeInTheDocument();
    // Vez de outro (passo novo): abre.
    const outro = jogar(s, [[0, 0]]);
    rerender(<TreinadorTutorial {...props} msg={msgEstado(outro, 0)} />);
    expect(screen.getByRole('complementary', { name: 'Tutorial' })).toHaveAttribute('data-passo', 'esperar');
    // Recolhe, e a mesma situação de novo não reabre.
    await user.click(screen.getByRole('button', { name: 'Recolher' }));
    rerender(<TreinadorTutorial {...props} msg={msgEstado(jogar(outro, [[1, 0]]), 0)} />);
    expect(screen.getByRole('complementary', { name: 'Tutorial' })).toHaveAttribute('data-passo', 'recolhido');
    // Tocar na etiqueta abre o passo do momento.
    await user.click(screen.getByRole('button', { name: /Abrir o tutorial/ }));
    expect(screen.getByRole('complementary', { name: 'Tutorial' })).toHaveAttribute('data-passo', 'esperar');
  });

  test('decisão abre sempre, mesmo já vista (responder truco)', () => {
    const trucado = reduce(naSegundaRodada(distribuida(PAULISTA)), { tipo: 'truco', cadeira: 0 });
    const { rerender } = render(<TreinadorTutorial {...props} msg={msgEstado(trucado, 1)} />);
    expect(screen.getByRole('complementary', { name: 'Tutorial' })).toHaveAttribute('data-passo', 'responder');
    rerender(<TreinadorTutorial {...props} msg={msgEstado(distribuida(PAULISTA), 1)} />);
    rerender(<TreinadorTutorial {...props} msg={msgEstado(trucado, 1)} />);
    expect(screen.getByRole('complementary', { name: 'Tutorial' })).toHaveAttribute('data-passo', 'responder');
  });

  test('fim da partida: "Terminar tutorial" e a lista do que não apareceu', async () => {
    const user = userEvent.setup();
    const aoTerminar = vi.fn();
    let s = naSegundaRodada(distribuida(PAULISTA));
    while (!s.ultimaMao) s = jogar(s, [[s.mao!.vez, 0]]);
    render(<TreinadorTutorial {...props} aoTerminar={aoTerminar} msg={msgEstado({ ...s, fase: 'fimPartida', vencedor: 1 }, 0)} />);
    expect(screen.getByText(/Não apareceu nesta partida:.*família/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Terminar tutorial' }));
    expect(aoTerminar).toHaveBeenCalledOnce();
  });
});

describe('treinador sem passo no momento', () => {
  test('a etiqueta abre mesmo assim, e o painel tem "Pular tutorial"', async () => {
    const user = userEvent.setup();
    const aoPular = vi.fn();
    const espera = msgEstado(null, 0);
    // Sem visão não há passo: começa recolhido.
    render(<TreinadorTutorial {...props} aoPular={aoPular} msg={espera} />);
    await user.click(screen.getByRole('button', { name: /Abrir o tutorial/ }));
    expect(screen.getByText(/Acompanhe a mesa/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pular tutorial' }));
    expect(aoPular).toHaveBeenCalledOnce();
  });
});
