import {
  type AcaoJogador,
  botDificil,
  botFacil,
  type Cadeira,
  duplaDe,
  ehAcaoJogador,
  embaralhar,
  ErroJogada,
  type EstadoPartida,
  forca,
  acoesValidas,
  novaPartida,
  novoBaralho,
  parceiroDe,
  reduce,
  type RegrasMesa,
  visaoDoJogador,
} from '@truco/engine';
import { ehFala, ehSinal, type InfoCadeira, type MsgEstado, type NivelBot } from './protocolo';

export interface Relogio {
  /** Agenda `fn` e devolve uma função que cancela. */
  agendar(ms: number, fn: () => void): () => void;
  agora(): number;
}

export const relogioReal: Relogio = {
  agendar(ms, fn) {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
  agora: () => Date.now(),
};

export interface Tempos {
  jogadaMs: number;
  botMs: number;
  pausaMaoMs: number;
  intervaloMensagemMs: number;
}

export const TEMPOS_PADRAO: Tempos = { jogadaMs: 20_000, botMs: 900, pausaMaoMs: 1_800, intervaloMensagemMs: 1_000 };

export interface OpcoesMesa {
  regras: RegrasMesa;
  nivelBot: NivelBot;
  humanosEsperados: number;
  enviar: (id: string, tipo: string, payload: unknown) => void;
  relogio?: Relogio;
  rand?: () => number;
  tempos?: Partial<Tempos>;
  /** Chance (0–1) de cada adversário ver um sinal. */
  chanceInterceptarSinal?: number;
  aoTerminar?: (s: EstadoPartida) => void;
}

interface Ocupante {
  id: string | null;
  nome: string | null;
  humano: boolean;
  conectado: boolean;
  ultimaMensagem: number;
}

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];
/** Os dois primeiros humanos ficam parceiros. */
const ORDEM_SENTAR: Cadeira[] = [0, 2, 1, 3];
const NOMES_BOT = ['Zé', 'Tião', 'Dita', 'Nhô'];

const vazio = (): Ocupante => ({ id: null, nome: null, humano: false, conectado: false, ultimaMensagem: -Infinity });

/** Cadeiras que precisam agir agora. */
export function quemDeveAgir(s: EstadoPartida): Cadeira[] {
  const m = s.mao;
  if (!m) return [];
  if (s.fase === 'jogando') return [m.vez];
  if (s.fase === 'respondendoTruco' && m.trucoPendente) {
    const pediu = m.trucoPendente.dupla;
    return CADEIRAS.filter((c) => duplaDe(c) !== pediu);
  }
  if (s.fase === 'decisaoMao10') return CADEIRAS.filter((c) => duplaDe(c) === m.duplaNoDez);
  return [];
}

/** Jogada quando o tempo estoura: corre, ou joga a carta mais fraca. */
export function jogadaAutomatica(s: EstadoPartida, cadeira: Cadeira): AcaoJogador {
  if (s.fase === 'respondendoTruco') return { tipo: 'correr', cadeira };
  if (s.fase === 'decisaoMao10') return { tipo: 'mao10', cadeira, jogar: false };
  const m = s.mao;
  if (!m || m.tipo === 'mao11') return { tipo: 'jogar', cadeira, indice: 0 };
  const forcas = m.maos[cadeira].map((c) => forca(c, s.regras.variante, m.vira));
  return { tipo: 'jogar', cadeira, indice: forcas.indexOf(Math.min(...forcas)) };
}

export class Mesa {
  private readonly ocupantes: Ocupante[] = CADEIRAS.map(vazio);
  private estado: EstadoPartida | null = null;
  private cancelamentos: (() => void)[] = [];
  private prazo: MsgEstado['prazo'] = null;
  private terminou = false;
  private bots = 0;
  private readonly relogio: Relogio;
  private readonly rand: () => number;
  private readonly tempos: Tempos;

  constructor(private readonly o: OpcoesMesa) {
    const h = o.humanosEsperados;
    if (!Number.isInteger(h) || h < 1 || h > 4) throw new Error('humanosEsperados deve ser 1..4');
    this.relogio = o.relogio ?? relogioReal;
    this.rand = o.rand ?? Math.random;
    this.tempos = { ...TEMPOS_PADRAO, ...o.tempos };
  }

  get iniciada(): boolean {
    return this.estado !== null;
  }

