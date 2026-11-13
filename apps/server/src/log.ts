/**
 * Log do servidor (F5.3 do plano MVP): uma linha de JSON por evento (`nivel`, `evento`, `ts` e
 * campos), fácil de filtrar no painel do Railway. Nunca escreve segredo: qualquer chave que pareça
 * token, e-mail, cookie, authorization ou chave de API sai como "[oculto]", em qualquer profundidade.
 * Sem dependência nova.
 */
export type Nivel = 'info' | 'aviso' | 'erro';
type Campos = Record<string, unknown>;

const SENSIVEL = /token|e-?mail|cookie|authorization|api-?key|senha|password|secret/i;
const MAX_PILHA = 2_000;

function limpar(v: unknown, vistos: WeakSet<object>, profundidade: number): unknown {
  if (v instanceof Error) {
    return { mensagem: v.message, nome: v.name, pilha: (v.stack ?? '').slice(0, MAX_PILHA) };
  }
  if (v === null || typeof v !== 'object') return typeof v === 'bigint' ? String(v) : v;
  if (vistos.has(v)) return '[circular]';
  if (profundidade > 6) return '[fundo demais]';
  vistos.add(v);
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => limpar(x, vistos, profundidade + 1));
  if (v instanceof Date) return v.toISOString();
  const out: Campos = {};
  for (const [k, x] of Object.entries(v)) out[k] = SENSIVEL.test(k) ? '[oculto]' : limpar(x, vistos, profundidade + 1);
  return out;
}

/** A linha (sem quebra) que vai para o log. */
export function linhaDeLog(nivel: Nivel, evento: string, campos: Campos = {}, agora = new Date()): string {
  const limpos = limpar(campos, new WeakSet(), 0) as Campos;
  return JSON.stringify({ nivel, evento, ts: agora.toISOString(), ...limpos });
}

export interface Log {
  info(evento: string, campos?: Campos): void;
  aviso(evento: string, campos?: Campos): void;
  /** Aceita campos ou um erro solto (vira `{ erro }`). */
  erro(evento: string, camposOuErro?: Campos | unknown): void;
}

export function criarLog(o: { saida?: (s: string) => void; erro?: (s: string) => void; agora?: () => Date } = {}): Log {
  const saida = o.saida ?? ((s: string) => process.stdout.write(`${s}\n`));
  const erro = o.erro ?? ((s: string) => process.stderr.write(`${s}\n`));
  const agora = o.agora ?? (() => new Date());
  const ehCampos = (x: unknown): x is Campos => !!x && typeof x === 'object' && !(x instanceof Error) && !Array.isArray(x);
  return {
    info: (evento, campos) => saida(linhaDeLog('info', evento, campos, agora())),
    aviso: (evento, campos) => saida(linhaDeLog('aviso', evento, campos, agora())),
    erro: (evento, x) => erro(linhaDeLog('erro', evento, x === undefined ? {} : ehCampos(x) ? x : { erro: x }, agora())),
  };
}

/** O log do processo. */
export const log = criarLog();
