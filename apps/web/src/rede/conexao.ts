import type { Room } from '@colyseus/sdk';
import type { OpcoesEntrada } from '../logica/lobby';
import type { Loja, SalaLike } from './loja';
import { urlServidor } from './url';

export const CHAVE_TOKEN = 'truco:reconexao';

/** O mínimo do `Client` do @colyseus/sdk 0.18 que usamos (permite testar sem rede). */
export interface ClienteLike {
  joinOrCreate(nomeSala: string, opcoes: object): Promise<unknown>;
  /** Recebe o `room.reconnectionToken` ("roomId:token"). */
  reconnect(token: string): Promise<unknown>;
}

/** O resto do `Client` do SDK que as mesas privadas, a lista de salas e a fila usam. */
export interface ClienteSala extends ClienteLike {
  create(nomeSala: string, opcoes: object): Promise<unknown>;
  joinById(id: string, opcoes: object): Promise<unknown>;
  consumeSeatReservation(reserva: any): Promise<unknown>;
}

export function lerToken(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function gravarToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(CHAVE_TOKEN, token);
    else sessionStorage.removeItem(CHAVE_TOKEN);
  } catch {
    // storage indisponível: só perde a volta automática ao recarregar
  }
}

// Garantia em tempo de compilação: o `Room` real do SDK satisfaz `SalaLike`.
const _roomEhSala: Room extends SalaLike ? true : never = true;
void _roomEhSala;

let padrao: Promise<ClienteSala> | null = null;

/** Carrega o SDK só quando precisa. O `Room` que ele devolve satisfaz `SalaLike`. */
function clientePadrao(): Promise<ClienteSala> {
  padrao ??= import('@colyseus/sdk').then(({ Client }) => new Client(urlServidor()) as unknown as ClienteSala);
  return padrao;
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Erros de rede do navegador/SDK ("Failed to fetch", "Load failed"...) viram uma frase que quem joga entende. */
const SEM_REDE = /failed to fetch|load failed|networkerror|network error|econnrefused|websocket/i;
const motivo = (e: unknown) => (SEM_REDE.test(mensagem(e)) ? 'o servidor não respondeu. Confira a internet e tente de novo' : mensagem(e));

/** Ignorada se a loja não está no lobby (clique duplo não cria duas salas). */
export async function entrarNaMesa(loja: Loja, opcoes: OpcoesEntrada, cliente?: ClienteLike): Promise<void> {
  if (loja.getSnapshot().status !== 'fora') return;
  loja.marcarConectando();
  try {
    const c = cliente ?? (await clientePadrao());
    loja.conectar((await c.joinOrCreate('mesa', opcoes)) as SalaLike);
  } catch (e) {
    loja.falhouConexao(`Não foi possível entrar na mesa: ${motivo(e)}`);
  }
}

let emAndamento: Promise<boolean> | null = null;

/**
 * Depois de recarregar a página: se há token, volta para a mesma cadeira (o servidor a
 * guarda por 60 s). Quedas de rede sem recarregar o SDK 0.18 já reconecta sozinho.
 * Chamadas simultâneas (o StrictMode roda o efeito duas vezes) compartilham a tentativa.
 * Se a loja já está conectada/conectando (re-render, Fast Refresh), não faz nada: tentar
 * de novo com o token da sala atual falharia e apagaria o token, mandando ao lobby.
 */
export function tentarReconectar(loja: Loja, cliente?: ClienteLike): Promise<boolean> {
  if (emAndamento) return emAndamento;
  const token = lerToken();
  if (!token || loja.getSnapshot().status !== 'fora') return Promise.resolve(false);
  emAndamento = (async () => {
    loja.marcarConectando();
    try {
      const c = cliente ?? (await clientePadrao());
      loja.conectar((await c.reconnect(token)) as SalaLike);
      return true;
    } catch {
      gravarToken(null);
      loja.falhouConexao();
      return false;
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

async function conectarCom(
  loja: Loja,
  abrir: (c: ClienteSala) => Promise<unknown>,
  cliente: ClienteSala | undefined,
  falha: string,
  traduzir: (e: unknown) => string | null = () => null,
): Promise<void> {
  if (loja.getSnapshot().status !== 'fora') return;
  loja.marcarConectando();
  try {
    const c = cliente ?? (await clientePadrao());
    loja.conectar((await abrir(c)) as SalaLike);
  } catch (e) {
    loja.falhouConexao(traduzir(e) ?? `${falha}: ${motivo(e)}`);
  }
}

/** Erros do SDK/servidor ao entrar por id (sala inexistente, trancada, cheia, reserva vencida). */
const MESA_INDISPONIVEL = /not found|locked|full|expired|not available/i;
const traduzirEntrada = (e: unknown) => (MESA_INDISPONIVEL.test(mensagem(e)) ? 'Mesa não encontrada ou já começou.' : null);

/** Mesa casual pública nova: aparece em Salas para os outros entrarem.
 * Diferente de joinOrCreate, nunca coloca o anfitrião numa mesa já existente. */
export const criarMesaAberta = (loja: Loja, opcoes: OpcoesEntrada, cliente?: ClienteSala) =>
  conectarCom(
    loja,
    (c) => c.create('mesa', { ...opcoes, modo: opcoes.nivelBot === 'dificil' ? 'desafio' : 'classica' }),
    cliente,
    'Não foi possível abrir a mesa',
  );

/** Mesa privada nova: não aparece na lista nem no joinOrCreate; o `roomId` é o convite. */
export const criarMesaPrivada = (loja: Loja, opcoes: OpcoesEntrada, cliente?: ClienteSala) =>
  conectarCom(loja, (c) => c.create('mesa', { ...opcoes, modo: 'privada' }), cliente, 'Não foi possível criar a mesa');

/** Mesa por código (link de convite ou lista de salas). */
export const entrarPorCodigo = (loja: Loja, codigo: string, quem: string | { nome: string; avatar?: string | null }, cliente?: ClienteSala) =>
  conectarCom(
    loja,
    (c) => c.joinById(codigo, typeof quem === 'string' ? { nome: quem } : { nome: quem.nome, avatar: quem.avatar ?? null }),
    cliente,
    'Não foi possível entrar na mesa',
    traduzirEntrada,
  );

/**
 * Mesa ranqueada criada pela fila (reserva vinda da mensagem `pareado`). A reserva vence em
 * segundos e o servidor conta quem não aparece: se a loja ainda está noutra mesa (ou
 * conectando), larga esse estado e consome a reserva em vez de descartá-la.
 */
export async function entrarComReserva(loja: Loja, reserva: unknown, cliente?: ClienteSala): Promise<void> {
  if (loja.getSnapshot().status !== 'fora') {
    void loja.sair(); // larga o estado na hora; o leave da antiga não segura a reserva
    if (loja.getSnapshot().status !== 'fora') loja.falhouConexao();
  }
  return conectarCom(loja, (c) => c.consumeSeatReservation(reserva), cliente, 'Não foi possível abrir a mesa ranqueada');
}

/** Sala `fila` (quem cuida dela é a loja da fila). */
export async function abrirFila(opcoes: object, cliente?: ClienteSala): Promise<unknown> {
  const c = cliente ?? (await clientePadrao());
  return c.joinOrCreate('fila', opcoes);
}
