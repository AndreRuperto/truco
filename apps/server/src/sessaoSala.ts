import { COOKIE_SESSAO, lerCookie } from './auth/tokens';
import { usuarioDaSessao } from './repo/usuarios';
import type { Servicos } from './servicos';

/** O que vai em `client.auth` de quem está logado. */
export interface UsuarioConexao {
  usuarioId: number;
  apelido: string;
}

/** Sessão a partir do cookie (navegador) ou do Bearer (`client.auth.token` do SDK). */
export async function usuarioDaConexao(
  s: Servicos | null,
  token: string | null | undefined,
  headers: Headers | undefined,
): Promise<UsuarioConexao | null> {
  if (!s) return null;
  const bruto = lerCookie(headers?.get('cookie'), COOKIE_SESSAO) ?? (token || null);
  if (!bruto) return null;
  const u = await usuarioDaSessao(s.banco, bruto, s.agora());
  return u ? { usuarioId: u.id, apelido: u.apelido } : null;
}
