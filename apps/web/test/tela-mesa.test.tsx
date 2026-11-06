import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { Evento } from '../src/logica/eventos';
import type { EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { reduce } from '@truco/engine';
import { distribuida, jogar, MINEIRO, msgEstado, noRitual, PAULISTA } from './fixtures';

const acoesFalsas = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() });
const snap = (msg: EstadoLoja['msg'], eventos: Evento[] = []): EstadoLoja => ({ status: 'na-mesa', msg, eventos, erro: null, chat: [], salaId: 'r1' });

describe('TelaMesa', () => {
  test('botão ? abre o manual por cima da mesa e Voltar fecha', async () => {
    const user = userEvent.setup();
    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={acoesFalsas()} />);
    await user.click(screen.getByRole('button', { name: 'Como jogar' }));
    expect(screen.getByRole('dialog', { name: 'Como jogar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar pra mesa' }));
    expect(screen.queryByRole('dialog', { name: 'Como jogar' })).toBeNull();
  });

  test('mostra placar, valor da mão e minha mão; clicar joga a carta', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={acoes} />);
    expect(screen.getByRole('group', { name: 'Placar: Nós 0, Eles 0, mão vale 1' })).toHaveTextContent('Mão vale 1');
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

  test('sinais: o de coringa só aparece no mineiro com mão limpa', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TelaMesa snap={snap(msgEstado(distribuida(MINEIRO)))} acoes={acoesFalsas()} />);
    await user.click(screen.getByRole('button', { name: 'Sinais' }));
    expect(screen.queryByRole('button', { name: /Coringa/ })).toBeNull();
    const limpa = { ...MINEIRO, maoLimpa: true };
    rerender(<TelaMesa snap={snap(msgEstado(distribuida(limpa)))} acoes={acoesFalsas()} />);
    expect(screen.getByRole('button', { name: 'Piscar os dois olhos — Coringa' })).toBeInTheDocument();
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
    expect(s.fase).toBe('embaralhando');
    render(<TelaMesa snap={snap(msgEstado(s, 0))} acoes={acoesFalsas()} />);
    const fim = screen.getByTestId('fim-mao');
    expect(fim).toHaveTextContent('Nós levamos!');
    expect(fim).toHaveTextContent('+1 ponto — nas rodadas');
    expect(within(screen.getByTestId('centro')).getByRole('img', { name: /^3 de espadas/ })).toHaveClass('esmaecida');
    expect(screen.queryByTestId('minha-mao')).toBeNull();
  });

  test('fim de partida: "Jogar de novo" começa outra partida e "Voltar ao início" só sai', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    const aoJogarDeNovo = vi.fn();
    const base = msgEstado(distribuida(PAULISTA));
    const msg = { ...base, minhasAcoes: [], visao: { ...base.visao!, fase: 'fimPartida' as const, mao: null, vencedor: 0 as const, placar: [12, 4] as [number, number] } };
    render(<TelaMesa snap={snap(msg)} acoes={acoes} aoJogarDeNovo={aoJogarDeNovo} />);
    const fim = screen.getByTestId('fim-partida');
    expect(fim).toHaveTextContent('Vitória!');
    expect(fim).toHaveTextContent('Nós 12 × 4 Eles');
    await user.click(within(fim).getByRole('button', { name: 'Jogar de novo' }));
    expect(aoJogarDeNovo).toHaveBeenCalledTimes(1);
    expect(acoes.sair).not.toHaveBeenCalled();
    await user.click(within(fim).getByRole('button', { name: 'Voltar ao início' }));
    expect(acoes.sair).toHaveBeenCalledTimes(1);
  });

  test('fim de partida sem "jogar de novo" disponível: o botão principal volta ao início', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    const base = msgEstado(distribuida(PAULISTA));
    const msg = { ...base, minhasAcoes: [], visao: { ...base.visao!, fase: 'fimPartida' as const, mao: null, vencedor: 1 as const, placar: [4, 12] as [number, number] } };
    render(<TelaMesa snap={snap(msg)} acoes={acoes} />);
    const fim = screen.getByTestId('fim-partida');
    expect(within(fim).queryByRole('button', { name: 'Jogar de novo' })).toBeNull();
    await user.click(within(fim).getByRole('button', { name: 'Voltar ao início' }));
    expect(acoes.sair).toHaveBeenCalledTimes(1);
  });
});

