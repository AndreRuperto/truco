import { acoesValidas, reduce, visaoDoJogador } from '@truco/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BarraAcoes } from '../src/componentes/BarraAcoes';
import { FimDePartida } from '../src/componentes/Overlays';
import { Placar } from '../src/componentes/Placar';
import { SeletorAparenciaMesa } from '../src/componentes/SeletorAparenciaMesa';
import { agruparAcoes } from '../src/logica/acoes';
import { distribuida, naSegundaRodada, PAULISTA } from './fixtures';

describe('refinamento visual do jogo', () => {
  test('placar reúne pontuação, valor e situação sem mudar o rótulo acessível', () => {
    render(<Placar nos={6} eles={3} valor={3} pedido="Pediram Truco!" situacao="Aguardando jogada" />);
    const placar = screen.getByRole('group', { name: 'Placar: Nós 6, Eles 3, mão vale 3, Pediram Truco!' });
    expect(placar).toHaveTextContent('Mão vale 3');
    expect(placar).toHaveTextContent('Aguardando jogada');
    expect(placar.querySelector('.placar-situacao')).not.toBeNull();
  });

  test('a única ação recebe destaque sem mudar seu comando', async () => {
    const user = userEvent.setup();
    const estado = reduce(naSegundaRodada(distribuida(PAULISTA)), { tipo: 'truco', cadeira: 0 });
    const botoes = agruparAcoes(acoesValidas(estado, 1), visaoDoJogador(estado, 1)).botoes;
    const aoEscolher = vi.fn();
    render(<BarraAcoes botoes={[botoes[0]]} pedido={null} aoEscolher={aoEscolher} />);

    const acao = screen.getByRole('button');
    expect(acao).toHaveClass('acao-destaque');
    await user.click(acao);
    expect(aoEscolher).toHaveBeenCalledWith(botoes[0].acao);
  });

  test('ações alternativas ficam igualmente visíveis sem favoritismo visual', () => {
    const estado = reduce(naSegundaRodada(distribuida(PAULISTA)), { tipo: 'truco', cadeira: 0 });
    const botoes = agruparAcoes(acoesValidas(estado, 1), visaoDoJogador(estado, 1)).botoes;
    const { container } = render(<BarraAcoes botoes={botoes} pedido={null} aoEscolher={vi.fn()} />);
    expect(botoes.length).toBeGreaterThan(1);
    expect(container.querySelectorAll('.acao-destaque')).toHaveLength(0);
  });

  test('tela de vitória apresenta medalha e mantém ações de revanche e retorno', async () => {
    const user = userEvent.setup();
    const aoJogarDeNovo = vi.fn();
    const aoVoltar = vi.fn();
    render(<FimDePartida titulo="Vitória!" placar="Nós 12 × 4 Eles" venceu aoJogarDeNovo={aoJogarDeNovo} aoVoltar={aoVoltar} />);

    const modal = screen.getByRole('dialog', { name: 'Vitória!' });
    expect(modal).toHaveTextContent('Nós 12 × 4 Eles');
    expect(modal).toHaveTextContent('Vitória da sua dupla');
    expect(modal.querySelector('.resultado-decoracao')).toHaveAttribute('aria-hidden', 'true');
    await user.click(screen.getByRole('button', { name: 'Jogar de novo' }));
    expect(aoJogarDeNovo).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Voltar ao início' }));
    expect(aoVoltar).toHaveBeenCalledOnce();
  });

  test('tela de derrota não mostra estrelas de vitória nem inventa mudanças de Elo', () => {
    render(<FimDePartida titulo="Derrota" placar="Nós 5 × 12 Eles" venceu={false} aoVoltar={vi.fn()} />);
    const modal = screen.getByRole('dialog', { name: 'Derrota' });
    expect(modal.querySelector('.resultado-partida.derrota')).not.toBeNull();
    expect(modal).toHaveTextContent('Partida encerrada');
    expect(modal).not.toHaveTextContent(/Elo [+-]/);
  });

  test('catálogo destaca visualmente a mesa escolhida sem desbloquear itens pagos', async () => {
    const user = userEvent.setup();
    const aoEscolher = vi.fn();
    render(<SeletorAparenciaMesa valor="feltro" temConta={true} aoEscolher={aoEscolher} aoFechar={vi.fn()} />);

    const preview = document.querySelector('.personalizar-mesa-preview');
    expect(preview).toHaveClass('amostra-feltro');
    const feltro = screen.getByRole('button', { name: /Feltro de clube/ });
    expect(feltro).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /Madeira de boteco/ }));
    expect(aoEscolher).toHaveBeenCalledWith('madeira');
  });
});