  get partida(): EstadoPartida | null {
    return this.estado;
  }

  cadeiraDe(id: string): Cadeira | null {
    const i = this.ocupantes.findIndex((x) => x.id === id);
    return i < 0 ? null : (i as Cadeira);
  }

  // ---------- lobby ----------

  sentar(id: string, nome: string): Cadeira | null {
    if (this.iniciada || this.cadeiraDe(id) !== null) return null;
    const cad = ORDEM_SENTAR.find((c) => this.ocupantes[c].id === null);
    if (cad === undefined) return null;
    this.ocupantes[cad] = {
      id,
      nome: nome.trim().slice(0, 20) || 'Jogador',
      humano: true,
      conectado: true,
      ultimaMensagem: -Infinity,
    };
    if (this.humanosSentados() >= this.o.humanosEsperados) this.iniciar();
    else this.enviarEstados();
    return cad;
  }

  /** Começa a partida completando com bots. Com `id`, só o dono pode. */
  iniciar(id?: string): void {
    if (this.iniciada) return;
    if (id !== undefined && this.cadeiraDe(id) !== this.dono()) return;
    for (const c of CADEIRAS) if (this.ocupantes[c].id === null) this.virarBot(c);
    this.estado = novaPartida(this.o.regras, Math.floor(this.rand() * 4) as Cadeira);
    this.atualizar();
  }

  desconectar(id: string): void {
    const c = this.cadeiraDe(id);
    if (c === null) return;
    this.ocupantes[c].conectado = false;
    if (this.iniciada) this.atualizar();
    else this.enviarEstados();
  }

  reconectar(id: string): void {
    const c = this.cadeiraDe(id);
    if (c === null) return;
    this.ocupantes[c].conectado = true;
    if (this.iniciada) this.atualizar();
    else this.enviarEstados();
  }

  /** Saída definitiva: antes do início libera a cadeira; depois, um bot assume. */
  sair(id: string): void {
    const c = this.cadeiraDe(id);
    if (c === null) return;
    if (!this.iniciada) {
      this.ocupantes[c] = vazio();
      this.enviarEstados();
      return;
    }
    this.virarBot(c);
    this.atualizar();
  }

  dispose(): void {
    this.cancelarTimers();
  }

  // ---------- jogo ----------

  acao(id: string, bruto: unknown): void {
    const cad = this.cadeiraDe(id);
    if (cad === null || !this.estado) return;
    const comCadeira = bruto && typeof bruto === 'object' ? { ...(bruto as Record<string, unknown>), cadeira: cad } : bruto;
    if (!ehAcaoJogador(comCadeira)) {
      this.erro(id, 'ação inválida');
      return;
    }
    this.aplicar(comCadeira, id);
  }

  sinal(id: string, sinal: unknown): void {
    const c = this.cadeiraDe(id);
    if (c === null || !this.estado || !ehSinal(sinal) || !this.podeMandar(c)) return;
    const parceiro = parceiroDe(c);
    for (const alvo of CADEIRAS) {
      if (alvo === c || !this.humanoAtivo(alvo)) continue;
      if (alvo === parceiro) this.o.enviar(this.ocupantes[alvo].id!, 'sinal', { de: c, sinal });
      else if (this.rand() < (this.o.chanceInterceptarSinal ?? 0)) {
        this.o.enviar(this.ocupantes[alvo].id!, 'sinal', { de: c, sinal, interceptado: true });
      }
    }
  }

  fala(id: string, fala: unknown): void {
    const c = this.cadeiraDe(id);
    if (c === null || !this.estado || !ehFala(fala) || !this.podeMandar(c)) return;
    this.paraHumanos((destino) => this.o.enviar(destino, 'fala', { de: c, fala }));
  }

  // ---------- internos ----------

  private aplicar(acao: AcaoJogador, idHumano?: string): void {
    if (!this.estado) return;
    try {
      this.estado = reduce(this.estado, acao);
    } catch (e) {
      if (e instanceof ErroJogada) {
        if (idHumano) this.erro(idHumano, e.message);
        return;
      }
      throw e;
    }
    this.paraHumanos((destino) => this.o.enviar(destino, 'acao', { cadeira: acao.cadeira, tipo: acao.tipo }));
    this.atualizar();
  }

