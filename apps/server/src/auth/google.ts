import { OAuth2Client } from 'google-auth-library';

export interface PerfilGoogle {
  sub: string;
  email: string | null;
  emailVerificado: boolean;
  nome: string | null;
}

export type VerificadorGoogle = (credencial: string) => Promise<PerfilGoogle>;

/**
 * Valida o ID token do Google Identity Services (assinatura, `aud` = nosso client ID,
 * expiração). Adaptador fino: os testes usam um verificador falso.
 */
export function verificadorGoogle(clientId: string): VerificadorGoogle {
  const cliente = new OAuth2Client(clientId);
  return async (credencial) => {
    const ticket = await cliente.verifyIdToken({ idToken: credencial, audience: clientId });
    const p = ticket.getPayload();
    if (!p?.sub) throw new Error('token do Google sem sub');
    return { sub: p.sub, email: p.email ?? null, emailVerificado: p.email_verified === true, nome: p.given_name ?? p.name ?? null };
  };
}
