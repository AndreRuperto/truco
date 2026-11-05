import { abrirBanco, type Banco } from './banco/banco';
import { CaixaDeTeste, type Emails, emailsConsole, emailsResend } from './auth/emails';
import { type VerificadorGoogle, verificadorGoogle } from './auth/google';
import { K_PADRAO } from './ranking/elo';

/** Tudo de que HTTP, salas e registro precisam. Os testes montam um com `servicosDeTeste`. */
export interface Servicos {
  banco: Banco;
  emails: Emails;
  caixaTeste: CaixaDeTeste | null;
  google: { clientId: string; verificar: VerificadorGoogle } | null;
  /** Base dos links mágicos; null = origem do pedido (só fora de produção). */
  urlPublica: string | null;
  producao: boolean;
  /** Confiar em X-Forwarded-For/Proto (`trust proxy`): produção ou `TRUCO_TRUST_PROXY`. */
  confiarProxy?: boolean;
  /** Origens extras aceitas no CORS em produção. */
  origens: string[];
  kElo: number;
  bloqueioAbandonoMs: number;
  agora: () => Date;
}

export interface ConfigAmbiente {
  producao: boolean;
  databaseUrl: string | null;
  /** null = PGlite em memória (ou Postgres, se há `databaseUrl`). */
  pastaPglite: string | null;
  resend: { chave: string; remetente: string } | null;
  googleClientId: string | null;
  urlPublica: string | null;
  emailTeste: boolean;
  kElo: number;
  origens: string[];
  confiarProxy: boolean;
  avisos: string[];
}

type Env = Record<string, string | undefined>;

const vazio = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

export function configDoAmbiente(env: Env, padroes: { pastaPglite: string }): ConfigAmbiente {
  const avisos: string[] = [];
  const producao = env.NODE_ENV === 'production';
  const databaseUrl = vazio(env.DATABASE_URL);
  const pg = vazio(env.TRUCO_PGLITE);
  const pastaPglite = databaseUrl || pg === 'memoria' ? null : (pg ?? padroes.pastaPglite);
  if (producao && !databaseUrl) avisos.push('produção sem DATABASE_URL: usando PGlite (dados somem se o disco não for persistente)');

  const railway = vazio(env.RAILWAY_PUBLIC_DOMAIN);
  const urlPublica = (vazio(env.TRUCO_URL_PUBLICA) ?? (railway ? `https://${railway}` : null))?.replace(/\/+$/, '') ?? null;
  // Montar o link mágico a partir do Host do pedido deixaria um atacante mandar e-mails
  // com link para o domínio dele: em produção, sem URL pública, não sobe.
  if (producao && !urlPublica) {
    throw new Error('produção sem URL pública: defina TRUCO_URL_PUBLICA ou RAILWAY_PUBLIC_DOMAIN');
  }
  const tp = vazio(env.TRUCO_TRUST_PROXY);
  const confiarProxy = producao || (tp !== null && tp !== '0' && tp !== 'false');

  const chave = vazio(env.RESEND_API_KEY);
  const resend = chave ? { chave, remetente: vazio(env.TRUCO_EMAIL_REMETENTE) ?? 'Truco <onboarding@resend.dev>' } : null;

  let emailTeste = env.TRUCO_EMAIL_TESTE === '1' || env.NODE_ENV === 'test';
  if (producao && emailTeste) {
    emailTeste = false;
    avisos.push('TRUCO_EMAIL_TESTE ignorada em produção');
  }
  if (producao && !resend && !emailTeste) avisos.push('produção sem RESEND_API_KEY: links mágicos só aparecem no log');

  const k = Number(env.TRUCO_K_ELO);
  const kElo = Number.isInteger(k) && k >= 1 && k <= 100 ? k : K_PADRAO;
  const origens = (env.TRUCO_ORIGENS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    producao,
    databaseUrl,
    pastaPglite,
    resend,
    googleClientId: vazio(env.GOOGLE_CLIENT_ID),
    urlPublica,
    emailTeste,
    kElo,
    origens,
    confiarProxy,
    avisos,
  };
}

export const BLOQUEIO_ABANDONO_MS = 5 * 60_000;

export async function servicosDoAmbiente(
  env: Env,
  padroes: { pastaPglite: string },
): Promise<{ servicos: Servicos; config: ConfigAmbiente; fechar: () => Promise<void> }> {
  const config = configDoAmbiente(env, padroes);
  const conexao = await abrirBanco({ url: config.databaseUrl ?? undefined, pastaPglite: config.pastaPglite ?? undefined });
  const caixa = config.emailTeste ? new CaixaDeTeste() : null;
  const emails = caixa ?? (config.resend ? emailsResend(config.resend) : emailsConsole());
  const google = config.googleClientId ? { clientId: config.googleClientId, verificar: verificadorGoogle(config.googleClientId) } : null;
  return {
    config,
    fechar: conexao.fechar,
    servicos: {
      banco: conexao.db,
      emails,
      caixaTeste: caixa,
      google,
      urlPublica: config.urlPublica,
      producao: config.producao,
      confiarProxy: config.confiarProxy,
      origens: config.origens,
      kElo: config.kElo,
      bloqueioAbandonoMs: BLOQUEIO_ABANDONO_MS,
      agora: () => new Date(),
    },
  };
}

/** Para testes: caixa de teste, sem Google, URL pública fixa. */
export function servicosDeTeste(banco: Banco, extra: Partial<Servicos> = {}): Servicos {
  const caixa = new CaixaDeTeste();
  return {
    banco,
    emails: caixa,
    caixaTeste: caixa,
    google: null,
    urlPublica: 'http://truco.test',
    producao: false,
    origens: [],
    kElo: K_PADRAO,
    bloqueioAbandonoMs: BLOQUEIO_ABANDONO_MS,
    agora: () => new Date(),
    ...extra,
  };
}
