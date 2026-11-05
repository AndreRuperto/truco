import { type AuthContext, type Client, ErrorCode, matchMaker, Room, ServerError } from '@colyseus/core';
import type { Variante } from '@truco/engine';
import type { Formato, MsgPareado } from './api/tipos';
import { cadeirasDoPareamento, Fila, normalizarCodigoDupla, type Pareamento } from './fila/fila';
import { MesaRoom } from './MesaRoom';
import { bloqueioAte, ratingDe } from './repo/partidas';
import type { Servicos } from './servicos';
import { type UsuarioConexao, usuarioDaConexao } from './sessaoSala';

/** Close code: o mesmo usuário entrou na fila por outra aba. */
export const SAIDA_FILA_SUBSTITUIDA = 4011;

/**
 * Uma sala só (sem filtro) com todo mundo que está na fila. A cada `intervaloMs` pareia,
 * cria a mesa ranqueada, reserva os assentos e manda `pareado` com a reserva; o cliente
 * sai da fila e consome a reserva.
 */
export class FilaRoom extends Room {
  static servicos: Servicos | null = null;
  /** Sobrescrito nos testes. */
  static intervaloMs = 1_000;

  private readonly fila = new Fila();
  private rodando = false;

  static async onAuth(token: string, _options: unknown, context: AuthContext): Promise<unknown> {
    const s = FilaRoom.servicos;
    const u = await usuarioDaConexao(s, token, context.headers);
    if (!s || !u) throw new ServerError(ErrorCode.AUTH_FAILED, 'entre na sua conta para jogar ranqueada');
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
        if (p.times.flat().some((x) => !this.clients.getById(x.id))) {
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

  private devolverPresentes(p: Pareamento): void {
    const presente = (x: { id: string }) => !!this.clients.getById(x.id);
    this.fila.devolver({ ...p, times: [p.times[0].filter(presente), p.times[1].filter(presente)] });
  }

  private async criarMesa(p: Pareamento): Promise<void> {
    const assentos = cadeirasDoPareamento(p);
    const sala = await matchMaker.createRoom('mesa', {
      modo: 'ranqueada',
      variante: p.variante,
      humanos: assentos.length,
      fichaInterna: MesaRoom.fichaInterna,
      jogadores: assentos.map((a) => ({ usuarioId: a.entrada.usuarioId, cadeira: a.cadeira })),
    });
    for (const a of assentos) {
      const auth: UsuarioConexao = { usuarioId: a.entrada.usuarioId, apelido: a.entrada.apelido };
      // O authData vira `client.auth` na mesa (sem passar pelo onAuth de novo).
      const reserva = await matchMaker.reserveSeatFor(sala, { nome: a.entrada.apelido }, auth);
      const msg: MsgPareado = { reserva };
      this.clients.getById(a.entrada.id)?.send('pareado', msg);
    }
  }

  private enviarStatus(c: Client): void {
    const st = this.fila.status(c.sessionId, Date.now());
    if (st) c.send('status', st);
  }
}
