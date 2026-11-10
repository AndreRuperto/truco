/**
 * Pedaços de código carregados sob demanda (SDK do Colyseus, vista 3D) têm hash no nome. Uma aba
 * aberta antes de um deploy pede o hash antigo, que o servidor novo já não tem, e o `import()`
 * falha. Com internet, a saída é recarregar uma vez: o index.html (sempre buscado na rede pelo
 * service worker) aponta para os pedaços novos. Se o jogador estava numa mesa, o token de
 * reconexão o devolve à cadeira.
 */

/** Mensagens do `import()` quando o arquivo não veio: Chromium, Safari e Firefox. */
const CHUNK_AUSENTE = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i;

const CHAVE_RECARGA = 'truco:recarregou-por-atualizacao';
/** Avisar na próxima abertura da página; consumida ao ler. */
const CHAVE_AVISO = 'truco:avisar-atualizacao';
/** Uma recarga por minuto, no máximo: se o pedaço continua faltando, o erro vai para quem chamou. */
const JANELA_MS = 60_000;

interface Armazenamento {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface AmbienteRecarga {
  recarregar: () => void;
  online: () => boolean;
  agora: () => number;
  armazenamento: Armazenamento | null;
}

function ambientePadrao(): AmbienteRecarga {
  let armazenamento: Armazenamento | null = null;
  try {
    armazenamento = sessionStorage;
  } catch {
    // sem storage: sem trava contra loop, então não recarrega
  }
  return { recarregar: () => location.reload(), online: () => navigator.onLine, agora: Date.now, armazenamento };
}

export function ehChunkAusente(e: unknown): boolean {
  return CHUNK_AUSENTE.test(e instanceof Error ? e.message : String(e));
}

/**
 * Importa um módulo sob demanda. Se o arquivo sumiu por causa de um deploy (e há internet),
 * recarrega a página uma vez; a promessa fica pendente, porque a página vai embora.
 */
export async function importarComRecarga<T>(carregar: () => Promise<T>, amb: AmbienteRecarga = ambientePadrao()): Promise<T> {
  try {
    return await carregar();
  } catch (e) {
    const s = amb.armazenamento;
    if (!ehChunkAusente(e) || !amb.online() || !s) throw e;
    const ultima = Number(s.getItem(CHAVE_RECARGA) ?? 0);
    if (amb.agora() - ultima < JANELA_MS) throw e;
    s.setItem(CHAVE_RECARGA, String(amb.agora()));
    s.setItem(CHAVE_AVISO, '1');
    amb.recarregar();
    return new Promise<T>(() => {});
  }
}

/**
 * Na abertura da página: se ela veio de uma dessas recargas, a frase para avisar (uma vez).
 * Neutra de propósito: a recarga também acontece quando o import() falhou sem internet e a rede
 * voltou, porque o navegador guarda a falha daquele arquivo enquanto a página estiver aberta.
 */
export function avisoDeAtualizacao(s: Armazenamento | null = ambientePadrao().armazenamento): string | null {
  if (!s?.getItem(CHAVE_AVISO)) return null;
  s.removeItem(CHAVE_AVISO);
  return 'Recarregamos a página para terminar de carregar o Truco. Tente de novo.';
}
