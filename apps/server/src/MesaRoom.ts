import { type Client, Room, type RoomException, type RoomMethodName } from '@colyseus/core';
import { randomInt } from 'node:crypto';
import { Mesa, type Tempos } from './mesa/Mesa';
import { opcoesDaSala } from './mesa/protocolo';

const randCripto = () => randomInt(0, 2 ** 32) / 2 ** 32;

export class MesaRoom extends Room {
  /** Sobrescrito nos testes para acelerar. */
  static tempos: Partial<Tempos> = {};

  private mesa!: Mesa;

  onCreate(options: unknown) {
    const { regras, humanos, nivelBot } = opcoesDaSala(options);
    this.maxClients = humanos;
    // Acima disso o Colyseus derruba o cliente (sinais/falas já têm limite próprio na Mesa).
    this.maxMessagesPerSecond = 20;
    this.mesa = new Mesa({
      regras,
      nivelBot,
      humanosEsperados: humanos,
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
      aoIniciar: () => {
        this.lock().catch((e) => console.error('[MesaRoom] falha ao trancar a sala', e));
      },
      aoTerminar: () => {
        // Plano 4: registrar partida e Elo.
      },
    });

    this.onMessage('acao', (client, payload) => this.mesa.acao(client.sessionId, payload));
    this.onMessage('sinal', (client, payload) => this.mesa.sinal(client.sessionId, payload));
    this.onMessage('fala', (client, payload) => this.mesa.fala(client.sessionId, payload));
    this.onMessage('iniciar', (client) => this.mesa.iniciar(client.sessionId));
    this.onMessage('sincronizar', (client) => this.mesa.sincronizar(client.sessionId));
  }

  onJoin(client: Client, options?: { nome?: unknown }) {
    if (this.mesa.sentar(client.sessionId, options?.nome) === null) throw new Error('mesa cheia ou já iniciada');  }

  onDrop(client: Client) {
    // Cliente cujo onJoin falhou (nunca sentou) também passa por aqui.
    if (this.mesa.cadeiraDe(client.sessionId) === null) return;
    this.mesa.desconectar(client.sessionId);
    this.allowReconnection(client, 60).catch(() => {});
  }

  onReconnect(client: Client) {
    this.mesa.reconectar(client.sessionId);
  }

  onLeave(client: Client) {
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
