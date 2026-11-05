import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { Evento } from '../src/logica/eventos';
import type { EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { reduce } from '@truco/engine';
import { distribuida, jogar, MINEIRO, msgEstado, PAULISTA } from './fixtures';

const acoesFalsas = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() });
const snap = (msg: EstadoLoja['msg'], eventos: Evento[] = []): EstadoLoja => ({ status: 'na-mesa', msg, eventos, erro: null });

describe('TelaMesa', () => {
  test('mostra placar, valor da mão e minha mão; clicar joga a carta', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={acoes} />);
    expect(screen.getByLabelText('Placar')).toHaveTextContent('Mão vale 1');
    const mao = screen.getByTestId('minha-mao');
    expect(within(mao).getAllByRole('button', { name: /de ouros$/ })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: '4 de ouros' }));
    expect(acoes.enviarAcao).toHaveBeenCalledWith({ tipo: 'jogar', cadeira: 0, indice: 0 });
    await user.click(screen.getByRole('button', { name: 'Truco!' }));
    expect(acoes.enviarAcao).toHaveBeenLastCalledWith({ tipo: 'truco', cadeira: 0 });
  });

  test('assentos: nomes nas posições certas e balão de quem trucou', () => {
    const balao: Evento = { id: 1, em: Date.now(), tipo: 'acao', de: 1, texto: 'TRUCO!' };
    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)), [balao])} acoes={acoesFalsas()} />);
    expect(screen.getByTestId('assento-direita')).toHaveTextContent('Bot Zé');
    expect(screen.getByTestId('assento-cima')).toHaveTextContent('Bot Tião');
    expect(screen.getByTestId('assento-esquerda')).toHaveTextContent('Bot Dita');
    expect(within(screen.getByTestId('assento-direita')).getByRole('status')).toHaveTextContent('TRUCO!');
  });

  test('vez: na resposta a truco marca a minha dupla inteira, mesmo com prazo só meu', () => {
    const s = reduce(jogar(distribuida(PAULISTA), [[0, 0]]), { tipo: 'truco', cadeira: 1 });
    const msg = msgEstado(s, 0, { prazo: { cadeiras: [0], ate: Date.now() + 20_000 } });
    render(<TelaMesa snap={snap(msg)} acoes={acoesFalsas()} />);
    expect(screen.getByTestId('assento-baixo')).toHaveClass('da-vez');
    expect(screen.getByTestId('assento-cima')).toHaveClass('da-vez');
    expect(screen.getByTestId('assento-direita')).not.toHaveClass('da-vez');
    expect(screen.getByTestId('assento-esquerda')).not.toHaveClass('da-vez');
  });

  test('mão de 10: vejo a mão do parceiro e decido', () => {
    render(<TelaMesa snap={snap(msgEstado(distribuida(MINEIRO, undefined, [10, 0])))} acoes={acoesFalsas()} />);
    const cima = screen.getByTestId('assento-cima');
    expect(within(cima).getByRole('img', { name: '4 de copas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jogar a mão' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Correr da mão' })).toBeInTheDocument();
  });

  test('sinais: abrir o painel e mandar', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={acoes} />);
    await user.click(screen.getByRole('button', { name: 'Sinais' }));
    await user.click(screen.getByRole('button', { name: 'Piscar — Zap' }));
    expect(acoes.enviarSinal).toHaveBeenCalledWith('zap');
  });

  test('fim de partida: vencedor e "Jogar de novo"', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    const base = msgEstado(distribuida(PAULISTA));
    const msg = { ...base, minhasAcoes: [], visao: { ...base.visao!, fase: 'fimPartida' as const, mao: null, vencedor: 0 as const, placar: [12, 4] as [number, number] } };
    render(<TelaMesa snap={snap(msg)} acoes={acoes} />);
    const fim = screen.getByTestId('fim-partida');
    expect(fim).toHaveTextContent('Vitória!');
    expect(fim).toHaveTextContent('Nós 12 × 4 Eles');
    await user.click(within(fim).getByRole('button', { name: 'Jogar de novo' }));
    expect(acoes.sair).toHaveBeenCalled();
  });
});
