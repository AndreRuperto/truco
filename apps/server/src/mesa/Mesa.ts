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
  /** Chamado uma vez, quando a partida começa (manual ou automaticamente). */
  aoIniciar?: () => void;
  /** Erros internos (bot, timers). A mesa se recupera sozinha; isto só registra. */
  aoErro?: (e: unknown) => void;
  /** Decisão dos bots. Padrão: bot fácil ou difícil conforme `nivelBot`. */
  decidirBot?: (s: EstadoPartida, cadeira: Cadeira) => AcaoJogador | null;
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
  /** Sobe a cada mudança do estado do jogo (ação aplicada ou distribuição). */
  private versao = 0;
  /** Situação para a qual os timers atuais foram agendados (ver `atualizar`). */
  private chaveTurno: string | null = null;
  private bots = 0;
  private readonly relogio: Relogio;
  private readonly rand: () => number;
  private readonly tempos: Tempos;
  private readonly decidirBot: (s: EstadoPartida, cadeira: Cadeira) => AcaoJogador | null;

  constructor(private readonly o: OpcoesMesa) {
    const h = o.humanosEsperados;
    if (!Number.isInteger(h) || h < 1 || h > 4) throw new Error('humanosEsperados deve ser 1..4');
    this.relogio = o.relogio ?? relogioReal;
    this.rand = o.rand ?? Math.random;
    this.tempos = { ...TEMPOS_PADRAO, ...o.tempos };
    this.decidirBot =
      o.decidirBot ??
      ((s, c) =>
        o.nivelBot === 'dificil'
          ? botDificil(visaoDoJogador(s, c), this.rand, { amostras: 24, orcamentoMs: 8 })
          : botFacil(s, c));
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
    this.versao++;
    this.o.aoIniciar?.();
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

  /** Reenvia o estado atual só para quem pediu (ex.: cliente perdeu mensagens). */
  sincronizar(id: string): void {
    const c = this.cadeiraDe(id);
    if (c !== null && this.humanoAtivo(c)) this.enviarEstado(c);
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

  /** Aplica a ação; devolve se deu certo. Erro de humano vai para ele; de bot, para `aoErro`. */
  private aplicar(acao: AcaoJogador, idHumano?: string): boolean {
    if (!this.estado) return false;
    try {
      this.estado = reduce(this.estado, acao);
    } catch (e) {
      if (idHumano) this.erro(idHumano, e instanceof ErroJogada ? e.message : 'erro interno');
      if (!idHumano || !(e instanceof ErroJogada)) this.falha(e);
      return false;
    }
    this.versao++;
    this.paraHumanos((destino) => this.o.enviar(destino, 'acao', { cadeira: acao.cadeira, tipo: acao.tipo }));
    this.atualizar();
    return true;
  }

  /**
   * Reagenda timers e prazo conforme quem deve agir e reenvia os estados.
   * Se nada relevante mudou (mesma versão do jogo, mesmos agentes, mesmos
   * humanos ativos) só reenvia — quem cai/volta sem ser da vez não mexe no
   * prazo alheio. `forcar` reagenda mesmo assim (recuperação de falhas).
   */
  private atualizar(forcar = false): void {
    const s = this.estado;
    const chave = s ? this.chaveDoTurno(s) : null;
    if (!forcar && chave !== null && chave === this.chaveTurno) {
      this.enviarEstados();
      return;
    }
    this.chaveTurno = chave;
    this.cancelarTimers();
    this.prazo = null;
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

  private chaveDoTurno(s: EstadoPartida): string {
    const agentes = quemDeveAgir(s).map((c) => `${c}${this.humanoAtivo(c) ? 'h' : 'b'}`);
    return `${this.versao}|${s.fase}|${agentes.join(',')}`;
  }

  private distribuir(): void {
    if (!this.estado) return;
    try {
      this.estado = reduce(this.estado, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), this.rand) });
      this.versao++;
    } catch (e) {
      this.falha(e);
    }
    this.atualizar(true);
  }

  private jogarBot(c: Cadeira): void {
    const s = this.estado;
    if (!s) return;
    let escolhida: AcaoJogador | null = null;
    try {
      escolhida = this.decidirBot(s, c);
    } catch (e) {
      this.falha(e);
    }
    if (escolhida && escolhida.cadeira !== c) {
      this.falha(new Error(`bot da cadeira ${c} tentou agir pela ${escolhida.cadeira}`));
      escolhida = null;
    }
    if (escolhida && this.aplicar(escolhida)) return;
    this.agirPor(c);
  }

  private estourouTempo(c: Cadeira): void {
    this.agirPor(c);
  }

  /** Jogada automática; se até ela falhar, a primeira ação legal; senão reagenda. */
  private agirPor(c: Cadeira): void {
    const s = this.estado;
    if (!s) return;
    let opcoes: AcaoJogador[] = [];
    try {
      opcoes = [jogadaAutomatica(s, c), ...acoesValidas(s, c)];
    } catch (e) {
      this.falha(e);
    }
    for (const a of opcoes) if (this.aplicar(a)) return;
    this.atualizar(true);
  }

  private falha(e: unknown): void {
    try {
      if (this.o.aoErro) this.o.aoErro(e);
      else console.error('[Mesa]', e);
    } catch {
      // registrar nunca pode derrubar a mesa
    }
  }

  private enviarEstados(): void {
    const cadeiras = this.infoCadeiras();
    for (const c of CADEIRAS) if (this.humanoAtivo(c)) this.enviarEstado(c, cadeiras);
  }

  private enviarEstado(c: Cadeira, cadeiras: InfoCadeira[] = this.infoCadeiras()): void {
    const s = this.estado;
    const msg: MsgEstado = {
      minhaCadeira: c,
      cadeiras,
      visao: s ? visaoDoJogador(s, c) : null,
      prazo: this.prazo,
      minhasAcoes: s ? acoesValidas(s, c) : [],
    };
    this.o.enviar(this.ocupantes[c].id!, 'estado', msg);
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

  /** Primeiro humano conectado, na ordem das cadeiras. */
  private dono(): Cadeira | undefined {
    return CADEIRAS.find((c) => this.humanoAtivo(c));
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

  /** Callbacks de timer nunca deixam exceção escapar: registram e reagendam. */
  private agendar(ms: number, fn: () => void): void {
    this.cancelamentos.push(
      this.relogio.agendar(ms, () => {
        try {
          fn();
        } catch (e) {
          this.falha(e);
          try {
            this.atualizar(true);
          } catch (e2) {
            this.falha(e2);
          }
        }
      }),
    );
  }

  private cancelarTimers(): void {
    for (const cancelar of this.cancelamentos) cancelar();
    this.cancelamentos = [];
  }
}
