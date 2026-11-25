import { reduce } from '@truco/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { agruparAcoes } from '../src/logica/acoes';
import { CHAVE_DICAS, dicaAgora, lerDicas } from '../src/logica/dicas';
import type { EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { distribuida, jogar, MINEIRO, msgEstado, naSegundaRodada, noRitual, PAULISTA } from './fixtures';
import { textoEtapa } from '../src/logica/ritual';

vi.mock('../src/som/sintese', () => ({ destravarAudio: vi.fn(), sintetizar: vi.fn() }));
beforeEach(() => localStorage.clear());

const dicaDe = (msg: ReturnType<typeof msgEstado>, vistas: string[] = []) => dicaAgora(msg, agruparAcoes(msg.minhasAcoes, msg.visao), vistas as never);

describe('qual dica aparece', () => {
  test('na hora certa: ritual, primeira carta, truco, resposta, cangada', () => {
    expect(dicaDe(msgEstado(noRitual(), 3))?.id).toBe('ritual');
    const s = distribuida(PAULISTA);
    const primeira = dicaDe(msgEstado(s));
    expect(['primeira-carta', 'manilha']).toContain(primeira?.id);
    expect(dicaDe(msgEstado(s), ['primeira-carta', 'manilha'])).toBeNull();
    const r2 = naSegundaRodada(s);
    expect(dicaDe(msgEstado(r2), ['manilha'])?.id).toBe('truco');
    const trucado = reduce(r2, { tipo: 'truco', cadeira: 0 });
    expect(dicaDe(msgEstado(trucado, 1))?.id).toBe('responder');
    // Paulista, novoBaralho: os quatro 4 cangam, mas lá não se empilha (a 2ª é normal).
    expect(dicaDe(msgEstado(jogar(s, [[0, 0], [1, 0], [2, 0], [3, 0]])))?.id).not.toBe('cangada');
  });

  test('cangada: só o mineiro empilha (vale a de baixo); no paulista a 2ª é jogada normal', () => {
    // R1 canga (3o x 3e); ninguém tem manilha.
    const MAOS = [['3o', '5o', '6o'], ['3e', '2e', '6e'], ['4o', '5e', 'Qo'], ['4e', '5c', 'Qe']];
    const r1: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];
    const paulista = jogar(distribuida(PAULISTA, MAOS, [0, 0], 'Jp'), r1 as never);
    const mineiro = jogar(distribuida(MINEIRO, MAOS), r1 as never);
    expect(dicaDe(msgEstado(paulista))?.id).not.toBe('cangada');
    expect(paulista.fase).toBe('jogando');
    expect(dicaDe(msgEstado(mineiro))?.texto).toMatch(/Quem decide é a de baixo/);
    expect(textoEtapa(msgEstado(mineiro).visao!, () => 'x')).toBe('Cangou! Escolha a carta que vai por cima (vale a de baixo)');
  });

  test('fora da vez, nada', () => {
    expect(dicaDe(msgEstado(distribuida(PAULISTA), 1))).toBeNull();
  });
});

describe('dica na mesa', () => {
  const snap = (msg = msgEstado(distribuida(PAULISTA))): EstadoLoja => ({ status: 'na-mesa', msg, eventos: [], erro: null, chat: [], salaId: 'r1' });
  const acoes = () => ({ enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() });

  test('"Entendi" guarda a dica como vista; "Sem dicas" desliga todas', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TelaMesa snap={snap()} acoes={acoes()} />);
    expect(screen.getByRole('complementary', { name: 'Dica' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(lerDicas().vistas.length).toBe(1);
    unmount();
    render(<TelaMesa snap={snap()} acoes={acoes()} />);
    const outra = screen.queryByRole('complementary', { name: 'Dica' });
    if (outra) {
      await user.click(screen.getByRole('button', { name: 'Sem dicas' }));
      expect(screen.queryByRole('complementary', { name: 'Dica' })).toBeNull();
    }
    expect(JSON.parse(localStorage.getItem(CHAVE_DICAS)!).vistas.length).toBeGreaterThan(0);
  });
});
