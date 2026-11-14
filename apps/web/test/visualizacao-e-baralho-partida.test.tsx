import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { TelaMesa, CHAVE_VISTA_3D } from '../src/telas/Mesa';
import { CHAVE_VISUALIZACAO_MESA, gravarVisualizacaoMesa, lerVisualizacaoMesa } from '../src/logica/visualizacaoMesa';
import type { EstadoLoja } from '../src/rede/loja';
import { distribuida, msgEstado, noRitual, PAULISTA } from './fixtures';

const acoes = () => ({
  enviarAcao: vi.fn(),
  enviarSinal: vi.fn(),
  enviarFala: vi.fn(),
  sair: vi.fn(),
});
const snap = (msg: NonNullable<EstadoLoja['msg']>): EstadoLoja => ({
  status: 'na-mesa', msg, eventos: [], erro: null, chat: [], salaId: 'r1',
});

describe('visualização da partida', () => {
  test('a vista antiga mostra quatro cadeiras e mantém as ações e cartas', async () => {
    const user = userEvent.setup();
    const a = acoes();
    const { unmount } = render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={a} />);
    expect(document.querySelector('.tela-mesa')).toHaveAttribute('data-visualizacao', 'personagens');

    await user.click(screen.getByRole('button', { name: 'Visual da mesa' }));
    const menu = screen.getByRole('group', { name: 'Selecionar visualização da mesa' });
    expect(within(menu).getAllByRole('button')).toHaveLength(3);
    await user.click(within(menu).getByRole('button', { name: 'Cadeiras (vista de cima)' }));

    expect(document.querySelector('.tela-mesa')).toHaveAttribute('data-visualizacao', 'cadeiras');
    expect(screen.getByTestId('tampo')).toBeInTheDocument();
    expect(document.querySelectorAll('.mobilia .cadeira')).toHaveLength(4);
    expect(localStorage.getItem(CHAVE_VISUALIZACAO_MESA)).toBe('cadeiras');
    expect(localStorage.getItem(CHAVE_VISTA_3D)).toBe('0');

    await user.click(screen.getByRole('button', { name: '4 de ouros' }));
    expect(a.enviarAcao).toHaveBeenCalledWith({ tipo: 'jogar', cadeira: 0, indice: 0 });

    // O atalho 3D deve voltar para a última vista 2D selecionada.
    await user.click(screen.getByRole('button', { name: '3D' }));
    expect(screen.getByTestId('mesa-3d')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '3D' }));
    expect(document.querySelector('.tela-mesa')).toHaveAttribute('data-visualizacao', 'cadeiras');
    unmount();

    render(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA)))} acoes={acoes()} />);
    expect(document.querySelector('.tela-mesa')).toHaveAttribute('data-visualizacao', 'cadeiras');
  });

  test('a chave antiga de preferência 3D continua sendo reconhecida', () => {
    localStorage.setItem(CHAVE_VISTA_3D, '1');
    expect(lerVisualizacaoMesa()).toBe('3d');
    gravarVisualizacaoMesa('personagens');
    expect(lerVisualizacaoMesa()).toBe('personagens');
    expect(localStorage.getItem(CHAVE_VISTA_3D)).toBe('0');
  });
});

describe('floreios do baralho na partida (habilidade da loja)', () => {
  test('com Floreios: cada truque embaralha de verdade (manda a ação) e anima o monte', async () => {
    const user = userEvent.setup();
    const s = noRitual(PAULISTA);
    const minha = s.ritual!.embaralhador;
    const a = acoes();
    const { rerender } = render(<TelaMesa snap={snap(msgEstado(s, minha))} acoes={a} floreios />);
    const painel = screen.getByTestId('treino-na-partida');
    expect(within(painel).queryByText('Só de treino')).toBeNull();
    const opcoes = within(painel).getByRole('group', { name: 'Truques de embaralhamento' });
    expect(within(opcoes).getAllByRole('button')).toHaveLength(4);
    let n = 0;
    for (const [rotulo, movimento] of [
      ['Cascata com ponte', 'cascata'],
      ['Corte triplo', 'corte'],
      ['Leque de cartas', 'leque'],
      ['Mola de cartas', 'mola'],
    ] as const) {
      await user.click(within(opcoes).getByRole('button', { name: rotulo }));
      n++;
      expect(within(painel).getByTestId('baralho-treino')).toHaveAttribute('data-movimento', movimento);
      expect(a.enviarAcao).toHaveBeenCalledTimes(n);
      expect(a.enviarAcao).toHaveBeenLastCalledWith({ tipo: 'embaralhar', cadeira: minha });
    }

    // Na distribuição o painel sai sozinho.
    rerender(<TelaMesa snap={snap(msgEstado(distribuida(PAULISTA), minha))} acoes={a} floreios />);
    expect(screen.queryByTestId('treino-na-partida')).toBeNull();
  });

  test('sem a habilidade: nada de truques, embaralha pelo botão normal', () => {
    const s = noRitual(PAULISTA);
    render(<TelaMesa snap={snap(msgEstado(s, s.ritual!.embaralhador))} acoes={acoes()} />);
    expect(screen.queryByTestId('treino-na-partida')).toBeNull();
    expect(screen.getByRole('button', { name: 'Embaralhar' })).toBeInTheDocument();
  });

  test('quem não está embaralhando não ganha controles que confundem a vez', () => {
    const s = noRitual(PAULISTA);
    const outra = ((s.ritual!.embaralhador + 1) % 4) as 0 | 1 | 2 | 3;
    render(<TelaMesa snap={snap(msgEstado(s, outra))} acoes={acoes()} floreios />);
    expect(screen.queryByTestId('treino-na-partida')).toBeNull();
    expect(screen.getByTestId('monte')).toBeInTheDocument();
  });
});
