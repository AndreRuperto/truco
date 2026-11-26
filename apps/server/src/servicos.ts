import { abrirBanco, type Banco } from './banco/banco';
import { CaixaDeTeste, type Emails, emailsConsole, emailsResend } from './auth/emails';
import { type VerificadorGoogle, verificadorGoogle } from './auth/google';
import { type GatewayPagamento, gatewayInfinitePay, gatewaySimulado } from './pagamento/infinitepay';
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
  /** E-mails (minúsculos) de quem é admin (`ADMIN_EMAILS`). */
  admins?: readonly string[];
  kElo: number;
  bloqueioAbandonoMs: number;
  agora: () => Date;
  /** Compra de Pila. null/ausente = desligada (a loja mostra "em breve"). */
  pagamento?: { gateway: GatewayPagamento } | null;
  /** Só para testes: sobrepõe `COMPRA_PILA_ABERTA` (loja/compraPila.ts). Ausente = a constante. */
  compraPilaAberta?: boolean;
}

/**
 * `LOJA_PAGAMENTO`: `on` = InfinitePay de verdade (exige `INFINITEPAY_HANDLE`); `simulado` = o
 * checkout volta pago na hora (só fora de produção: E2E e desenvolvimento); outro = desligado.
 */
export type ModoPagamento = 'desligado' | 'infinitepay' | 'simulado';

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
  admins: string[];
  confiarProxy: boolean;
  pagamento: { modo: ModoPagamento; handle: string | null; apiKey: string | null };
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
  if (producao && !resend && !emailTeste) avisos.push('produção sem RESEND_API_KEY: o login por e-mail não funciona (o link não é enviado nem registrado no log)');

  const k = Number(env.TRUCO_K_ELO);
  const kElo = Number.isInteger(k) && k >= 1 && k <= 100 ? k : K_PADRAO;
  const origens = (env.TRUCO_ORIGENS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const admins = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const handle = vazio(env.INFINITEPAY_HANDLE)?.replace(/^\$/, '') ?? null;
  const pedidoPagamento = vazio(env.LOJA_PAGAMENTO);
  let modoPagamento: ModoPagamento = 'desligado';
  if (pedidoPagamento === 'on') {
    if (handle) modoPagamento = 'infinitepay';
    else avisos.push('LOJA_PAGAMENTO=on sem INFINITEPAY_HANDLE: compra de Pila desligada');
  } else if (pedidoPagamento === 'simulado') {
    if (producao) avisos.push('LOJA_PAGAMENTO=simulado ignorado em produção');
    else modoPagamento = 'simulado';
  }

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
    admins,
    confiarProxy,
    pagamento: { modo: modoPagamento, handle, apiKey: vazio(env.INFINITEPAY_API_KEY) },
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
  const emails = caixa ?? (config.resend ? emailsResend(config.resend) : emailsConsole(console.log, { omitirLink: config.producao }));
  const google = config.googleClientId ? { clientId: config.googleClientId, verificar: verificadorGoogle(config.googleClientId) } : null;
  const pg = config.pagamento;
  const pagamento =
    pg.modo === 'infinitepay' && pg.handle
      ? { gateway: gatewayInfinitePay({ handle: pg.handle, apiKey: pg.apiKey }) }
      : pg.modo === 'simulado'
        ? { gateway: gatewaySimulado() }
        : null;
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
      admins: config.admins,
      kElo: config.kElo,
      bloqueioAbandonoMs: BLOQUEIO_ABANDONO_MS,
      agora: () => new Date(),
      pagamento,
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
