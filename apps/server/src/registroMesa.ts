import type { AcaoJogador, Cadeira, EstadoPartida, Variante } from '@truco/engine';
import type { Formato } from './api/tipos';
import type { ModoMesa } from './mesa/protocolo';
import { type Contadores, contadoresZerados, contarAcao } from './ranking/estatisticas';
import { type AssentoRegistro, encerrarAbandonada, iniciarPartida, registrarAbandono, terminarPartida } from './repo/partidas';
import type { Servicos } from './servicos';

export interface JogadorSala {
  cadeira: Cadeira;
  /** null = convidado. */
  usuarioId: number | null;
  nome: string;
}

export interface InfoRegistro {
  variante: Variante;
  modo: ModoMesa;
  formato: Formato | null;
}

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

/**
 * Grava a partida de uma sala. Métodos síncronos; as escritas rodam em fila (uma
 * cadeia de promessas), na ordem das chamadas. Falhas vão para `aoErro` e não param a mesa.
 */
export class RegistroMesa {
  private partidaId: number | null = null;
  private readonly humanos = new Map<Cadeira, JogadorSala>();
  private readonly contadores: Contadores[] = CADEIRAS.map(contadoresZerados);
  private cadeia: Promise<void> = Promise.resolve();
  /** Servidor desligando (redeploy): ninguém é punido pelas quedas que vêm a seguir. */
  private desligando = false;

  constructor(
    private readonly s: Servicos | null,
    private readonly info: InfoRegistro,
    private readonly aoErro: (e: unknown) => void = (e) => console.error('[registro]', e),
  ) {}

  sentou(j: JogadorSala): void {
    this.humanos.set(j.cadeira, j);
  }

  /** A conta já está sentada nesta mesa (ex.: outra aba). */
  temUsuario(usuarioId: number): boolean {
    for (const j of this.humanos.values()) if (j.usuarioId === usuarioId) return true;
    return false;
  }

  saiuAntesDoInicio(c: Cadeira): void {
    this.humanos.delete(c);
  }

  acao(a: AcaoJogador, porHumano: boolean): void {
    if (porHumano && this.humanos.has(a.cadeira)) this.contadores[a.cadeira] = contarAcao(this.contadores[a.cadeira], a);
  }

  /**
   * A gravação roda depois (microtarefa): o `sentar` do último humano dispara o início
   * antes de a sala chamar `sentou` para ele.
   */
  iniciou(): void {
    const s = this.s;
    if (!s || this.desligando) return;
    // Revanche na mesma sala: contadores do zero; a partida anterior já foi gravada.
    for (const c of CADEIRAS) this.contadores[c] = contadoresZerados();
    this.encadear(async () => {
      this.partidaId = null;
    });
    this.encadear(async () => {
      if (![...this.humanos.values()].some((j) => j.usuarioId !== null)) return;
      const assentos: AssentoRegistro[] = CADEIRAS.map((c) => {
        const j = this.humanos.get(c);
        return j ? { cadeira: c, usuarioId: j.usuarioId, nome: j.nome, humano: true } : { cadeira: c, usuarioId: null, nome: 'Bot', humano: false };
      });
      this.partidaId = await iniciarPartida(s.banco, { ...this.info, assentos }, s.agora());
    });
  }

  abandonou(c: Cadeira): void {
    const s = this.s;
    const usuarioId = this.humanos.get(c)?.usuarioId ?? null;
    if (!s || usuarioId === null || this.desligando) return;
    this.encadear(async () => {
      if (this.partidaId === null) return;
      await registrarAbandono(s.banco, this.partidaId, usuarioId, { k: s.kElo, agora: s.agora(), bloqueioMs: s.bloqueioAbandonoMs });
    });
  }

  terminou(e: EstadoPartida): void {
    const s = this.s;
    if (!s) return;
    const fim = {
      placar: [e.placar[0], e.placar[1]] as const,
      vencedora: e.vencedor,
      contadores: this.contadores.map((c) => ({ ...c })),
    };
    this.encadear(async () => {
      if (this.partidaId === null) return;
      await terminarPartida(s.banco, this.partidaId, fim, { k: s.kElo, agora: s.agora() });
    });
  }

  /** A sala foi descartada antes do fim: fecha a partida como abandonada (no-op se já terminou). */
  encerrarAbandonada(): void {
    const s = this.s;
    if (!s) return;
    this.encadear(async () => {
      if (this.partidaId === null) return;
      await encerrarAbandonada(s.banco, this.partidaId, s.agora());
    });
  }

  /**
   * O servidor vai desligar e derrubar todo mundo: a partida em andamento fecha como
   * abandonada (sem Elo para ninguém) e as saídas seguintes não viram abandono (sem Elo
   * nem bloqueio). Abandonos já registrados antes continuam valendo.
   */
  desligar(): void {
    if (this.desligando) return;
    this.desligando = true;
    this.encerrarAbandonada();
  }

  /** Espera as gravações pendentes (testes e desligamento). */
  ocioso(): Promise<void> {
    return this.cadeia;
  }

  private encadear(fn: () => Promise<void>): void {
    this.cadeia = this.cadeia.then(fn).catch((e) => this.aoErro(e));
  }
}
