import { type AuthContext, type Client, ErrorCode, Room, type RoomException, type RoomMethodName, ServerError } from '@colyseus/core';
import type { Cadeira } from '@truco/engine';
import { randomInt, randomUUID } from 'node:crypto';
import { Mesa, type Tempos } from './mesa/Mesa';
import { filtroDaSala, limparNome, opcoesDaSala, SAIDA_PARTIDA_CANCELADA } from './mesa/protocolo';
import { RegistroMesa } from './registroMesa';
import type { Servicos } from './servicos';
import { type UsuarioConexao, usuarioDaConexao } from './sessaoSala';

const randCripto = () => randomInt(0, 2 ** 32) / 2 ** 32;

/** Quem a fila reservou para uma mesa ranqueada, e onde senta. */
export interface JogadorReservado {
  usuarioId: number;
  cadeira: Cadeira;
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

  private mesa!: Mesa;
  private registro!: RegistroMesa;
  private reservados: JogadorReservado[] | null = null;

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
    delete o.fichaInterna;
    delete o.jogadores;
    Object.assign(o, filtroDaSala(opcoesDaSala(o)));
    return (await usuarioDaConexao(MesaRoom.servicos, token, context.headers)) ?? true;
  }

  onCreate(options: unknown) {
    const cru = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
    const opcoes = opcoesDaSala(cru);
    const { modo, regras, humanos, nivelBot, chanceInterceptarSinal } = opcoes;
    if (modo === 'ranqueada') {
      if (cru.fichaInterna !== MesaRoom.fichaInterna) throw new Error('mesa ranqueada só pela fila');
      this.reservados = jogadoresReservados(cru.jogadores);
      if (this.reservados.length !== humanos) throw new Error('reservas não batem com a quantidade de humanos');
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
    this.mesa = new Mesa({
      regras,
      modo,
      nivelBot,
      humanosEsperados: humanos,
      chanceInterceptarSinal,
      chanceFalaBot: 0.2,
      tempos: MesaRoom.tempos,
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
        this.registro.iniciou();
      },
      aoTerminar: (s) => this.registro.terminou(s),
    });

    this.onMessage('acao', (client, payload) => this.mesa.acao(client.sessionId, payload));
    this.onMessage('sinal', (client, payload) => this.mesa.sinal(client.sessionId, payload));
    this.onMessage('fala', (client, payload) => this.mesa.fala(client.sessionId, payload));
    this.onMessage('chat', (client, payload) => this.mesa.chat(client.sessionId, payload));
    // Ranqueada começa sozinha quando todos os reservados sentam; ninguém completa com bots.
    this.onMessage('iniciar', (client) => {
      if (!this.reservados) this.mesa.iniciar(client.sessionId);
    });
    this.onMessage('sincronizar', (client) => this.mesa.sincronizar(client.sessionId));

    if (this.reservados) {
      this.clock.setTimeout(() => {
        if (!this.mesa.iniciada) void this.disconnect(SAIDA_PARTIDA_CANCELADA);
      }, MesaRoom.esperaRanqueadaMs);
    }
  }

  onJoin(client: Client, options?: { nome?: unknown }) {
    const auth = client.auth as UsuarioConexao | undefined;
    let cadeira: Cadeira | null;
    if (this.reservados) {
      const r = auth ? this.reservados.find((j) => j.usuarioId === auth.usuarioId) : undefined;
      if (!r || !auth) throw new Error('lugar não reservado para você');
      cadeira = this.mesa.sentar(client.sessionId, auth.apelido, r.cadeira);
    } else {
      cadeira = this.mesa.sentar(client.sessionId, auth?.apelido ?? options?.nome);
    }
    if (cadeira === null) throw new Error('mesa cheia ou já iniciada');
    this.registro.sentou({ cadeira, usuarioId: auth?.usuarioId ?? null, nome: auth?.apelido ?? limparNome(options?.nome) });
  }

  onDrop(client: Client) {
    // Cliente cujo onJoin falhou (nunca sentou) também passa por aqui.
    if (this.mesa.cadeiraDe(client.sessionId) === null) return;
    this.mesa.desconectar(client.sessionId);
    this.allowReconnection(client, 60).catch(() => {});
  }

  onReconnect(client: Client) {
    this.mesa.reconectar(client.sessionId);
  }

  /** Saída definitiva (consentida ou fim dos 60 s de reconexão). */
  onLeave(client: Client) {
    const c = this.mesa.cadeiraDe(client.sessionId);
    if (c !== null) {
      if (!this.mesa.iniciada) this.registro.saiuAntesDoInicio(c);
      else if (this.mesa.partida?.fase !== 'fimPartida') this.registro.abandonou(c);
    }
    this.mesa.sair(client.sessionId);
  }

  onDispose() {
    this.mesa.dispose();
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
