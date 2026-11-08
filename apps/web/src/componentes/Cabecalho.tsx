import type { UsuarioApi } from '@truco/api';
import { useEffect, useId, useRef, useState } from 'react';
import { aplicarTema, lerTema, proximoTema, type Tema, TEMAS } from '../logica/tema';
import { Avatar } from './Avatar';

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
      <BotaoTema />
      <a href="#/como-jogar" className="cabecalho-ajuda" aria-current={aba('manual')} aria-label="Como jogar" title="Como jogar">
        ?
      </a>
    </nav>
  );
}

const rotuloTema = (t: Tema) => TEMAS.find((x) => x.valor === t)!.rotulo;

/** Troca o tema a cada toque: automático (o do aparelho) → claro → escuro. */
function BotaoTema() {
  const [tema, setTema] = useState<Tema>(lerTema);
  const proximo = proximoTema(tema);
  const titulo = `Tema: ${rotuloTema(tema)}. Tocar muda para ${rotuloTema(proximo)}.`;
  return (
    <button
      type="button"
      className="cabecalho-tema"
      aria-label={titulo}
      title={titulo}
      data-tema-atual={tema}
      onClick={() => {
        aplicarTema(proximo);
        setTema(proximo);
      }}
    >
      <IconeTema tema={tema} />
    </button>
  );
}

function IconeTema({ tema }: { tema: Tema }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {tema === 'claro' ? (
        <>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </>
      ) : tema === 'escuro' ? (
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" />
        </>
      )}
    </svg>
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
        <Avatar apelido={usuario.apelido} avatar={usuario.avatar} />
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
          {usuario.admin && (
            <li>
              <a href="#/admin" aria-current={atual('admin')} onClick={fechar}>
                Admin
              </a>
            </li>
          )}
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
