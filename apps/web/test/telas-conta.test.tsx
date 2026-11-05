import type { PerfilApi } from '@truco/api';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ErroApi } from '../src/rede/api';
import { TelaHistorico } from '../src/telas/Historico';
import { TelaPerfil } from '../src/telas/Perfil';
import { TelaRanking } from '../src/telas/Ranking';

const RV = { elo: 1000, pontos: 0, patente: 'Bronze', proxima: { nome: 'Prata', faltam: 300 }, partidasRanqueadas: 0, jogos: 0, vitorias: 0, pctTrucoAceito: null, corridas: 0 };
const PERFIL: PerfilApi = {
  usuario: { id: 1, apelido: 'ana' },
  variantes: {
    paulista: { ...RV, elo: 1016, pontos: 316, patente: 'Prata', proxima: { nome: 'Ouro', faltam: 284 }, partidasRanqueadas: 3, jogos: 5, vitorias: 4, pctTrucoAceito: 67, corridas: 2 },
    mineiro: RV,
  },
};

describe('TelaPerfil', () => {
  test('mostra patente, pontos, Elo e estatísticas por variante', async () => {
    render(<TelaPerfil id={null} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn() }} />);
    expect(await screen.findByRole('heading', { name: 'ana' })).toBeInTheDocument();
    const paulista = screen.getByRole('region', { name: 'Paulista' });
    expect(within(paulista).getByTestId('elo-paulista')).toHaveTextContent('1016');
    expect(within(paulista).getByTestId('pontos-paulista')).toHaveTextContent('316');
    expect(paulista).toHaveTextContent('Prata');
    expect(paulista).toHaveTextContent('faltam 284 para Ouro');
    expect(paulista).toHaveTextContent('67%');
    expect(within(screen.getByRole('region', { name: 'Mineiro' })).getByText('—')).toBeInTheDocument();
  });

  test('o próprio perfil troca o apelido; o de outro não', async () => {
    const user = userEvent.setup();
    const trocarApelido = vi.fn(async () => ({ usuario: { id: 1, apelido: 'Aninha', email: null } }));
    const aoTrocarApelido = vi.fn();
    const perfil = vi.fn(async () => PERFIL);
    const { unmount } = render(<TelaPerfil id={null} api={{ perfil, trocarApelido }} aoTrocarApelido={aoTrocarApelido} />);
    const campo = await screen.findByLabelText('Apelido');
    await user.clear(campo);
    await user.type(campo, 'Aninha');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(trocarApelido).toHaveBeenCalledWith('Aninha');
    expect(aoTrocarApelido).toHaveBeenCalledWith({ id: 1, apelido: 'Aninha', email: null });
    expect(perfil).toHaveBeenCalledTimes(2);
    unmount();
    render(<TelaPerfil id={2} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido }} />);
    await screen.findByRole('heading', { name: 'ana' });
    expect(screen.queryByLabelText('Apelido')).toBeNull();
  });

  test('erro de apelido em uso aparece', async () => {
    const user = userEvent.setup();
    render(<TelaPerfil id={null} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn(async () => Promise.reject(new ErroApi(409, 'esse apelido já tem dono'))) }} />);
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('já tem dono');
  });
});

describe('TelaHistorico', () => {
  test('lista as partidas com resultado e delta', async () => {
    const partidas = [
      { partidaId: 2, variante: 'mineiro', modo: 'ranqueada', ranqueada: true, nos: 12, eles: 8, venceu: true, abandonou: false, deltaElo: 16, iniciadaEm: '2026-11-05T12:00:00Z', terminadaEm: '2026-11-05T12:20:00Z' },
      { partidaId: 1, variante: 'paulista', modo: 'classica', ranqueada: false, nos: 3, eles: 12, venceu: false, abandonou: false, deltaElo: null, iniciadaEm: '2026-11-05T11:00:00Z', terminadaEm: '2026-11-05T11:15:00Z' },
    ] as const;
    render(<TelaHistorico api={{ historico: vi.fn(async () => ({ partidas: [...partidas] })) }} />);
    const itens = await screen.findAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Mineiro · Ranqueada');
    expect(itens[0]).toHaveTextContent('12 × 8');
    expect(itens[0]).toHaveTextContent('Vitória');
    expect(itens[0]).toHaveTextContent('+16');
    expect(itens[1]).toHaveTextContent('Derrota');
  });

  test('vazio', async () => {
    render(<TelaHistorico api={{ historico: vi.fn(async () => ({ partidas: [] })) }} />);
    expect(await screen.findByText('Nenhuma partida ainda.')).toBeInTheDocument();
  });
});

describe('TelaRanking', () => {
  test('abas por variante e tabela com link para o perfil', async () => {
    const ranking = vi.fn(async () => ({ linhas: [{ posicao: 1, usuarioId: 7, apelido: 'ana', pontos: 316, elo: 1016, patente: 'Prata', partidas: 3 }] }));
    render(<TelaRanking variante="mineiro" api={{ ranking }} />);
    expect(ranking).toHaveBeenCalledWith('mineiro');
    expect(screen.getByRole('link', { name: 'Mineiro' })).toHaveAttribute('aria-current', 'page');
    const link = await screen.findByRole('link', { name: 'ana' });
    expect(link).toHaveAttribute('href', '#/perfil/7');
    expect(screen.getByRole('row', { name: /ana/ })).toHaveTextContent('Prata');
    expect(screen.getByRole('table', { name: 'Ranking Mineiro' })).toBeInTheDocument();
    for (const th of screen.getAllByRole('columnheader')) expect(th).toHaveAttribute('scope', 'col');
  });

  test('vazio: explica o ranking da variante e leva para a fila', async () => {
    render(<TelaRanking variante="paulista" api={{ ranking: vi.fn(async () => ({ linhas: [] })) }} />);
    expect(await screen.findByRole('region', { name: 'O ranking Paulista ainda está em branco' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jogar ranqueada' })).toHaveAttribute('href', '#/fila');
  });
});
