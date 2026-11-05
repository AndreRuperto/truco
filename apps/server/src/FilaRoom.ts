import { type AuthContext, type Client, ErrorCode, matchMaker, Room, ServerError } from '@colyseus/core';
import type { Variante } from '@truco/engine';
import type { Formato, MsgPareado } from './api/tipos';
import { cadeirasDoPareamento, type EntradaFila, Fila, normalizarCodigoDupla, type Pareamento } from './fila/fila';
import { SAIDA_FILA_SUBSTITUIDA, SAIDA_PARTIDA_CANCELADA } from './mesa/protocolo';
import { MesaRoom } from './MesaRoom';
import { bloqueioAte, ratingDe } from './repo/partidas';
import type { Servicos } from './servicos';
import { type UsuarioConexao, usuarioDaConexao } from './sessaoSala';


/**
 * Uma sala só (sem filtro) com todo mundo que está na fila. A cada `intervaloMs` pareia,
 * cria a mesa ranqueada, reserva os assentos e manda `pareado` com a reserva; o cliente
 * sai da fila e consome a reserva.
 */
export class FilaRoom extends Room {
  static servicos: Servicos | null = null;
  /** Sobrescrito nos testes. */
  static intervaloMs = 1_000;
  /** Reserva de assento (os testes trocam para simular falha). */
  static reservar: typeof matchMaker.reserveSeatFor = (sala, opcoes, auth) => matchMaker.reserveSeatFor(sala, opcoes, auth);

  private readonly fila = new Fila();
  private rodando = false;

  static async onAuth(token: string, _options: unknown, context: AuthContext): Promise<unknown> {
    const s = FilaRoom.servicos;
    const u = await usuarioDaConexao(s, token, context.headers);
    if (!s || !u) throw new ServerError(ErrorCode.AUTH_FAILED, 'entre na sua conta para jogar ranqueada');
    // Pareada há pouco (outra aba) ou ainda numa mesa ranqueada: termine aquela primeiro.
    if (MesaRoom.emRanqueada(u.usuarioId)) throw new ServerError(ErrorCode.AUTH_FAILED, 'você já tem uma partida ranqueada em andamento');
    const ate = await bloqueioAte(s.banco, u.usuarioId, s.agora());
    if (ate) throw new ServerError(ErrorCode.AUTH_FAILED, `fila bloqueada até ${ate.toISOString()} por abandono de partida ranqueada`);
    return u;
  }

  onCreate() {
    this.maxClients = 5_000;
    this.clock.setInterval(() => void this.rodada(), FilaRoom.intervaloMs);
  }

  async onJoin(client: Client, options?: { variante?: unknown; formato?: unknown; codigoDupla?: unknown }) {
    const s = FilaRoom.servicos!;
    const auth = client.auth as UsuarioConexao;
    const variante: Variante = options?.variante === 'mineiro' ? 'mineiro' : 'paulista';
    const formato: Formato = options?.formato === '2x2' ? '2x2' : '1x1';
    const { elo } = await ratingDe(s.banco, auth.usuarioId, variante);
    const antiga = this.fila.entrar({
      id: client.sessionId,
      usuarioId: auth.usuarioId,
      apelido: auth.apelido,
      elo,
      variante,
      formato,
      codigoDupla: formato === '2x2' ? normalizarCodigoDupla(options?.codigoDupla) : null,
      desde: Date.now(),
    });
    if (antiga) this.clients.getById(antiga.id)?.leave(SAIDA_FILA_SUBSTITUIDA);
    this.enviarStatus(client);
  }

  onLeave(client: Client) {
    this.fila.sair(client.sessionId);
  }

  private async rodada(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    try {
      for (const p of this.fila.rodada(Date.now())) {
        if (p.times.flat().some((x) => !this.clients.getById(x.id) || MesaRoom.emRanqueada(x.usuarioId))) {
          this.devolverPresentes(p);
          continue;
        }
        try {
          await this.criarMesa(p);
        } catch (e) {
          console.error('[FilaRoom] falha ao criar mesa ranqueada', e);
          this.devolverPresentes(p);
        }
      }
      for (const c of this.clients) this.enviarStatus(c);
    } finally {
      this.rodando = false;
    }
  }

  /** Devolve à fila quem ainda está conectado e não está em outra ranqueada. */
  private devolverPresentes(p: Pareamento): void {
    const volta = (x: EntradaFila) => !!this.clients.getById(x.id) && !MesaRoom.emRanqueada(x.usuarioId);
    for (const x of p.times.flat()) if (this.clients.getById(x.id) && !volta(x)) this.derrubar(x);
    for (const x of this.fila.devolver({ ...p, times: [p.times[0].filter(volta), p.times[1].filter(volta)] })) this.derrubar(x);
  }

  private derrubar(x: EntradaFila): void {
    this.clients.getById(x.id)?.leave(SAIDA_FILA_SUBSTITUIDA);
  }

  /**
   * Quem foi reservado e não aparece não é penalizado: a mesa espera
   * `MesaRoom.esperaRanqueadaMs` (30 s) e, sem todos sentados, é cancelada
   * (`SAIDA_PARTIDA_CANCELADA`) sem gravar partida, Elo ou bloqueio. Quem apareceu volta
   * à fila pelo cliente. Partida só conta (e abandono só pune) depois de começar.
   */
  private async criarMesa(p: Pareamento): Promise<void> {
    const assentos = cadeirasDoPareamento(p);
    const sala = await matchMaker.createRoom('mesa', {
      modo: 'ranqueada',
      variante: p.variante,
      humanos: assentos.length,
      fichaInterna: MesaRoom.fichaInterna,
      jogadores: assentos.map((a) => ({ usuarioId: a.entrada.usuarioId, cadeira: a.cadeira })),
    });
    // Todas as reservas antes de avisar alguém: se uma falha, ninguém recebe `pareado` (e sai
    // da fila à toa); a mesa é descartada e todos voltam à fila (quem chama devolve).
    const reservas = [];
    try {
      for (const a of assentos) {
        const auth: UsuarioConexao = { usuarioId: a.entrada.usuarioId, apelido: a.entrada.apelido };
        // O authData vira `client.auth` na mesa (sem passar pelo onAuth de novo).
        reservas.push(await FilaRoom.reservar(sala, { nome: a.entrada.apelido }, auth));
      }
    } catch (e) {
      // `disconnect` resolve depois do descarte (onDispose libera as contas da mesa).
      await matchMaker.remoteRoomCall(sala.roomId, 'disconnect', [SAIDA_PARTIDA_CANCELADA]).catch((x: unknown) => {
        console.error('[FilaRoom] falha ao descartar a mesa sem reservas', x);
      });
      throw e;
    }
    for (const [i, a] of assentos.entries()) {
      const msg: MsgPareado = { reserva: reservas[i] };
      this.clients.getById(a.entrada.id)?.send('pareado', msg);
    }
    // Entrou de novo por outra aba enquanto a mesa era criada: a entrada nova sai.
    for (const a of assentos) {
      const outra = this.fila.tirarUsuario(a.entrada.usuarioId);
      if (outra) this.derrubar(outra);
    }
  }

  private enviarStatus(c: Client): void {
    const st = this.fila.status(c.sessionId, Date.now());
    if (st) c.send('status', st);
  }
}
