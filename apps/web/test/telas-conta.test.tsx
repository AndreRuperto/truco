import type { PerfilApi } from '@truco/api';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  test('a escolha de tema aparece no próprio perfil e não no de outro jogador', async () => {
    const api = { perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn() };
    const { unmount } = render(<TelaPerfil id={null} api={api} />);
    const grupo = await screen.findByRole('group', { name: 'Tema do site' });
    expect(within(grupo).getAllByRole('button')).toHaveLength(3);
    unmount();

    render(<TelaPerfil id={2} api={api} />);
    await screen.findByRole('heading', { name: 'ana' });
    expect(screen.queryByRole('group', { name: 'Tema do site' })).toBeNull();
  });

  test('editar perfil: e-mail e Google; conectar liga a conta e atualiza o usuário', async () => {
    const usuario = { id: 1, apelido: 'ana', email: 'ana@x.com', google: false };
    const conectarGoogle = vi.fn(async () => ({ usuario: { ...usuario, google: true } }));
    const aoTrocarApelido = vi.fn();
    render(
      <TelaPerfil
        id={null}
        editar
        usuario={usuario}
        googleClientId={null}
        api={{ perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn(), conectarGoogle }}
        aoTrocarApelido={aoTrocarApelido}
      />,
    );
    const bloco = await screen.findByRole('region', { name: 'Editar perfil' });
    expect(bloco).toHaveTextContent('ana@x.com');
    expect(within(bloco).getByTestId('google-status')).toHaveTextContent('Não conectado');
    // Sem Google ligado no servidor, não há botão de conectar.
    expect(within(bloco).queryByText(/Conecte sua conta Google/)).toBeNull();
    await waitFor(() => expect(screen.getByLabelText('Apelido')).toHaveFocus());
  });

  test('com Google ligado no servidor e conta sem Google, oferece conectar; já conectado, não', async () => {
    const usuario = { id: 1, apelido: 'ana', email: 'ana@x.com', google: false };
    const api = { perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn(), conectarGoogle: vi.fn() };
    const { unmount } = render(<TelaPerfil id={null} usuario={usuario} googleClientId="cid" api={api} />);
    expect(await screen.findByText(/Conecte sua conta Google/)).toBeInTheDocument();
    unmount();
    render(<TelaPerfil id={null} usuario={{ ...usuario, google: true }} googleClientId="cid" api={api} />);
    expect(await screen.findByTestId('google-status')).toHaveTextContent('Conectado');
    expect(screen.queryByText(/Conecte sua conta Google/)).toBeNull();
  });

  test('foto de perfil: 10 avatares do site; escolher salva e marca; tirar foto chama com null', async () => {
    const usuario = { id: 1, apelido: 'ana', email: 'ana@x.com', google: false, avatar: null as string | null };
    const trocarAvatar = vi.fn(async (avatar: string | null) => ({ usuario: { ...usuario, avatar } }));
    const aoTrocarApelido = vi.fn();
    const api = { perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn(), trocarAvatar };
    const { rerender } = render(<TelaPerfil id={null} usuario={usuario} api={api} aoTrocarApelido={aoTrocarApelido} />);
    const grupo = await screen.findByRole('group', { name: 'Foto de perfil' });
    expect(within(grupo).getAllByRole('button', { pressed: false })).toHaveLength(10);
    expect(within(grupo).queryByRole('button', { name: 'Tirar foto' })).toBeNull();
    await userEvent.click(within(grupo).getByRole('button', { name: 'Galo' }));
    expect(trocarAvatar).toHaveBeenCalledWith('pronto:galo');
    expect(aoTrocarApelido).toHaveBeenCalledWith(expect.objectContaining({ avatar: 'pronto:galo' }));
    rerender(<TelaPerfil id={null} usuario={{ ...usuario, avatar: 'pronto:galo' }} api={api} aoTrocarApelido={aoTrocarApelido} />);
    expect(within(grupo).getByRole('button', { name: 'Galo' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(grupo).getByRole('button', { name: 'Tirar foto' }));
    expect(trocarAvatar).toHaveBeenLastCalledWith(null);
  });

  test('excluir a conta: explica o que acontece, só libera com o apelido digitado e chama a API (F6.4)', async () => {
    const user = userEvent.setup();
    const usuario = { id: 1, apelido: 'ana', email: 'ana@x.com', google: false };
    const excluirConta = vi.fn(async () => undefined);
    const aoExcluir = vi.fn();
    render(<TelaPerfil id={null} usuario={usuario} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn(), excluirConta }} aoExcluir={aoExcluir} />);
    await user.click(await screen.findByRole('button', { name: 'Excluir minha conta…' }));
    const bloco = screen.getByRole('region', { name: 'Excluir conta' });
    expect(bloco).toHaveTextContent(/e-mail, Google, foto e apelido são apagados/);
    const confirmar = within(bloco).getByRole('button', { name: 'Excluir para sempre' });
    expect(confirmar).toBeDisabled();
    await user.type(within(bloco).getByLabelText(/Digite o seu apelido/), 'an');
    expect(confirmar).toBeDisabled();
    await user.type(within(bloco).getByLabelText(/Digite o seu apelido/), 'a');
    expect(confirmar).toBeEnabled();
    await user.click(confirmar);
    expect(excluirConta).toHaveBeenCalledWith('ana');
    expect(aoExcluir).toHaveBeenCalled();
  });

  test('excluir a conta: erro do servidor aparece e a conta continua', async () => {
    const user = userEvent.setup();
    const usuario = { id: 1, apelido: 'ana', email: 'ana@x.com', google: false };
    const excluirConta = vi.fn(async () => Promise.reject(new ErroApi(500, 'deu ruim')));
    const aoExcluir = vi.fn();
    render(<TelaPerfil id={null} usuario={usuario} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn(), excluirConta }} aoExcluir={aoExcluir} />);
    await user.click(await screen.findByRole('button', { name: 'Excluir minha conta…' }));
    await user.type(screen.getByLabelText(/Digite o seu apelido/), 'ana');
    await user.click(screen.getByRole('button', { name: 'Excluir para sempre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('deu ruim');
    expect(aoExcluir).not.toHaveBeenCalled();
  });

  test('conquistas: as feitas primeiro, contagem e progresso das que faltam', async () => {
    const conquistas = [
      { id: 'frequentador', nome: 'Freguês da casa', descricao: 'Termine 10 partidas.', alcancada: false, progresso: { atual: 7, meta: 10 } },
      { id: 'primeira-vitoria', nome: 'Primeira vitória', descricao: 'Ganhe uma partida.', alcancada: true, progresso: null },
    ];
    render(<TelaPerfil id={null} api={{ perfil: vi.fn(async () => ({ ...PERFIL, conquistas })), trocarApelido: vi.fn() }} />);
    const secao = await screen.findByRole('region', { name: /Conquistas/ });
    expect(secao).toHaveTextContent('1 de 2');
    const itens = within(secao).getAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Primeira vitória');
    expect(itens[0]).toHaveTextContent('conquistada');
    expect(within(itens[1]).getByRole('progressbar', { name: 'Freguês da casa: 7 de 10' })).toBeInTheDocument();
  });

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
    const trocarApelido = vi.fn(async () => ({ usuario: { id: 1, apelido: 'Aninha', email: null, google: false } }));
    const aoTrocarApelido = vi.fn();
    const perfil = vi.fn(async () => PERFIL);
    const { unmount } = render(<TelaPerfil id={null} api={{ perfil, trocarApelido }} aoTrocarApelido={aoTrocarApelido} />);
    const campo = await screen.findByLabelText('Apelido');
    await user.clear(campo);
    await user.type(campo, 'Aninha');
    await user.click(screen.getByRole('button', { name: 'Salvar apelido' }));
    expect(trocarApelido).toHaveBeenCalledWith('Aninha');
    expect(aoTrocarApelido).toHaveBeenCalledWith({ id: 1, apelido: 'Aninha', email: null, google: false });
    expect(perfil).toHaveBeenCalledTimes(2);
    unmount();
    render(<TelaPerfil id={2} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido }} />);
    await screen.findByRole('heading', { name: 'ana' });
    expect(screen.queryByLabelText('Apelido')).toBeNull();
  });

  test('erro de apelido em uso aparece', async () => {
    const user = userEvent.setup();
    render(<TelaPerfil id={null} api={{ perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn(async () => Promise.reject(new ErroApi(409, 'esse apelido já tem dono'))) }} />);
    await user.click(await screen.findByRole('button', { name: 'Salvar apelido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('já tem dono');
  });
});

describe('TelaHistorico', () => {
  test('lista as partidas com resultado e delta', async () => {
    const partidas = [
      { partidaId: 2, variante: 'mineiro', modo: 'ranqueada', ranqueada: true, nos: 12, eles: 8, venceu: true, abandonou: false, deltaElo: 16, eloCongelado: false, iniciadaEm: '2026-11-05T12:00:00Z', terminadaEm: '2026-11-05T12:20:00Z' },
      { partidaId: 1, variante: 'paulista', modo: 'classica', ranqueada: false, nos: 3, eles: 12, venceu: false, abandonou: false, deltaElo: null, eloCongelado: false, iniciadaEm: '2026-11-05T11:00:00Z', terminadaEm: '2026-11-05T11:15:00Z' },
    ] as const;
    render(<TelaHistorico api={{ historico: vi.fn(async () => ({ partidas: [...partidas] })) }} />);
    const itens = await screen.findAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Mineiro · Ranqueada');
    expect(itens[0]).toHaveTextContent('12 × 8');
    expect(itens[0]).toHaveTextContent('Vitória');
    expect(itens[0]).toHaveTextContent('+16');
    expect(itens[1]).toHaveTextContent('Derrota');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Vitórias' }));
    expect(screen.getByRole('button', { name: 'Vitórias' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent('Vitória');
    await userEvent.click(screen.getByRole('button', { name: 'Derrotas' }));
    expect(screen.getByRole('listitem')).toHaveTextContent('Derrota');
  });

  test('ranqueada com Elo congelado: delta 0 e a marca "não contou para o ranking" (F4.9)', async () => {
    const partidas = [
      { partidaId: 9, variante: 'mineiro', modo: 'ranqueada', ranqueada: true, nos: 12, eles: 3, venceu: true, abandonou: false, deltaElo: 0, eloCongelado: true, iniciadaEm: '2026-11-05T12:00:00Z', terminadaEm: '2026-11-05T12:20:00Z' },
    ] as const;
    render(<TelaHistorico api={{ historico: vi.fn(async () => ({ partidas: [...partidas] })) }} />);
    const [item] = await screen.findAllByRole('listitem');
    expect(item).toHaveTextContent('Vitória');
    expect(item).toHaveTextContent('não contou para o ranking');
  });

  test('vazio', async () => {
    render(<TelaHistorico api={{ historico: vi.fn(async () => ({ partidas: [] })) }} />);
    expect(await screen.findByText('Nenhuma partida por aqui ainda')).toBeInTheDocument();
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
    expect(screen.getByRole('region', { name: 'Pódio dos melhores jogadores' })).toHaveTextContent('1016 Elo');
    for (const th of screen.getAllByRole('columnheader')) expect(th).toHaveAttribute('scope', 'col');
  });

  test('vazio: explica o ranking da variante e leva para a fila', async () => {
    render(<TelaRanking variante="paulista" api={{ ranking: vi.fn(async () => ({ linhas: [] })) }} />);
    expect(await screen.findByRole('region', { name: 'O ranking Paulista ainda está em branco' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jogar ranqueada' })).toHaveAttribute('href', '#/fila');
  });
});

describe('Refinamento do pódio', () => {
  test('destaca os três primeiros sem alterar a classificação completa', async () => {
    const linhas = [1, 2, 3, 4].map((posicao) => ({
      posicao, usuarioId: posicao, apelido: `Jogador ${posicao}`,
      pontos: 400 - posicao, elo: 1200 - posicao, patente: 'Prata', partidas: 6,
    }));
    render(<TelaRanking variante="paulista" api={{ ranking: vi.fn(async () => ({ linhas })) }} />);
    const podio = await screen.findByRole('region', { name: 'Pódio dos melhores jogadores' });
    const destaques = within(podio).getAllByRole('listitem');
    expect(destaques).toHaveLength(3);
    expect(destaques.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Jogador 2'),
      expect.stringContaining('Jogador 1'),
      expect.stringContaining('Jogador 3'),
    ]);
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(within(podio).queryByText('Jogador 4')).toBeNull();
  });
});
