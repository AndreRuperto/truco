import { COOKIE_SESSAO, lerCookie } from './auth/tokens';
import { usuarioDaSessao } from './repo/usuarios';
import type { Servicos } from './servicos';

/** O que vai em `client.auth` de quem está logado. */
export interface UsuarioConexao {
  usuarioId: number;
  apelido: string;
  avatar?: string | null;
}

/** Sessão a partir do cookie (navegador) ou do Bearer (`client.auth.token` do SDK). */
export async function usuarioDaConexao(
  s: Servicos | null,
  token: string | null | undefined,
  headers: Headers | undefined,
): Promise<UsuarioConexao | null> {
  if (!s) return null;
  // Tenta o cookie e depois o Bearer: um cookie vencido não pode esconder um Bearer válido.
  const candidatos = [lerCookie(headers?.get('cookie'), COOKIE_SESSAO), token || null];
  for (const bruto of new Set(candidatos)) {
    if (!bruto) continue;
    const u = await usuarioDaSessao(s.banco, bruto, s.agora());
    if (u) return { usuarioId: u.id, apelido: u.apelido, avatar: u.avatar };
  }
  return null;
}
