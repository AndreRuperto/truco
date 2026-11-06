import { reduce } from '@truco/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { sonsDaAcao, sonsDoEstado } from '../src/som/decidir';
import { CHAVE_SOM, lerSomLigado } from '../src/som/useSons';
import type { EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { distribuida, jogar, msgEstado, naSegundaRodada, PAULISTA } from './fixtures';

const tocados: string[] = [];
vi.mock('../src/som/sintese', () => ({ destravarAudio: vi.fn(), sintetizar: (n: string) => tocados.push(n) }));

beforeEach(() => {
  localStorage.clear();
  tocados.length = 0;
});

describe('que som cada coisa faz', () => {
  test('ações: carta, truco, aceito, corre, embaralhar, corte; distribuir = um "tec" por leva, no ritmo da animação', () => {
    expect(sonsDaAcao({ cadeira: 1, tipo: 'jogar' }, 0)).toEqual([{ nome: 'carta', atraso: 0 }]);
    expect(sonsDaAcao({ cadeira: 1, tipo: 'truco' }, 0)[0].nome).toBe('truco');
    expect(sonsDaAcao({ cadeira: 1, tipo: 'aumentar' }, 0)[0].nome).toBe('truco');
    expect(sonsDaAcao({ cadeira: 1, tipo: 'aceitar' }, 0)[0].nome).toBe('aceito');
    expect(sonsDaAcao({ cadeira: 1, tipo: 'correr' }, 0)[0].nome).toBe('corre');
    expect(sonsDaAcao({ cadeira: 1, tipo: 'embaralhar' }, 0)[0].nome).toBe('embaralhar');
    expect(sonsDaAcao({ cadeira: 1, tipo: 'mostrar' }, 0)).toHaveLength(4);
    const dar = sonsDaAcao({ cadeira: 3, tipo: 'distribuir', modo: 'porCima', ordem: [0, 1, 2, 3] }, 0);
    expect(dar.length).toBeGreaterThan(0);
    expect(dar.every((s) => s.nome === 'carta')).toBe(true);
    expect(dar.map((s) => s.atraso)).toEqual([...dar.map((s) => s.atraso)].sort((a, b) => a - b));
    expect(sonsDaAcao({ cadeira: 1, tipo: 'conferir', conferir: false }, 0)).toEqual([]);
  });

  test('estado: rodada nossa/deles/cangou e nada no primeiro estado', () => {
    const s0 = distribuida(PAULISTA);
    const v0 = msgEstado(s0).visao!;
    expect(sonsDoEstado(null, v0, 0)).toEqual([]);
    const s1 = jogar(s0, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    const r = s1.mao!.rodadas[0];
    const esperado = r === 'empate' ? 'cangou' : r === 0 ? 'rodadaNossa' : 'rodadaDeles';
    expect(sonsDoEstado(v0, msgEstado(s1).visao!, 0).map((x) => x.nome)).toEqual([esperado]);
    // o mesmo resultado visto da outra dupla
    if (r !== 'empate') {
      const outro = r === 0 ? 'rodadaDeles' : 'rodadaNossa';
      expect(sonsDoEstado(msgEstado(s0, 1).visao!, msgEstado(s1, 1).visao!, 1).map((x) => x.nome)).toEqual([outro]);
    }
  });

  test('mão decidida: quem levou; correr do truco também conta', () => {
    const s0 = naSegundaRodada(distribuida(PAULISTA));
    const v0 = msgEstado(s0).visao!;
    // truco na 2ª rodada e a outra dupla corre
    const quem = s0.mao!.vez;
    const comTruco = reduce(s0, { tipo: 'truco', cadeira: quem });
    const fim = reduce(comTruco, { tipo: 'correr', cadeira: ((quem + 1) % 4) as 0 | 1 | 2 | 3 });
    const nome = sonsDoEstado(v0, msgEstado(fim).visao!, 0)[0].nome;
    expect(nome).toBe(fim.ultimaMao!.vencedor === 0 ? 'maoNossa' : 'maoDeles');
  });
});

describe('botão Som', () => {
  const snap = (): EstadoLoja => ({ status: 'na-mesa', msg: msgEstado(distribuida(PAULISTA)), eventos: [], erro: null, chat: [], salaId: 'r1' });
  const acoes = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() });

  test('ligado por padrão; desligar fica gravado e cala os sons', async () => {
    const user = userEvent.setup();
    expect(lerSomLigado()).toBe(true);
    const { rerender } = render(<TelaMesa snap={snap()} acoes={acoes()} />);
    const botao = screen.getByRole('button', { name: 'Som' });
    expect(botao).toHaveAttribute('aria-pressed', 'true');
    await user.click(botao);
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem(CHAVE_SOM)).toBe('0');
    tocados.length = 0;
    const depois = jogar(distribuida(PAULISTA), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    rerender(<TelaMesa snap={{ ...snap(), msg: msgEstado(depois), movimentos: [{ id: 1, msg: { cadeira: 3, tipo: 'jogar' } }] }} acoes={acoes()} />);
    expect(tocados).toEqual([]);
  });

  test('com som: a rodada fechada toca', () => {
    const { rerender } = render(<TelaMesa snap={snap()} acoes={acoes()} />);
    const depois = jogar(distribuida(PAULISTA), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    rerender(<TelaMesa snap={{ ...snap(), msg: msgEstado(depois) }} acoes={acoes()} />);
    expect(tocados.some((n) => ['rodadaNossa', 'rodadaDeles', 'cangou'].includes(n))).toBe(true);
  });
});
