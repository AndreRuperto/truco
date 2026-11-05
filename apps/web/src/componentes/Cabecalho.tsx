import type { UsuarioApi } from '@truco/api';

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
        <>
          <a href="#/perfil" aria-current={aba('perfil')}>Perfil</a>
          <a href="#/historico" aria-current={aba('historico')}>Histórico</a>
          <span className="cabecalho-usuario" data-testid="usuario-logado">
            {usuario.apelido}
          </span>
          <button type="button" onClick={aoSair}>
            Sair da conta
          </button>
        </>
      ) : (
        <a href="#/entrar" aria-current={aba('entrar')}>Entrar</a>
      )}
    </nav>
  );
}
