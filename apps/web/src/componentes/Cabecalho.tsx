import type { UsuarioApi } from '@truco/api';
import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  /** A sessão já respondeu; antes disso a área da conta fica escondida (sem "Entrar" piscando). */
  pronta: boolean;
  usuario: UsuarioApi | null;
  aoSair: () => void;
  /** Tela atual (`Rota['tela']`): a aba dela fica marcada com aria-current. */
  atual?: string;
}

export function Cabecalho({ pronta, usuario, aoSair, atual }: Props) {
  const aba = (tela: string) => (tela === atual ? ('page' as const) : undefined);
  return (
    <nav className="cabecalho" aria-label="Navegação">
      <a href="#/" aria-current={aba('inicio')}>Início</a>
      <a href="#/salas" aria-current={aba('salas')}>Salas</a>
      <a href="#/ranking/paulista" aria-current={aba('ranking')}>Ranking</a>
      {!pronta ? null : usuario ? (
        <MenuConta usuario={usuario} aoSair={aoSair} atual={aba} />
      ) : (
        <a href="#/entrar" aria-current={aba('entrar')}>Entrar</a>
      )}
      <a href="#/como-jogar" className="cabecalho-ajuda" aria-current={aba('manual')} aria-label="Como jogar" title="Como jogar">
        ?
      </a>
    </nav>
  );
}

/** Botão com o apelido que abre a lista da conta (padrão "disclosure": Esc e clique fora fecham). */
function MenuConta({ usuario, aoSair, atual }: { usuario: UsuarioApi; aoSair: () => void; atual: (t: string) => 'page' | undefined }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);
  const fechar = () => setAberto(false);
  return (
    <div className="menu-conta" ref={raiz}>
      <button
        ref={botao}
        type="button"
        className="menu-conta-botao"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        data-testid="usuario-logado"
      >
        <span className="avatar" aria-hidden="true">
          {usuario.apelido.slice(0, 1).toUpperCase()}
        </span>
        <span className="menu-conta-nome">{usuario.apelido}</span>
        <span className="menu-conta-seta" aria-hidden="true" />
      </button>
      {aberto && (
        <ul className="menu-conta-lista" id={id}>
          <li>
            <a href="#/perfil" aria-current={atual('perfil')} onClick={fechar}>
              Meu perfil
            </a>
          </li>
          <li>
            <a href="#/perfil?editar" onClick={fechar}>
              Editar perfil
            </a>
          </li>
          <li>
            <a href="#/historico" aria-current={atual('historico')} onClick={fechar}>
              Histórico
            </a>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                fechar();
                aoSair();
              }}
            >
              Sair da conta
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