  private atualizar(): void {
    this.cancelarTimers();
    this.prazo = null;
    const s = this.estado;
    if (!s) {
      this.enviarEstados();
      return;
    }
    if (s.fase === 'fimPartida') {
      this.enviarEstados();
      if (!this.terminou) {
        this.terminou = true;
        this.o.aoTerminar?.(s);
      }
      return;
    }
    if (s.fase === 'aguardandoDistribuicao') {
      this.agendar(this.tempos.pausaMaoMs, () => this.distribuir());
      this.enviarEstados();
      return;
    }
    // Os agentes são sempre de uma só dupla. Havendo humano ativo entre eles, ninguém
    // decide por ele: espera o prazo; no fim, o parceiro bot (se houver) decide.
    const agentes = quemDeveAgir(s);
    const humanos = agentes.filter((c) => this.humanoAtivo(c));
    if (humanos.length > 0) {
      const substituto = agentes.find((c) => !this.humanoAtivo(c));
      this.prazo = { cadeiras: humanos, ate: this.relogio.agora() + this.tempos.jogadaMs };
      this.agendar(this.tempos.jogadaMs, () =>
        substituto !== undefined ? this.jogarBot(substituto) : this.estourouTempo(humanos[0]),
      );
    } else {
      for (const c of agentes) this.agendar(this.tempos.botMs, () => this.jogarBot(c));
    }
    this.enviarEstados();
  }

  private distribuir(): void {
    if (!this.estado) return;
    this.estado = reduce(this.estado, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), this.rand) });
    this.atualizar();
  }

  private jogarBot(c: Cadeira): void {
    const s = this.estado;
    if (!s) return;
    const escolhida = this.o.nivelBot === 'dificil' ? botDificil(visaoDoJogador(s, c), this.rand) : botFacil(s, c);
    this.aplicar(escolhida ?? jogadaAutomatica(s, c));
  }

  private estourouTempo(c: Cadeira): void {
    if (this.estado) this.aplicar(jogadaAutomatica(this.estado, c));
  }

  private enviarEstados(): void {
    const cadeiras = this.infoCadeiras();
    const s = this.estado;
    for (const c of CADEIRAS) {
      const o = this.ocupantes[c];
      if (!o.humano || !o.conectado || !o.id) continue;
      const msg: MsgEstado = {
        minhaCadeira: c,
        cadeiras,
        visao: s ? visaoDoJogador(s, c) : null,
        prazo: this.prazo,
        minhasAcoes: s ? acoesValidas(s, c) : [],
      };
      this.o.enviar(o.id, 'estado', msg);
    }
  }

  private infoCadeiras(): InfoCadeira[] {
    return this.ocupantes.map((o) => ({
      tipo: o.humano ? 'humano' : o.nome ? 'bot' : 'vazia',
      nome: o.nome,
      conectado: o.humano ? o.conectado : true,
    }));
  }

  private virarBot(c: Cadeira): void {
    this.ocupantes[c] = {
      id: null,
      nome: `Bot ${NOMES_BOT[this.bots++ % NOMES_BOT.length]}`,
      humano: false,
      conectado: true,
      ultimaMensagem: -Infinity,
    };
  }

  private humanoAtivo(c: Cadeira): boolean {
    const o = this.ocupantes[c];
    return o.humano && o.conectado && o.id !== null;
  }

  private humanosSentados(): number {
    return this.ocupantes.filter((o) => o.humano && o.id !== null).length;
  }

  private dono(): Cadeira | undefined {
    return ORDEM_SENTAR.find((c) => this.ocupantes[c].humano);
  }

  private podeMandar(c: Cadeira): boolean {
    const agora = this.relogio.agora();
    if (agora - this.ocupantes[c].ultimaMensagem < this.tempos.intervaloMensagemMs) return false;
    this.ocupantes[c].ultimaMensagem = agora;
    return true;
  }

  private paraHumanos(fn: (id: string) => void): void {
    for (const c of CADEIRAS) if (this.humanoAtivo(c)) fn(this.ocupantes[c].id!);
  }

  private erro(id: string, mensagem: string): void {
    this.o.enviar(id, 'erro', { mensagem });
  }

  private agendar(ms: number, fn: () => void): void {
    this.cancelamentos.push(this.relogio.agendar(ms, fn));
  }

  private cancelarTimers(): void {
    for (const cancelar of this.cancelamentos) cancelar();
    this.cancelamentos = [];
  }
}
