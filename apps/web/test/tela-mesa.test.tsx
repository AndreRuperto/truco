import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { Evento } from '../src/logica/eventos';
import type { EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { reduce } from '@truco/engine';
import { distribuida, jogar, MINEIRO, msgEstado, PAULISTA } from './fixtures';

const acoesFalsas = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() });
const snap = (msg: EstadoLoja['msg'], eventos: Evento[] = []): EstadoLoja => ({ status: 'na-mesa', msg, eventos, erro: null, chat: [], salaId: 'r1' });

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

  test('cronômetro pequeno no assento de outro humano com prazo (e não o meu grande)', () => {
    const s = jogar(distribuida(PAULISTA), [[0, 0]]);
    const cadeiras = [
      { tipo: 'humano' as const, nome: 'Ana', conectado: true },
      { tipo: 'humano' as const, nome: 'Bia', conectado: true },
      { tipo: 'bot' as const, nome: 'Bot Tião', conectado: true },
      { tipo: 'bot' as const, nome: 'Bot Dita', conectado: true },
    ];
    const msg = msgEstado(s, 0, { cadeiras, prazo: { cadeiras: [1], ate: Date.now() + 20_000 } });
    render(<TelaMesa snap={snap(msg)} acoes={acoesFalsas()} />);
    const timers = screen.getAllByRole('timer');
    expect(timers).toHaveLength(1);
    expect(within(screen.getByTestId('assento-direita')).getByRole('timer')).toHaveAccessibleName(/^Vez de Bia: (19|20) segundos$/);
  });

  test('com prazo meu e do parceiro: barra grande para mim e pequeno no assento dele', () => {
    const s = reduce(jogar(distribuida(PAULISTA), [[0, 0]]), { tipo: 'truco', cadeira: 1 });
    const cadeiras = [
      { tipo: 'humano' as const, nome: 'Ana', conectado: true },
      { tipo: 'bot' as const, nome: 'Bot Zé', conectado: true },
      { tipo: 'humano' as const, nome: 'Caio', conectado: true },
      { tipo: 'bot' as const, nome: 'Bot Dita', conectado: true },
    ];
    const msg = msgEstado(s, 0, { cadeiras, prazo: { cadeiras: [0, 2], ate: Date.now() + 20_000 } });
    render(<TelaMesa snap={snap(msg)} acoes={acoesFalsas()} />);
    expect(screen.getAllByRole('timer')).toHaveLength(2);
    expect(screen.getByRole('timer', { name: /^Sua vez/ })).toBeInTheDocument();
    expect(within(screen.getByTestId('assento-cima')).getByRole('timer')).toHaveAccessibleName(/^Vez de Caio/);
  });

  test('mão de 10: vejo a mão do parceiro e decido', () => {
    render(<TelaMesa snap={snap(msgEstado(distribuida(MINEIRO, undefined, [10, 0])))} acoes={acoesFalsas()} />);
    const cima = screen.getByTestId('assento-cima');
    expect(within(cima).getByRole('img', { name: '4 de copas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jogar a mão' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Correr da mão' })).toBeInTheDocument();
  });

  test('sinais: o aviso de interceptação segue a chance da mesa', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={acoesFalsas()} />);
    await user.click(screen.getByRole('button', { name: 'Sinais' }));
    expect(screen.getByRole('region', { name: 'Sinais' })).not.toHaveTextContent(/intercept/i);
    rerender(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA), 0, { chanceInterceptarSinal: 0.5 }))} acoes={acoesFalsas()} />);
    expect(screen.getByRole('region', { name: 'Sinais' })).toHaveTextContent(/podem interceptar/);
  });

  test('sinais: abrir o painel e mandar', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={acoes} />);
    await user.click(screen.getByRole('button', { name: 'Sinais' }));
    await user.click(screen.getByRole('button', { name: 'Piscar — Zap' }));
    expect(acoes.enviarSinal).toHaveBeenCalledWith('zap');
  });

  test('entre mãos: resumo da última mão e as cartas que decidiram no centro', () => {
    const maos = [
      ['3o', '3e', '2o'],
      ['4e', '5e', '6e'],
      ['4c', '5c', '6c'],
      ['4p', '5p', '6p'],
    ];
    const s = jogar(distribuida(PAULISTA, maos, [0, 0], '7o'), [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.fase).toBe('aguardandoDistribuicao');
    render(<TelaMesa snap={snap(msgEstado(s, 0))} acoes={acoesFalsas()} />);
    const fim = screen.getByTestId('fim-mao');
    expect(fim).toHaveTextContent('Nós levamos!');
    expect(fim).toHaveTextContent('+1 ponto — nas rodadas');
    expect(within(screen.getByTestId('centro')).getByRole('img', { name: /^3 de espadas/ })).toHaveClass('esmaecida');
    expect(screen.queryByTestId('minha-mao')).toBeNull();
  });

  test('família aberta: o aviso mostra as 3 cartas de quem pediu', () => {
    const regras = { ...PAULISTA, familia: 'aberta' as const };
    const s = reduce(distribuida(regras, [['Qo', 'Je', 'Kc']]), { tipo: 'familia', cadeira: 0 });
    expect(s.ultimaFamilia?.cartas).toHaveLength(3);
    render(<TelaMesa snap={snap(msgEstado(s, 1))} acoes={acoesFalsas()} />);
    const fim = screen.getByTestId('fim-mao');
    expect(fim).toHaveTextContent('Família!');
    expect(within(fim).getAllByRole('img')).toHaveLength(3);
    expect(within(fim).getByRole('img', { name: /^Dama de ouros/ })).toBeInTheDocument();
    expect(within(fim).getByRole('img', { name: /^Rei de copas/ })).toBeInTheDocument();
  });

  test('família fechada: só o aviso, sem cartas', () => {
    const regras = { ...PAULISTA, familia: 'fechada' as const };
    const s = reduce(distribuida(regras, [['Qo', 'Je', 'Kc']]), { tipo: 'familia', cadeira: 0 });
    render(<TelaMesa snap={snap(msgEstado(s, 1))} acoes={acoesFalsas()} />);
    const fim = screen.getByTestId('fim-mao');
    expect(fim).toHaveTextContent('pediu família');
    expect(within(fim).queryAllByRole('img')).toHaveLength(0);
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