describe('TelaMesa no ritual e na família', () => {
  test('quem embaralha: monte com a contagem do seu lado, linha de estado e os dois botões', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    render(<TelaMesa snap={snap(msgEstado(noRitual(), 3))} acoes={acoes} />);
    const monte = screen.getByTestId('monte');
    expect(monte).toHaveAccessibleName('Monte com 40 cartas');
    expect(monte).toHaveClass('monte-baixo');
    expect(screen.getByText('Sua vez de embaralhar')).toBeInTheDocument();
    const barra = screen.getByRole('toolbar', { name: 'Ações' });
    expect(within(barra).getAllByRole('button').map((b) => b.textContent)).toEqual(['Embaralhar', 'Passar pra cortar']);
    await user.click(screen.getByRole('button', { name: 'Passar pra cortar' }));
    expect(acoes.enviarAcao).toHaveBeenCalledWith({ tipo: 'passarCorte', cadeira: 3 });
    expect(screen.queryByTestId('minha-mao')).toBeNull();
  });

  test('a linha de estado fica sempre montada (região viva) e só troca o texto', () => {
    const { rerender } = render(<TelaMesa snap={snap(msgEstado(noRitual(), 3))} acoes={acoesFalsas()} />);
    const linha = screen.getByTestId('etapa');
    expect(linha).toHaveAttribute('role', 'status');
    expect(linha).toHaveTextContent('Sua vez de embaralhar');
    rerender(<TelaMesa snap={snap(msgEstado(distribuida(MINEIRO), 0))} acoes={acoesFalsas()} />);
    expect(screen.getByTestId('etapa')).toBe(linha);
    expect(linha).toBeEmptyDOMElement();
  });

  test('quem corta: as 5 opções e o monte com ele', () => {
    const t = reduce(noRitual(), { tipo: 'passarCorte', cadeira: 3 });
    render(<TelaMesa snap={snap(msgEstado(t, 2))} acoes={acoesFalsas()} />);
    const barra = screen.getByRole('toolbar', { name: 'Ações' });
    expect(within(barra).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cortar', 'Embaralhar', 'Abrir 3', 'Dar 3', 'Devolver']);
    expect(screen.getByTestId('monte')).toHaveClass('monte-baixo');
    expect(screen.getByText('Sua vez de cortar — 3 movimentos')).toBeInTheDocument();
  });

  test('quem dá escolhe o modo', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    const u = reduce(reduce(noRitual(), { tipo: 'passarCorte', cadeira: 3 }), { tipo: 'devolver', cadeira: 2 });
    render(<TelaMesa snap={snap(msgEstado(u, 3))} acoes={acoes} />);
    await user.click(screen.getByRole('button', { name: 'Subindo alternado' }));
    expect(acoes.enviarAcao).toHaveBeenCalledWith({ tipo: 'distribuir', cadeira: 3, modo: 'subindo' });
  });

  test('abrir 3: as abertas aparecem para todos ao lado do monte', () => {
    const t = reduce(reduce(noRitual(), { tipo: 'passarCorte', cadeira: 3 }), { tipo: 'abrir3', cadeira: 2 });
    render(<TelaMesa snap={snap(msgEstado(t, 0))} acoes={acoesFalsas()} />);
    const abertas = screen.getByTestId('abertas-corte');
    expect(within(abertas).getByRole('img', { name: /^4 de ouros/ })).toBeInTheDocument();
    expect(within(abertas).getAllByRole('img')).toHaveLength(3);
  });

  test('família fechada: 3 versos na frente de quem pediu; a dupla adversária confere', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    const t = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    render(<TelaMesa snap={snap(msgEstado(t, 1))} acoes={acoes} />);
    const fam = screen.getByTestId('familia');
    expect(fam).toHaveClass('pos-esquerda');
    expect(within(fam).getAllByRole('img', { name: 'carta virada' })).toHaveLength(3);
    expect(fam).toHaveTextContent('Ana: família fechada');
    expect(screen.getByText('Ana pediu família fechada. Conferir?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Conferir' }));
    expect(acoes.enviarAcao).toHaveBeenCalledWith({ tipo: 'conferir', cadeira: 1, conferir: true });
  });

  test('conferida: todos veem as 3 cartas e o resultado', () => {
    const t = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    const u = reduce(t, { tipo: 'conferir', cadeira: 1, conferir: true });
    render(<TelaMesa snap={snap(msgEstado(u, 2))} acoes={acoesFalsas()} />);
    const fam = screen.getByTestId('familia-conferida');
    expect(fam).toHaveTextContent('Bot Zé conferiu: era família! +2 pra nós');
    expect(within(fam).getByRole('img', { name: /^Dama de ouros/ })).toBeInTheDocument();
    expect(within(fam).queryAllByRole('img', { name: 'carta virada' })).toHaveLength(0);
  });

  test('entre mãos: o resumo fica até o pé novo embaralhar', () => {
    let s = distribuida(PAULISTA);
    s = reduce(reduce(s, { tipo: 'truco', cadeira: 0 }), { tipo: 'correr', cadeira: 1 });
    const { rerender } = render(<TelaMesa snap={snap(msgEstado(s, 0))} acoes={acoesFalsas()} />);
    expect(screen.getByTestId('fim-mao')).toBeInTheDocument();
    const e = reduce(s, { tipo: 'embaralhar', cadeira: s.pe, bits: s.monte.map(() => 0 as const) });
    rerender(<TelaMesa snap={snap(msgEstado(e, 0))} acoes={acoesFalsas()} />);
    expect(screen.queryByTestId('fim-mao')).toBeNull();
  });
});
