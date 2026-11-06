import { type AuthContext, type Client, ErrorCode, Room, type RoomException, type RoomMethodName, ServerError } from '@colyseus/core';
import type { Cadeira } from '@truco/engine';
import { randomInt, randomUUID } from 'node:crypto';
import { Mesa, type Tempos } from './mesa/Mesa';
import { filtroDaSala, limparNome, opcoesDaSala, SAIDA_PARTIDA_CANCELADA } from './mesa/protocolo';
import { RegistroMesa } from './registroMesa';
import { avatarValido } from './repo/usuarios';
import type { Servicos } from './servicos';
import { type UsuarioConexao, usuarioDaConexao } from './sessaoSala';

const randCripto = () => randomInt(0, 2 ** 32) / 2 ** 32;

/** Quem a fila reservou para uma mesa ranqueada, e onde senta. */
export interface JogadorReservado {
  usuarioId: number;
  cadeira: Cadeira;
}

/** Métodos do controller do Colyseus 0.18 que chamam `onAuth` (`reconnect` não chama). */
const METODOS_MATCHMAKE = new Set(['create', 'joinOrCreate', 'join', 'joinById']);

/**
 * Método do matchmaking (`create`, `joinOrCreate`...) do pedido HTTP; '' se o pedido existe
 * mas a URL não diz o método; null se não há pedido.
 *
 * Premissa: no Colyseus 0.18 todo `onAuth` vindo de cliente passa pela rota HTTP
 * `/matchmake/<método>/<sala>` e traz `context.req`; sem `req` só as chamadas internas do
 * próprio servidor (`matchMaker.createRoom/joinById` da fila e dos testes). Se uma versão
 * futura chamar `onAuth` de cliente sem `req`, esta checagem precisa ser revista.
 */
