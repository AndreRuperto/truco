// Perfil em abas (Conta, Pontos, Conquistas): padrão de abas da WAI-ARIA, aba vinda da URL.
import type { PerfilApi } from '@truco/api';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { TelaPerfil } from '../src/telas/Perfil';

const RV = { elo: 1000, pontos: 0, patente: 'Bronze', proxima: { nome: 'Prata', faltam: 300 }, partidasRanqueadas: 0, jogos: 0, vitorias: 0, pctTrucoAceito: null, corridas: 0 };
const PERFIL: PerfilApi = {
  usuario: { id: 1, apelido: 'ana' },
  variantes: { paulista: RV, mineiro: RV },
  conquistas: [
    { id: 'primeira-vitoria', nome: 'Primeira vitória', descricao: 'Ganhe uma partida.', alcancada: true, progresso: null },
    { id: 'frequentador', nome: 'Freguês da casa', descricao: 'Termine 10 partidas.', alcancada: false, progresso: { atual: 7, meta: 10 } },
    { id: 'levada', nome: 'Levada', descricao: 'Ganhe 12 a 0.', alcancada: true, progresso: null },
  ],
};
const USUARIO = { id: 1, apelido: 'ana', email: 'ana@x.com', google: false };
const api = () => ({ perfil: vi.fn(async () => PERFIL), trocarApelido: vi.fn(), excluirConta: vi.fn() });

describe('TelaPerfil em abas', () => {
  test('o próprio perfil abre na aba Conta, com as três abas no topo e o resumo das conquistas no rótulo', async () => {
    render(<TelaPerfil id={null} usuario={USUARIO} api={api()} />);
    const lista = await screen.findByRole('tablist', { name: 'Seções do perfil' });
    const abas = within(lista).getAllByRole('tab');
    expect(abas.map((a) => a.textContent)).toEqual(['Conta', 'Pontos', expect.stringMatching(/^Conquistas/)]);
    expect(within(lista).getByRole('tab', { name: 'Conquistas 2 de 3' })).toBeInTheDocument();
    expect(abas[0]).toHaveAttribute('aria-selected', 'true');
    expect(abas[0]).toHaveAttribute('tabindex', '0');
    expect(abas[1]).toHaveAttribute('tabindex', '-1');
    // Painel da Conta: edição, aparência e excluir conta; pontos e conquistas ficam fora da vista.
    const painel = screen.getByRole('tabpanel', { name: 'Conta' });
    expect(within(painel).getByRole('region', { name: 'Editar perfil' })).toBeInTheDocument();
    expect(within(painel).getByRole('button', { name: 'Excluir minha conta…' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Paulista' })).toBeNull();
    expect(screen.queryByRole('region', { name: /Conquistas/ })).toBeNull();
  });

  test('clicar numa aba mostra o painel dela e avisa a troca (para pôr na URL)', async () => {
    const user = userEvent.setup();
    const aoTrocarAba = vi.fn();
    render(<TelaPerfil id={null} usuario={USUARIO} api={api()} aoTrocarAba={aoTrocarAba} />);
    await user.click(await screen.findByRole('tab', { name: 'Pontos' }));
    expect(screen.getByRole('tab', { name: 'Pontos' })).toHaveAttribute('aria-selected', 'true');
    const painel = screen.getByRole('tabpanel', { name: 'Pontos' });
    expect(within(painel).getByRole('region', { name: 'Paulista' })).toBeInTheDocument();
    expect(within(painel).getByRole('region', { name: 'Mineiro' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Editar perfil' })).toBeNull();
    expect(aoTrocarAba).toHaveBeenLastCalledWith('pontos', { substituir: false });

    await user.click(screen.getByRole('tab', { name: /Conquistas/ }));
    expect(within(screen.getByRole('tabpanel', { name: /Conquistas/ })).getAllByRole('listitem')).toHaveLength(3);
    expect(aoTrocarAba).toHaveBeenLastCalledWith('conquistas', { substituir: false });
  });

  test('teclado: setas andam em roda, Home e End vão às pontas; o foco segue a aba escolhida', async () => {
    const user = userEvent.setup();
    const aoTrocarAba = vi.fn();
    render(<TelaPerfil id={null} usuario={USUARIO} api={api()} aoTrocarAba={aoTrocarAba} />);
    const conta = await screen.findByRole('tab', { name: 'Conta' });
    conta.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Pontos' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Pontos' })).toHaveAttribute('aria-selected', 'true');
    // Seta não empilha histórico: troca a entrada atual.
    expect(aoTrocarAba).toHaveBeenLastCalledWith('pontos', { substituir: true });
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Conta' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Conquistas/ })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Conta' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Conquistas/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: /Conquistas/ })).toBeInTheDocument();
  });

  test('a aba vem da URL e acompanha a troca (voltar no navegador)', async () => {
    const a = api();
    const { rerender } = render(<TelaPerfil id={null} usuario={USUARIO} api={a} aba="conquistas" />);
    expect(await screen.findByRole('tab', { name: /Conquistas/ })).toHaveAttribute('aria-selected', 'true');
    rerender(<TelaPerfil id={null} usuario={USUARIO} api={a} aba="pontos" />);
    expect(screen.getByRole('tab', { name: 'Pontos' })).toHaveAttribute('aria-selected', 'true');
    rerender(<TelaPerfil id={null} usuario={USUARIO} api={a} />);
    expect(screen.getByRole('tab', { name: 'Conta' })).toHaveAttribute('aria-selected', 'true');
  });

  test('"Editar perfil" leva à aba Conta mesmo com outra aba pedida', async () => {
    render(<TelaPerfil id={null} editar usuario={USUARIO} api={api()} aba="pontos" />);
    expect(await screen.findByRole('tab', { name: 'Conta' })).toHaveAttribute('aria-selected', 'true');
  });

  test('perfil de outro jogador: sem aba Conta, abre em Pontos', async () => {
    render(<TelaPerfil id={2} api={api()} aba="conta" />);
    const lista = await screen.findByRole('tablist', { name: 'Seções do perfil' });
    expect(within(lista).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Pontos', expect.stringMatching(/^Conquistas/)]);
    expect(screen.getByRole('tab', { name: 'Pontos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Paulista' })).toBeInTheDocument();
  });

  test('sem conquistas na resposta, não há aba de Conquistas', async () => {
    render(<TelaPerfil id={null} usuario={USUARIO} api={{ ...api(), perfil: vi.fn(async () => ({ ...PERFIL, conquistas: undefined })) }} aba="conquistas" />);
    const lista = await screen.findByRole('tablist');
    expect(within(lista).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Conta', 'Pontos']);
    expect(screen.getByRole('tab', { name: 'Conta' })).toHaveAttribute('aria-selected', 'true');
  });
});
