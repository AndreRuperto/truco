import type { UsuarioApi } from '@truco/api';

interface Props {
  usuario: UsuarioApi | null;
  aoSair: () => void;
}

export function Cabecalho({ usuario, aoSair }: Props) {
  return (
    <nav className="cabecalho" aria-label="Navegação">
      <a href="#/">Início</a>
      <a href="#/salas">Salas</a>
      <a href="#/ranking/paulista">Ranking</a>
      {usuario ? (
        <>
          <a href="#/perfil">Perfil</a>
          <a href="#/historico">Histórico</a>
          <span className="cabecalho-usuario" data-testid="usuario-logado">
            {usuario.apelido}
          </span>
          <button type="button" onClick={aoSair}>
            Sair da conta
          </button>
        </>
      ) : (
        <a href="#/entrar">Entrar</a>
      )}
    </nav>
  );
}