function metodoDoPedido(context: AuthContext | undefined): string | null {
  const req: unknown = context?.req;
  if (!req) return null;
  const url: unknown = (req as { url?: unknown }).url;
  if (typeof url !== 'string') return '';
  try {
    return new URL(url, 'http://x').pathname.match(/\/matchmake\/([^/]+)\//)?.[1] ?? '';
  } catch {
    return '';
  }
}

function jogadoresReservados(cru: unknown): JogadorReservado[] {
  if (!Array.isArray(cru)) return [];
  return cru.filter((j): j is JogadorReservado => {
    const x = j as Partial<JogadorReservado> | null;
    return !!x && Number.isInteger(x.usuarioId) && [0, 1, 2, 3].includes(x.cadeira as number);
  });
}

export class MesaRoom extends Room {
  /** Sobrescrito nos testes para acelerar. */
  static tempos: Partial<Tempos> = {};
  /** Banco, e-mail etc. (`criarServidor` define). null = sem gravação nem login. */
  static servicos: Servicos | null = null;
  /** Só a fila conhece: impede cliente de criar mesa ranqueada. */
  static readonly fichaInterna = randomUUID();
  /** Ranqueada que não lota nesse tempo é cancelada. */
  static esperaRanqueadaMs = 30_000;
  /** Registros de salas vivas ou descartadas com gravação pendente (o desligamento espera). */
  private static readonly registrosVivos = new Set<RegistroMesa>();

  /** Conta → mesa ranqueada viva em que tem lugar (reservado ou sentado, partida sem fim). */
  private static readonly contasEmRanqueada = new Map<number, string>();

  /** Mesas ranqueadas vivas cuja partida já começou. */
  private static readonly ranqueadasIniciadas = new Set<string>();

  /** A conta foi pareada e a mesa dela ainda não acabou (a fila recusa a conta). */
  static emRanqueada(usuarioId: number): boolean {
    return MesaRoom.contasEmRanqueada.has(usuarioId);
  }

  /**
   * Onde está a conta pareada: `reservada` = a mesa espera todos sentarem (começa ou é
   * cancelada em segundos); `jogando` = a partida começou; null = livre.
   */
  static situacaoRanqueada(usuarioId: number): 'reservada' | 'jogando' | null {
    const sala = MesaRoom.contasEmRanqueada.get(usuarioId);
    if (sala === undefined) return null;
    return MesaRoom.ranqueadasIniciadas.has(sala) ? 'jogando' : 'reservada';
  }

  private liberarConta(usuarioId: number): void {
    if (MesaRoom.contasEmRanqueada.get(usuarioId) === this.roomId) MesaRoom.contasEmRanqueada.delete(usuarioId);
  }

  private liberarReservados(): void {
    for (const r of this.reservados ?? []) this.liberarConta(r.usuarioId);
  }

  /** Espera as gravações de todas as mesas (desligamento: antes de fechar o banco). */
  static async esperarGravacoes(): Promise<void> {
    while (MesaRoom.registrosVivos.size > 0) {
      const n = MesaRoom.registrosVivos.size;
      await Promise.all([...MesaRoom.registrosVivos].map((r) => r.ocioso()));
      // Sala viva continua no conjunto: não espera por ela para sempre.
      if (MesaRoom.registrosVivos.size >= n) return;
    }
  }

  /**
   * Desligamento do servidor (SIGTERM/redeploy), antes de o Colyseus derrubar as conexões:
   * nenhuma mesa pune as quedas que vêm a seguir; partidas em andamento fecham como
   * abandonadas, sem Elo nem bloqueio.
   */
  static desligar(): void {
    for (const r of MesaRoom.registrosVivos) r.desligar();
  }

  private mesa!: Mesa;
  private registro!: RegistroMesa;
  private reservados: JogadorReservado[] | null = null;
  /** Ranqueada que não lotou a tempo e está sendo descartada. */
  private cancelada = false;

  /**
   * Roda no pedido HTTP de matchmaking, ANTES de o Colyseus procurar sala, e recebe o
   * MESMO objeto de opções que vai para o filtro e para `createRoom`: reescreve nele os
   * campos do `filterBy` com os valores validados (quem omite um campo procura a sala
   * padrão, não "qualquer sala") e apaga campos que só a fila pode mandar. Devolve o
   * usuário logado (vira `client.auth`) ou `true` (convidado). Opções que não são objeto
   * (texto, número, null) não têm onde receber o filtro (o Colyseus filtraria por nada e
   * casaria com qualquer sala): recusadas.
   */
  static async onAuth(token: string, options: unknown, context: AuthContext): Promise<unknown> {
    if (!options || typeof options !== 'object') throw new ServerError(ErrorCode.MATCHMAKE_INVALID_CRITERIA, 'opções da sala inválidas');
    const o = options as Record<string, unknown>;
    if (o.modo === 'ranqueada') throw new ServerError(ErrorCode.AUTH_FAILED, 'mesa ranqueada só pela fila');
    // `context.req` é o pedido HTTP de matchmaking (`/matchmake/<método>/<sala>`); chamadas
    // internas não o têm e passam. Pedido com método desconhecido: recusado.
    const metodo = metodoDoPedido(context);
    if (metodo !== null && !METODOS_MATCHMAKE.has(metodo)) {
      throw new ServerError(ErrorCode.MATCHMAKE_UNHANDLED, 'método de matchmaking desconhecido');
    }
    // Privada nasce por `create` e se entra por `joinById`.
    if (o.modo === 'privada' && (metodo === 'join' || metodo === 'joinOrCreate')) {
      throw new ServerError(ErrorCode.MATCHMAKE_INVALID_CRITERIA, 'mesa privada: crie uma ou entre pelo código do convite');
    }
    delete o.fichaInterna;
    delete o.jogadores;
    Object.assign(o, filtroDaSala(opcoesDaSala(o)));
    const u = await usuarioDaConexao(MesaRoom.servicos, token, context.headers);
    // Logado aparece com o apelido da conta em todo lugar (assento, gravação e `dono` da
    // lista de salas, que o onCreate tira destas opções), nunca com o `nome` do cliente.
    if (u) o.nome = u.apelido;
    return u ?? true;
  }

  onCreate(options: unknown) {
    const cru = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
    const opcoes = opcoesDaSala(cru);
    const { modo, regras, humanos, nivelBot, chanceInterceptarSinal, tempoFamiliaS } = opcoes;
    if (modo === 'ranqueada') {
      if (cru.fichaInterna !== MesaRoom.fichaInterna) throw new Error('mesa ranqueada só pela fila');
      this.reservados = jogadoresReservados(cru.jogadores);
      if (this.reservados.length !== humanos) throw new Error('reservas não batem com a quantidade de humanos');
      for (const r of this.reservados) MesaRoom.contasEmRanqueada.set(r.usuarioId, this.roomId);
      // Reserva não sobrevive à espera: uma pendente seguraria o descarte da mesa cancelada.
      this.seatReservationTimeout = Math.min(this.seatReservationTimeout, MesaRoom.esperaRanqueadaMs / 1000);
    }
    this.maxClients = humanos;
    // O Colyseus 0.18 copia os campos do `filterBy` das opções cruas de criação para
    // `metadata`, e o `joinOrCreate` compara com `metadata`: trocar pelos valores
    // validados (o `setMetadata` substitui, não mescla). `regras`/`dono` são para a lista.
    void this.setMetadata({ ...filtroDaSala(opcoes), regras, dono: modo === 'ranqueada' ? null : limparNome(cru.nome) });
    if (modo === 'privada' || modo === 'ranqueada') void this.setPrivate(true);
    // Acima disso o Colyseus derruba o cliente (sinais/falas/chat já têm limite próprio na Mesa).
    this.maxMessagesPerSecond = 20;
    this.registro = new RegistroMesa(
      MesaRoom.servicos,
      { variante: regras.variante, modo, formato: modo === 'ranqueada' ? (humanos === 2 ? '1x1' : '2x2') : null },
      (e) => console.error(`[MesaRoom ${this.roomId}] falha ao gravar`, e),
    );
    MesaRoom.registrosVivos.add(this.registro);
    this.mesa = new Mesa({
      regras,
      modo,
      nivelBot,
      humanosEsperados: humanos,
      chanceInterceptarSinal,
      chanceFalaBot: 0.2,
      // O tempo de família vem da mesa; `MesaRoom.tempos` (testes, E2E) pode encurtar.
      tempos: { janelaFamiliaMs: tempoFamiliaS * 1000, ...MesaRoom.tempos },
      rand: randCripto,
      relogio: {
        agendar: (ms, fn) => {
          const d = this.clock.setTimeout(fn, ms);
          return () => d.clear();
        },
        agora: () => Date.now(),
      },
      enviar: (id, tipo, payload) => this.clients.get(id)?.send(tipo, payload),
      aoErro: (e) => console.error(`[MesaRoom ${this.roomId}] erro na mesa`, e),
      aoAplicar: (a, porHumano) => this.registro.acao(a, porHumano),
      aoIniciar: () => {
        this.lock().catch((e) => console.error('[MesaRoom] falha ao trancar a sala', e));
        if (this.reservados) MesaRoom.ranqueadasIniciadas.add(this.roomId);
        this.registro.iniciou();
      },
      aoTerminar: (s) => {
        this.registro.terminou(s);
        this.liberarReservados();
      },
    });

    this.onMessage('acao', (client, payload) => this.mesa.acao(client.sessionId, payload));
    this.onMessage('sinal', (client, payload) => this.mesa.sinal(client.sessionId, payload));
    this.onMessage('fala', (client, payload) => this.mesa.fala(client.sessionId, payload));
    this.onMessage('semFamilia', (client) => this.mesa.semFamilia(client.sessionId));
    this.onMessage('batida', (client, payload) => this.mesa.batida(client.sessionId, (payload as { forca?: unknown } | null)?.forca));
    this.onMessage('chat', (client, payload) => this.mesa.chat(client.sessionId, payload));
    // Ranqueada começa sozinha quando todos os reservados sentam; ninguém completa com bots.
    this.onMessage('iniciar', (client) => {
      if (!this.reservados) this.mesa.iniciar(client.sessionId);
    });
    this.onMessage('sincronizar', (client) => this.mesa.sincronizar(client.sessionId));

    if (this.reservados) {
      this.clock.setTimeout(() => {
        if (this.mesa.iniciada) return;
        this.cancelada = true;
        // Antes de derrubar: quem apareceu volta à fila assim que recebe o código, e a fila
        // não pode mais vê-lo nesta mesa.
        this.liberarReservados();
        void this.disconnect(SAIDA_PARTIDA_CANCELADA);
      }, MesaRoom.esperaRanqueadaMs);
    }
  }

  onJoin(client: Client, options?: { nome?: unknown; avatar?: unknown }) {
    const auth = client.auth as UsuarioConexao | undefined;
    // Logado: a foto da conta. Sem conta: a que escolheu ao pôr o apelido (mesmas regras da conta).
    const avatar = auth ? (auth.avatar ?? null) : (avatarValido(options?.avatar) ?? null);
    if (auth && this.registro.temUsuario(auth.usuarioId)) throw new Error('você já está nesta mesa (outra aba?)');
    let cadeira: Cadeira | null;
    if (this.reservados) {
      const r = auth ? this.reservados.find((j) => j.usuarioId === auth.usuarioId) : undefined;
      if (!r || !auth) throw new Error('lugar não reservado para você');
      cadeira = this.mesa.sentar(client.sessionId, auth.apelido, r.cadeira, avatar);
    } else {
      cadeira = this.mesa.sentar(client.sessionId, auth?.apelido ?? options?.nome, undefined, avatar);
    }
    if (cadeira === null) throw new Error('mesa cheia ou já iniciada');
    this.registro.sentou({ cadeira, usuarioId: auth?.usuarioId ?? null, nome: auth?.apelido ?? limparNome(options?.nome) });
  }

  onDrop(client: Client) {
    // Cliente cujo onJoin falhou (nunca sentou) também passa por aqui. Mesa cancelada: o
    // código de saída não é consentido (cai aqui), mas não há para onde reconectar.
    if (this.cancelada || this.mesa.cadeiraDe(client.sessionId) === null) return;
    this.mesa.desconectar(client.sessionId);
    this.allowReconnection(client, 60).catch(() => {});
  }

  onReconnect(client: Client) {
    this.mesa.reconectar(client.sessionId);
  }

  /** Saída definitiva (consentida ou fim dos 60 s de reconexão). */
  onLeave(client: Client) {
    const auth = client.auth as UsuarioConexao | undefined;
    if (this.reservados && auth) this.liberarConta(auth.usuarioId);
    const c = this.mesa.cadeiraDe(client.sessionId);
    if (c !== null) {
      if (!this.mesa.iniciada) this.registro.saiuAntesDoInicio(c);
      else if (this.mesa.partida?.fase !== 'fimPartida') this.registro.abandonou(c);
    }
    this.mesa.sair(client.sessionId);
  }

  onDispose() {
    this.liberarReservados();
    MesaRoom.ranqueadasIniciadas.delete(this.roomId);
    if (!this.mesa) return;
    // Começou e não terminou (todos os humanos saíram): fecha a partida como abandonada.
    if (this.mesa.iniciada && this.mesa.partida?.fase !== 'fimPartida') this.registro.encerrarAbandonada();
    this.mesa.dispose();
    // O Colyseus espera esta promessa antes de dar a sala por descartada (e o desligamento,
    // antes de fechar o banco).
    const r = this.registro;
    return r.ocioso().finally(() => MesaRoom.registrosVivos.delete(r));
  }

  /** O `gracefullyShutdown` do Colyseus chama isto em cada sala antes de desconectar todos. */
  onBeforeShutdown() {
    this.registro?.desligar();
    super.onBeforeShutdown();
  }

  /** Sem isto, uma exceção num timer do `clock` derruba o processo inteiro. */
  onUncaughtException(err: RoomException, method: RoomMethodName) {
    // onJoin recusado ("mesa cheia ou já iniciada") é esperado e o erro já volta ao cliente.
    if (method === 'onJoin') {
      console.warn(`[MesaRoom ${this.roomId}] entrada recusada: ${err.message}`);
      return;
    }
    console.error(`[MesaRoom ${this.roomId}] exceção em ${method}`, err.cause ?? err);
  }
}
