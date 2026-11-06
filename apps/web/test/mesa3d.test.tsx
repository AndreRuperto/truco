import { reduce } from '@truco/engine';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Estado3D } from '../src/componentes/mesa3d/tipos';
import { exibicaoMesa } from '../src/logica/jogadas';
import { estadoMesa3D } from '../src/logica/mesa3d';
import type { EstadoLoja } from '../src/rede/loja';
import { CHAVE_VISTA_3D, TelaMesa } from '../src/telas/Mesa';
import { CADEIRAS_PADRAO, distribuida, jogar, msgEstado, PAULISTA } from './fixtures';

const atualizacoes: Estado3D[] = [];
const destruir = vi.fn();
vi.mock('../src/componentes/mesa3d/cena', () => ({
  criarCena3D: () => ({ atualizar: (e: Estado3D) => atualizacoes.push(e), bater: vi.fn(), destruir }),
}));

beforeEach(() => {
  localStorage.clear();
  atualizacoes.length = 0;
});

describe('estadoMesa3D', () => {
  test('posições relativas a quem olha, cartas na mão, vez, prazo, balões e jogadas', () => {
    const s = jogar(distribuida(PAULISTA), [[0, 0]]);
    const msg = msgEstado(s, 1, { prazo: { cadeiras: [1], ate: 10_000 } });
    const v = msg.visao!;
    const e = estadoMesa3D({
      visao: v,
      minha: 1,
      cadeiras: CADEIRAS_PADRAO,
      prazo: msg.prazo,
      baloes: new Map([[0, 'TRUCO!']]),
      exibicao: exibicaoMesa(v.mao, v.ultimaMao),
      naPilha: 0,
      agora: 2_500,
    });
    expect(e.jogadores.map((j) => [j.pos, j.nome])).toEqual([
      ['baixo', 'Bot Zé'],
      ['direita', 'Bot Tião'],
      ['cima', 'Bot Dita'],
      ['esquerda', 'Ana'],
    ]);
    const eu = e.jogadores[0];
    expect(eu).toMatchObject({ qtdCartas: 3, daVez: true, segundos: 8 });
    expect(e.jogadores[3]).toMatchObject({ qtdCartas: 2, fala: 'TRUCO!', gritando: true, segundos: null });
    expect(e.jogadas).toHaveLength(1);
    expect(e.jogadas[0]).toMatchObject({ pos: 'esquerda', carta: s.mao!.rodadasJogadas.length === 0 ? expect.any(Object) : null });
    expect(e.variante).toBe('paulista');
    expect(e.vira).toEqual(s.mao!.vira);
  });
});

describe('vista 3D na mesa', () => {
  const snap = (): EstadoLoja => ({ status: 'na-mesa', msg: msgEstado(distribuida(PAULISTA)), eventos: [], erro: null, chat: [], salaId: 'r1' });
  const acoes = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() });

  test('o botão 3D troca a mesa pela cena, lembra a escolha e a mão continua jogável', async () => {
    const user = userEvent.setup();
    const a = acoes();
    const { unmount } = render(<TelaMesa snap={snap()} acoes={a} />);
    expect(screen.getByTestId('tampo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '3D' }));
    expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('tampo')).toBeNull();
    expect(screen.getByTestId('mesa-3d')).toBeInTheDocument();
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    expect(atualizacoes.at(-1)!.jogadores[0].qtdCartas).toBe(3);
    expect(localStorage.getItem(CHAVE_VISTA_3D)).toBe('1');
    await user.click(screen.getByRole('button', { name: '4 de ouros' }));
    expect(a.enviarAcao).toHaveBeenCalledWith({ tipo: 'jogar', cadeira: 0, indice: 0 });
    unmount();
    expect(destruir).toHaveBeenCalled();
    render(<TelaMesa snap={snap()} acoes={acoes()} />);
    expect(screen.getByTestId('mesa-3d')).toBeInTheDocument();
  });

  test('as cartas jogadas vão em texto para o leitor de tela', async () => {
    localStorage.setItem(CHAVE_VISTA_3D, '1');
    const s = jogar(distribuida(PAULISTA), [[0, 0]]);
    render(<TelaMesa snap={{ ...snap(), msg: msgEstado(reduce(s, { tipo: 'jogar', cadeira: 1, indice: 0 })) }} acoes={acoes()} />);
    const lista = screen.getByRole('list', { name: 'Cartas na mesa' });
    expect(lista.querySelectorAll('li')).toHaveLength(2);
    expect(lista).toHaveTextContent('Ana: 4 de ouros');
  });
});
