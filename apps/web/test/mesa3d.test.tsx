import { reduce } from '@truco/engine';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Estado3D, OpcoesCena3D } from '../src/componentes/mesa3d/tipos';
import { exibicaoMesa } from '../src/logica/jogadas';
import { estadoMesa3D } from '../src/logica/mesa3d';
import type { EstadoLoja } from '../src/rede/loja';
import { CHAVE_VISTA_3D, TelaMesa } from '../src/telas/Mesa';
import { CADEIRAS_PADRAO, distribuida, jogar, msgEstado, PAULISTA } from './fixtures';

const atualizacoes: Estado3D[] = [];
const destruir = vi.fn();
const opcoesRecebidas: OpcoesCena3D[] = [];
vi.mock('../src/componentes/mesa3d/cena', () => ({
  criarCena3D: (_c: HTMLElement, o: OpcoesCena3D) => {
    opcoesRecebidas.push(o);
    return { atualizar: (e: Estado3D) => atualizacoes.push(e), bater: vi.fn(), destruir };
  },
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

describe('itens da loja na vista 3D (F2.9)', () => {
  const ROUPA = { camisa: '#1d4e89', estampa: 'listra' as const, chapeu: 'bone' as const, chapeuCor: '#d9a400' };
  const VERSO = { cor: '#0b3d2e', linha: '#7fc8a9', estampa: 'losango' as const };

  test('estadoMesa3D leva a roupa de cada cadeira e o verso de quem deu as cartas (o pé)', () => {
    const s = distribuida(PAULISTA);
    const msg = msgEstado(s, 0);
    const v = msg.visao!;
    const cadeiras = CADEIRAS_PADRAO.map((c, i) => ({
      ...c,
      visual: { verso: i === v.pe ? VERSO : null, roupa: i === 2 ? ROUPA : null, moldura: 'nenhuma' as const },
    }));
    const e = estadoMesa3D({ visao: v, minha: 0, cadeiras: cadeiras as typeof CADEIRAS_PADRAO, prazo: null, baloes: new Map(), exibicao: exibicaoMesa(v.mao, v.ultimaMao), naPilha: 0, agora: 0 });
    expect(e.jogadores.find((j) => j.pos === 'cima')!.roupa).toEqual(ROUPA);
    expect(e.jogadores.find((j) => j.pos === 'direita')!.roupa ?? null).toBeNull();
    expect(e.verso).toEqual({ cor: VERSO.cor, linha: VERSO.linha });
  });

  test('sem item equipado: verso e roupa padrão (null)', () => {
    const msg = msgEstado(distribuida(PAULISTA), 0);
    const v = msg.visao!;
    const e = estadoMesa3D({ visao: v, minha: 0, cadeiras: CADEIRAS_PADRAO, prazo: null, baloes: new Map(), exibicao: exibicaoMesa(v.mao, v.ultimaMao), naPilha: 0, agora: 0 });
    expect(e.verso ?? null).toBeNull();
    expect(e.jogadores.every((j) => (j.roupa ?? null) === null)).toBe(true);
  });

  test('vestir3D aplica camisa, estampa e chapéu da roupa sobre o visual do personagem', async () => {
    const { vestir3D } = await import('../src/componentes/mesa3d/vestir');
    const base = { estilo: 'careca' as const, pele: '#e3b596', camisa: '#efeadf', calca: '#5b4636', cabelo: '#3a2618', labios: '#9a5a4a' };
    expect(vestir3D(base, null)).toEqual(base);
    expect(vestir3D(base, ROUPA)).toMatchObject({ camisa: 'listras', estilo: 'bone', bone: '#d9a400', pele: base.pele });
    expect(vestir3D(base, { camisa: '#123456' })).toMatchObject({ camisa: '#123456', estilo: 'careca' });
    expect(vestir3D(base, { estampa: 'xadrez' }).camisa).toBe('xadrez');
    expect(vestir3D(base, { camisa: '#abcdef', estampa: 'regata' }).camisa).toBe('#abcdef');
    expect(vestir3D(base, { chapeu: 'palha' }).estilo).toBe('palha');
    expect(vestir3D(base, { chapeu: 'feltro', chapeuCor: '#222222' })).toMatchObject({ estilo: 'boina', bone: '#222222' });
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

  test('contexto WebGL perdido no meio da partida volta para a mesa 2D com aviso', async () => {
    localStorage.setItem(CHAVE_VISTA_3D, '1');
    render(<TelaMesa snap={snap()} acoes={acoes()} />);
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(screen.getByTestId('mesa-3d')).toBeInTheDocument();
    const perder = opcoesRecebidas.at(-1)?.aoPerderContexto;
    expect(perder).toBeTypeOf('function');
    act(() => perder!());
    expect(screen.queryByTestId('mesa-3d')).toBeNull();
    expect(screen.getByTestId('tampo')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Voltamos para a mesa normal');
  });

  test('troca madeira por feltro e plástico também na cena 3D sem alterar a jogada', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TelaMesa snap={snap()} acoes={acoes()} temConta={true} />);
    expect(screen.getByTestId('tampo')).toHaveAttribute('data-superficie', 'madeira');
    await user.click(screen.getByRole('button', { name: 'Personalizar mesa' }));
    await user.click(screen.getByRole('button', { name: /Feltro de clube/ }));
    expect(screen.getByTestId('tampo')).toHaveAttribute('data-superficie', 'feltro');
    await user.click(screen.getByRole('button', { name: '3D' }));
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(atualizacoes.at(-1)?.aparenciaMesa).toBe('feltro');
    await user.click(screen.getByRole('button', { name: /Plástico de bar/ }));
    expect(atualizacoes.at(-1)?.aparenciaMesa).toBe('plastico');
    unmount();
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
