import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InfoCadeira } from '@truco/protocolo';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SeletorAvatar } from '../src/componentes/SeletorAvatar';
import { CHAVE_AVATAR, gravarAvatarLocal, lerAvatarLocal } from '../src/logica/lobby';
import { Lobby } from '../src/telas/Lobby';
import { SalaEspera } from '../src/telas/SalaEspera';
import { msgEstado } from './fixtures';

beforeEach(() => localStorage.clear());

describe('foto ao lado do apelido', () => {
  test('abre os 10 ícones; escolher manda pronto:<id> e fecha; "Sem foto" só com foto', async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    const { rerender } = render(<SeletorAvatar apelido="Dedé" valor={null} aoMudar={aoMudar} />);
    const botao = screen.getByRole('button', { name: 'Escolher foto' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    await user.click(botao);
    const painel = screen.getByRole('group', { name: 'Foto' });
    expect(within(painel).getAllByRole('button', { pressed: false })).toHaveLength(10);
    expect(within(painel).queryByRole('button', { name: 'Sem foto' })).toBeNull();
    await user.click(within(painel).getByRole('button', { name: 'Chope' }));
    expect(aoMudar).toHaveBeenCalledWith('pronto:chope');
    expect(screen.queryByRole('group', { name: 'Foto' })).toBeNull();
    rerender(<SeletorAvatar apelido="Dedé" valor="pronto:chope" aoMudar={aoMudar} />);
    await user.click(botao);
    expect(screen.getByRole('button', { name: 'Chope' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Sem foto' }));
    expect(aoMudar).toHaveBeenLastCalledWith(null);
  });

  test('a tela inicial mostra o seletor junto do apelido', () => {
    render(<Lobby aoJogar={() => {}} avatar="pronto:galo" aoTrocarAvatar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Escolher foto' })).toBeInTheDocument();
    expect(screen.getByLabelText('Apelido')).toBeInTheDocument();
  });

  test('sem conta, a foto fica no aparelho (e lixo no storage é ignorado)', () => {
    gravarAvatarLocal('pronto:lua');
    expect(lerAvatarLocal()).toBe('pronto:lua');
    localStorage.setItem(CHAVE_AVATAR, 'javascript:alert(1)');
    expect(lerAvatarLocal()).toBeNull();
    gravarAvatarLocal(null);
    expect(localStorage.getItem(CHAVE_AVATAR)).toBeNull();
  });
});

describe('fotos na sala de espera', () => {
  test('cada um aparece com a foto; sem foto, a inicial; lugar vago sem nada', () => {
    const cadeiras: InfoCadeira[] = [
      { tipo: 'humano', nome: 'Dedé', conectado: true, avatar: 'pronto:galo' },
      { tipo: 'vazia', nome: null, conectado: false },
      { tipo: 'humano', nome: 'Zeca', conectado: true, avatar: null },
      { tipo: 'vazia', nome: null, conectado: false },
    ];
    const { container } = render(<SalaEspera msg={msgEstado(null, 0, { cadeiras, humanosEsperados: 4, modo: 'privada' })} aoIniciar={() => {}} aoSair={() => {}} />);
    const linhas = container.querySelectorAll('.lista-cadeiras li');
    expect(linhas[0].querySelector('.avatar-pronto svg')).not.toBeNull();
    expect(linhas[1].querySelector('.avatar')).toBeNull();
    expect(linhas[2].querySelector('.avatar')).toHaveTextContent('Z');
  });
});
