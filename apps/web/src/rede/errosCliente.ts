/**
 * Erros do navegador para o log do operador (F5.3 do plano MVP): `POST /api/erro-cliente` com só
 * mensagem, pilha curta, rota SEM query (o link mágico tem `?token=`) e a versão do build. Sem dado
 * de usuário. No máximo 5 por página e sem repetir a mesma mensagem; falhar ao enviar não faz nada.
 */
export interface RelatoErro {
  mensagem: string;
  pilha: string;
  rota: string;
  versao: string;
}

interface Opcoes {
  enviar?: (corpo: RelatoErro) => void;
  versao?: () => string;
}

const MAXIMO = 5;

/** Nome do bundle principal (ex.: index-Ab12Cd.js): identifica o deploy sem expor nada. */
function versaoDoBuild(): string {
  const s = document.querySelector<HTMLScriptElement>('script[src*="/assets/index-"]')?.src ?? '';
  return s.split('/').pop()?.replace(/\.js$/, '') ?? 'dev';
}

function enviarPelaRede(corpo: RelatoErro): void {
  void fetch('/api/erro-cliente', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
    keepalive: true,
  }).catch(() => {});
}

/** Instala os ouvintes; devolve a função que tira. */
export function instalarRelatorioDeErros(o: Opcoes = {}): () => void {
  const enviar = o.enviar ?? enviarPelaRede;
  const versao = o.versao ?? versaoDoBuild;
  const vistos = new Set<string>();
  const relatar = (motivo: unknown, mensagemDoEvento?: string) => {
    try {
      const erro = motivo instanceof Error ? motivo : null;
      const mensagem = (erro?.message ?? mensagemDoEvento ?? String(motivo ?? 'erro')).slice(0, 300);
      if (vistos.has(mensagem) || vistos.size >= MAXIMO) return;
      vistos.add(mensagem);
      enviar({ mensagem, pilha: (erro?.stack ?? '').slice(0, 1_000), rota: window.location.hash.split('?')[0].slice(0, 100), versao: versao().slice(0, 40) });
    } catch {
      // relatar nunca pode virar outro erro
    }
  };
  const aoErro = (e: ErrorEvent) => relatar(e.error, e.message);
  const aoRejeitar = (e: Event) => relatar((e as Event & { reason?: unknown }).reason);
  window.addEventListener('error', aoErro);
  window.addEventListener('unhandledrejection', aoRejeitar);
  return () => {
    window.removeEventListener('error', aoErro);
    window.removeEventListener('unhandledrejection', aoRejeitar);
  };
}
