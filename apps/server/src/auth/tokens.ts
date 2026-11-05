import { createHash, randomBytes } from 'node:crypto';

/** 32 bytes aleatórios em base64url (43 caracteres). */
export const gerarToken = (): string => randomBytes(32).toString('base64url');

/** O banco guarda só isto: quem ler o banco não consegue se passar pelo usuário. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const COOKIE_SESSAO = 'truco_sessao';

export function lerCookie(cabecalho: string | null | undefined, nome: string): string | null {
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0 || parte.slice(0, i).trim() !== nome) continue;
    try {
      return decodeURIComponent(parte.slice(i + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function bearer(cabecalho: string | null | undefined): string | null {
  const m = cabecalho?.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

const BASE_COOKIE = `Path=/; HttpOnly; SameSite=Lax`;

export function cookieSessao(token: string, o: { seguro: boolean; maxAgeS: number }): string {
  return `${COOKIE_SESSAO}=${encodeURIComponent(token)}; ${BASE_COOKIE}; Max-Age=${o.maxAgeS}${o.seguro ? '; Secure' : ''}`;
}

export function cookieApagado(seguro: boolean): string {
  return `${COOKIE_SESSAO}=; ${BASE_COOKIE}; Max-Age=0${seguro ? '; Secure' : ''}`;
}
