import type { VisualJogador } from '../api/tipos';
import { webcrypto } from 'node:crypto';
import {
  type AcaoJogador,
  acoesValidas,
  baralhoDaMesa,
  botDificil,
  botFacil,
  type Cadeira,
  type Carta,
  completarSorte,
  ehAcaoJogador,
  ehFamilia,
  fechadasUsadas,
  LIMITE_FAMILIAS_FECHADAS,
  ehFaseRitual,
  embaralhar,
  ErroJogada,
  type EstadoPartida,
  forca,
  janelaDeFamilia,
  novaPartida,
  parceiroDe,
  quemDeveAgir,
  reduce,
  type RegrasMesa,
  semSorte,
  visaoDoJogador,
} from '@truco/engine';
import {
  ehFala,
  ehSinal,
  type CacifeMesa,
  type InfoCadeira,
  limparChat,
  limparNome,
  type ModoMesa,
  type MsgChat,
  msgDaAcao,
  type MsgEstado,
  type NivelBot,
  type Sinal,
} from './protocolo';
import { aplicarBatida, decidirBatidaBot, forcaDaBatida, JANELA_BATIDA_MS, mesaFisicaInicial, type MsgBatida, pedidoQueBate } from './mesaFisica';
import { cartaDoSinal, falaDaRodada, rodadaFechada, sinalDaMao } from './social';

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

/** Sorte do servidor (CSPRNG): monte inicial, riffles, cortes, quem começa. */
export function randCripto(): number {
  return webcrypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

export interface Tempos {
  jogadaMs: number;
  botMs: number;
  pausaMaoMs: number;
  intervaloMensagemMs: number;
  /** Prazo do humano em cada etapa do ritual (embaralhar, cortar, escolher como dar). */
  ritualMs: number;
  /** Prazo da dupla adversária para conferir uma família fechada. */
  conferirMs: number;
  /**
   * Hora de pedir família, contada depois da distribuição: ninguém joga carta antes (nem quem
   * começa). Acaba antes se todos os humanos decidirem. 0 = sem janela (só a espera da distribuição).
   */
  janelaFamiliaMs: number;
  /** Quanto o bot da vez espera antes da 1ª carta: dá tempo de a animação da distribuição terminar. */
  distribuicaoMs: number;
}

export const TEMPOS_PADRAO: Tempos = {
  jogadaMs: 20_000,
  botMs: 900,
  pausaMaoMs: 1_800,
  intervaloMensagemMs: 1_000,
  ritualMs: 12_000,
  conferirMs: 6_000,
  janelaFamiliaMs: 20_000,
  distribuicaoMs: 5_000,
};

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
  /** Bots sinalizam ao parceiro a melhor carta no início da mão. Padrão: só com bot difícil. */
  sinaisBot?: boolean;
  /** Sinais liberados na mesa (padrão: sim). Desligados, ninguém sinaliza (nem os bots). */
  sinais?: boolean;
  /** Chance (0–1) de um bot comentar o fim de uma rodada ("boa", "bora", "vixe"). Padrão 0. */
  chanceFalaBot?: number;
  aoTerminar?: (s: EstadoPartida) => void;
  /** Chamado uma vez, quando a partida começa (manual ou automaticamente). */
  aoIniciar?: () => void;
  /** Erros internos (bot, timers). A mesa se recupera sozinha; isto só registra. */
  aoErro?: (e: unknown) => void;
  /** Tipo da mesa; vai no `MsgEstado`. Padrão 'classica'. */
  modo?: ModoMesa;
  /** Chat de texto. Padrão: só na privada. */
  chat?: boolean;
  /** Toda ação aplicada (humano ou bot). `porHumano` = veio de `acao()` (não de bot nem de tempo esgotado). */
  aoAplicar?: (acao: AcaoJogador, porHumano: boolean) => void;
  /** Decisão dos bots. Padrão: bot fácil ou difícil conforme `nivelBot`. */
  decidirBot?: (s: EstadoPartida, cadeira: Cadeira) => AcaoJogador | null;
  /** Chance (0–1) de um bot bater na mesa ao pedir seis/nove/doze. Padrão `CHANCE_BATIDA_BOT`. */
  chanceBatidaBot?: number;
}

interface Ocupante {
  id: string | null;
  nome: string | null;
  humano: boolean;
  conectado: boolean;
  ultimaMensagem: number;
  /** Já validado por quem senta (MesaRoom): ver `InfoCadeira.avatar`. */
  avatar?: string | null;
  /** Ver `InfoCadeira.voz`. */
  voz?: string | null;
  /** Ver `InfoCadeira.visual`. */
  visual?: VisualJogador | null;
}

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];
/** Os dois primeiros humanos ficam parceiros. */
const ORDEM_SENTAR: Cadeira[] = [0, 2, 1, 3];
/** Valendo Fichas, os dois primeiros ficam adversários (senão apostariam juntos contra os bots). */
const ORDEM_SENTAR_CACIFE: Cadeira[] = [0, 1, 2, 3];
const NOMES_BOT = ['Zé', 'Tião', 'Dita', 'Nhô'];

const vazio = (): Ocupante => ({ id: null, nome: null, humano: false, conectado: false, ultimaMensagem: -Infinity });

/**
 * Jogada quando o tempo estoura: no ritual, a etapa padrão (embaralha até 3 vezes e passa;
 * corta uma vez e devolve; dá por cima); não confere família; corre do truco e da mão de 10;
 * senão joga a carta mais fraca.
 */
export function jogadaAutomatica(s: EstadoPartida, cadeira: Cadeira): AcaoJogador {
  const r = s.ritual;
  if (s.fase === 'embaralhando') return r && r.embaralhadas < 3 ? { tipo: 'embaralhar', cadeira } : { tipo: 'passarCorte', cadeira };
  if (s.fase === 'cortando') return r && r.movimentos === 0 ? { tipo: 'cortar', cadeira } : { tipo: 'devolver', cadeira };
  if (s.fase === 'escolhendoDistribuicao') return { tipo: 'distribuir', cadeira, modo: 'porCima' };
  if (s.fase === 'conferindoFamilia') return { tipo: 'conferir', cadeira, conferir: false };
  if (s.fase === 'respondendoTruco') return { tipo: 'correr', cadeira };
  if (s.fase === 'decisaoMao10') return { tipo: 'mao10', cadeira, jogar: false };
  const m = s.mao;
  if (!m || m.tipo === 'mao11') return { tipo: 'jogar', cadeira, indice: 0 };
  // Cangada: tempo esgotado empilha a mais forte por cima; empilhado, a vez manda mostrar.
  if (s.fase === 'empilhando') {
    const f = m.maos[cadeira].map((c) => forca(c, s.regras.variante, m.vira));
    return { tipo: 'empilhar', cadeira, indice: f.indexOf(Math.max(...f)) };
  }
  if (m.cangada) return { tipo: 'mostrar', cadeira };
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
  /**
   * Sobe quando quem devia agir age fora do ritual (jogou, pediu, respondeu). Com humano agindo,
   * o prazo é da etapa: não muda com ações alheias (família de bot fora da vez) nem, no ritual,
   * com cada embaralhada/movimento do corte — só quando a fase, os agentes ou isto mudam.
   */
  private etapa = 0;
  /** Situação para a qual os timers atuais foram agendados (ver `atualizar`). */
  private chaveTurno: string | null = null;
  private bots = 0;
  /** Carta que cada cadeira "sabe" que o parceiro tem (último sinal de manilha recebido nesta mão). */
  private dicas: (Carta | null)[] = [null, null, null, null];
  /** Bots fora da vez que já decidiram a família nesta mão (uma decisão por mão: sem novo sorteio a cada mudança). */
  private familiaDecidida = new Set<Cadeira>();
  /** Janela de família da mão atual (ver `Tempos.janelaFamiliaMs`); null = a mão não teve. */
  private janela: { ate: number; decidiram: Set<Cadeira>; fechada: boolean; pausadaEm: number | null } | null = null;
  /** Prazo único de quem ainda não empilhou na cangada (não reinicia a cada um que empilha). */
  private ateEmpilhar: number | null = null;
  /** Fim de partida: humanos que pediram revanche. */
  private votosRevanche = new Set<Cadeira>();
  /** Última mensagem de chat por cadeira (limite próprio, separado de sinais/falas). */
  private readonly ultimoChat: number[] = [-Infinity, -Infinity, -Infinity, -Infinity];
  /** Tampo da mesa ("bater na mesa"): rachaduras, dano e se já virou plástico. */
  private fisica = mesaFisicaInicial();
  /** Último pedido de seis/nove/doze que ainda pode ser acompanhado de uma batida. */
  private pedidoBatida: { cadeira: Cadeira; ate: number } | null = null;
  private readonly relogio: Relogio;
  private readonly rand: () => number;
  private readonly tempos: Tempos;
  private readonly decidirBot: (s: EstadoPartida, cadeira: Cadeira) => AcaoJogador | null;

  constructor(private readonly o: OpcoesMesa) {
    const h = o.humanosEsperados;
    if (!Number.isInteger(h) || h < 1 || h > 4) throw new Error('humanosEsperados deve ser 1..4');
    this.relogio = o.relogio ?? relogioReal;
    this.rand = o.rand ?? randCripto;
    this.tempos = { ...TEMPOS_PADRAO, ...o.tempos };
    this.decidirBot =
      o.decidirBot ??
      ((s, c) => {
        if (o.nivelBot !== 'dificil') return botFacil(s, c);
        const d = this.dicas[c];
        return botDificil(visaoDoJogador(s, c), this.rand, {
          amostras: 24,
          orcamentoMs: 8,
          dica: d ? { parceiroTem: d } : undefined,
        });
      });
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

  /** Dica (carta sinalizada pelo parceiro) que a cadeira tem nesta mão. Exposto para testes/depuração. */
  dicaPara(c: Cadeira): Carta | null {
    return this.dicas[c];
  }

  // ---------- lobby ----------

  /** Senta na `cadeira` pedida (ranqueada: a que a fila reservou) ou na próxima livre. */
  sentar(id: string, nome: unknown, cadeira?: Cadeira, avatar: string | null = null, voz: string | null = null, visual: VisualJogador | null = null): Cadeira | null {
    if (this.iniciada || this.cadeiraDe(id) !== null) return null;
    const cad =
      cadeira !== undefined
        ? this.ocupantes[cadeira]?.id === null
          ? cadeira
          : undefined
        : (this.cacife ? ORDEM_SENTAR_CACIFE : ORDEM_SENTAR).find((c) => this.ocupantes[c].id === null);
    if (cad === undefined) return null;
    this.ocupantes[cad] = {
      id,
      nome: limparNome(nome),
      humano: true,
      conectado: true,
      ultimaMensagem: -Infinity,
      avatar,
      voz,
      visual,
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
    this.eloCongelado = false;
    this.versao++;
    this.o.aoIniciar?.();
    this.atualizar();
  }

  /**
   * Revanche na mesma mesa (fora da ranqueada): cada humano conectado pede; com todos,
   * começa outra partida com a mesma turma e as mesmas regras (quem caiu vira bot).
   */
  revanche(id: string): void {
    const c = this.cadeiraDe(id);
    if (c === null || !this.podeRevanche()) return;
    this.votosRevanche.add(c);
    if (this.faltamRevanche().length > 0) {
      this.enviarEstados();
      return;
    }
    this.votosRevanche.clear();
    for (const k of CADEIRAS) if (this.ocupantes[k].humano && !this.ocupantes[k].conectado) this.virarBot(k);
    this.terminou = false;
    this.janela = null;
    this.ateEmpilhar = null;
    this.dicas = [null, null, null, null];
    this.familiaDecidida.clear();
    this.pedidoBatida = null;
    this.fisica = mesaFisicaInicial();
    this.estado = novaPartida(this.o.regras, Math.floor(this.rand() * 4) as Cadeira);
    this.eloCongelado = false;
    this.versao++;
    this.o.aoIniciar?.();
    this.atualizar(true);
  }

  private podeRevanche(): boolean {
    return this.o.modo !== 'ranqueada' && this.estado?.fase === 'fimPartida';
  }

  private faltamRevanche(): Cadeira[] {
    return CADEIRAS.filter((k) => this.humanoAtivo(k) && !this.votosRevanche.has(k));
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
    // A sorte é sempre do servidor: bits/ponto que venham do cliente são descartados (sem percorrê-los).
    let comCadeira: unknown = bruto;
    if (bruto && typeof bruto === 'object') {
      const { bits: _b, ponto: _p, ...resto } = bruto as Record<string, unknown>;
      comCadeira = { ...resto, cadeira: cad };
    }
    if (!ehAcaoJogador(comCadeira)) {
      this.erro(id, 'ação inválida');
      return;
    }
    this.aplicar(comCadeira, id);
  }

  sinal(id: string, sinal: unknown): void {
    const c = this.cadeiraDe(id);
    if (c === null || !this.estado || !ehSinal(sinal) || !this.podeMandar(c)) return;
    if (this.o.sinais === false) {
      this.erro(id, 'nesta mesa não vale passar sinal');
      return;
    }
    this.enviarSinal(c, sinal);
  }

  fala(id: string, fala: unknown): void {
    const c = this.cadeiraDe(id);
    if (c === null || !this.estado || !ehFala(fala) || !this.podeMandar(c)) return;
    this.paraHumanos((destino) => this.o.enviar(destino, 'fala', { de: c, fala }));
  }

  /** "Sem família": o humano abre mão de pedir nesta janela; com todos decididos, o jogo segue. */
  semFamilia(id: string): void {
    const c = this.cadeiraDe(id);
    if (c === null || !this.janelaAberta()) return;
    this.janela!.decidiram.add(c);
    this.conferirFimDaJanela();
  }

  /** Bater na mesa: só quem acabou de pedir seis/nove/doze, uma vez por pedido, dentro da janela. */
  batida(id: string, forcaCrua: unknown): void {
    const c = this.cadeiraDe(id);
    const forca = forcaDaBatida(forcaCrua);
    const p = this.pedidoBatida;
    if (c === null || !this.estado || forca === null || !p || p.cadeira !== c) return;
    if (this.relogio.agora() > p.ate || !this.podeMandar(c)) return;
    this.pedidoBatida = null;
    this.bater(c, forca);
    this.enviarEstados();
  }

  /** Chat de texto (só na privada, salvo `chat`); vale também na sala de espera. */
  chat(id: string, cru: unknown): void {
    const c = this.cadeiraDe(id);
    if (c === null) return;
    if (!(this.o.chat ?? this.o.modo === 'privada')) {
      this.erro(id, 'chat só em mesa privada');
      return;
    }
    const texto = limparChat(cru);
    if (!texto) return;
    const agora = this.relogio.agora();
    if (agora - this.ultimoChat[c] < this.tempos.intervaloMensagemMs) {
      this.erro(id, 'calma: uma mensagem por segundo');
      return;
    }
    this.ultimoChat[c] = agora;
    const msg: MsgChat = { de: c, nome: this.ocupantes[c].nome ?? 'Jogador', texto };
    this.paraHumanos((destino) => this.o.enviar(destino, 'chat', msg));
  }

  // ---------- internos ----------

  /** Aplica a ação com a sorte do servidor; devolve se deu certo. Erro de humano vai para ele; de bot, para `aoErro`. */
  private aplicar(pedida: AcaoJogador, idHumano?: string): boolean {
    if (!this.estado) return false;
    const antes = this.estado;
    if (pedida.tipo === 'jogar' && this.janelaAberta()) {
      if (idHumano) this.erro(idHumano, 'espere: ainda é a hora de pedir família');
      return false;
    }
    if (pedida.tipo === 'familia' && idHumano && this.janela && !this.janelaAberta()) {
      this.erro(idHumano, 'a janela de família já terminou');
      return false;
    }
    const fechaEtapa = !ehFaseRitual(antes.fase) && quemDeveAgir(antes).includes(pedida.cadeira);
    const acao = completarSorte(semSorte(pedida), antes, this.rand);
    try {
      this.estado = reduce(antes, acao);
    } catch (e) {
      if (idHumano) this.erro(idHumano, e instanceof ErroJogada ? e.message : 'erro interno');
      if (!idHumano || !(e instanceof ErroJogada)) this.falha(e);
      return false;
    }
    this.versao++;
    if (fechaEtapa) this.etapa++;
    try {
      this.o.aoAplicar?.(semSorte(acao), idHumano !== undefined);
    } catch (e) {
      this.falha(e);
    }
    this.paraHumanos((destino) => this.o.enviar(destino, 'acao', msgDaAcao(acao, antes)));
    this.pedidoBatida = null;
    if (pedidoQueBate(acao, this.estado)) {
      if (idHumano !== undefined) this.pedidoBatida = { cadeira: acao.cadeira, ate: this.relogio.agora() + JANELA_BATIDA_MS };
      else if (!this.ocupantes[acao.cadeira].humano) {
        const forca = decidirBatidaBot(this.rand, this.o.chanceBatidaBot);
        if (forca !== null) this.bater(acao.cadeira, forca);
      }
    }
    if (acao.tipo === 'jogar') this.comentarRodada(antes, this.estado);
    if (acao.tipo === 'distribuir') {
      this.dicas = [null, null, null, null];
      this.familiaDecidida.clear();
      this.janela =
        this.tempos.janelaFamiliaMs > 0 && janelaDeFamilia(this.estado)
          ? { ate: this.relogio.agora() + this.tempos.distribuicaoMs + this.tempos.janelaFamiliaMs, decidiram: new Set(), fechada: false, pausadaEm: null }
          : null;
      this.sinaisDosBots();
    }
    // Pedir família não encerra a participação: o jogador ainda pode pedir outra
    // dentro do limite de três fechadas da mesa, até escolher "Sem família".
    // Durante a conferência dos adversários, o relógio da janela fica pausado.
    if (acao.tipo === 'familia' && this.janela && this.estado.fase === 'conferindoFamilia') {
      this.janela.pausadaEm ??= this.relogio.agora();
    }
    if (acao.tipo === 'conferir' && this.janela && this.janela.pausadaEm !== null) {
      this.janela.ate += this.relogio.agora() - this.janela.pausadaEm;
      this.janela.pausadaEm = null;
    }
    // Quem pediu família trocou as cartas: o sinal que o parceiro tinha não vale mais.
    if (acao.tipo === 'familia') this.dicas[parceiroDe(acao.cadeira)] = null;
    this.atualizar();
    return true;
  }

  /**
   * Reagenda timers e prazo conforme quem deve agir e reenvia os estados.
   * Se nada relevante mudou (ver `chaveDoTurno`) só reenvia — quem cai/volta sem
   * ser da vez, a família de um bot fora da vez ou mais uma embaralhada não mexem
   * no prazo do humano. `forcar` reagenda mesmo assim (recuperação de falhas).
   */
  private atualizar(forcar = false): void {
    const s = this.estado;
    // Após três fechadas, quem não tem uma família verdadeira só poderia
    // passar. O servidor registra a decisão automaticamente, sem esperar o timer.
    if (s?.mao && this.janela && !this.janela.fechada &&
        janelaDeFamilia(s) && fechadasUsadas(s.mao) >= LIMITE_FAMILIAS_FECHADAS) {
      for (const c of CADEIRAS) {
        if (this.humanoAtivo(c) && !this.janela.decidiram.has(c) &&
            !ehFamilia(s.mao.maos[c])) this.janela.decidiram.add(c);
      }
      if (!this.janelaAberta()) this.janela.fechada = true;
    }
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
    if (s.fase === 'aguardandoMonte') {
      this.agendar(this.tempos.pausaMaoMs, () => this.porMonte());
      this.enviarEstados();
      return;
    }
    // Hora de pedir família: ninguém joga; os bots (até o da vez) decidem a família e o relógio
    // fecha a janela no fim (ou antes, quando todos os humanos decidirem).
    if (this.janelaAberta()) {
      const faltam = CADEIRAS.filter((c) => this.humanoAtivo(c) && !this.janela!.decidiram.has(c));
      this.prazo = { cadeiras: faltam, ate: this.janela!.ate };
      this.agendar(Math.max(0, this.janela!.ate - this.relogio.agora()), () => this.fecharJanela());
      this.familiasDosBots(s, []);
      this.enviarEstados();
      return;
    }
    // Cangada: os quatro empilham ao mesmo tempo (as duas duplas). Bots no ritmo deles; humanos
    // têm um prazo só, e quem não empilhar até lá empilha a mais forte por cima.
    if (s.fase === 'empilhando') {
      const agora = this.relogio.agora();
      this.ateEmpilhar ??= agora + this.tempos.jogadaMs;
      const faltam = quemDeveAgir(s);
      const humanos = faltam.filter((c) => this.humanoNaVez(c));
      if (humanos.length > 0) {
        this.prazo = { cadeiras: humanos, ate: this.ateEmpilhar };
        this.agendar(Math.max(0, this.ateEmpilhar - agora), () => {
          for (const c of humanos) if (this.estado?.fase === 'empilhando' && quemDeveAgir(this.estado).includes(c)) this.agirPor(c);
        });
      }
      for (const c of faltam) if (!this.humanoNaVez(c)) this.agendar(this.tempos.botMs, () => this.jogarBot(c));
      this.enviarEstados();
      return;
    }
    this.ateEmpilhar = null;
    // Os agentes são sempre de uma só dupla (ou uma cadeira, no ritual). Havendo humano ativo
    // entre eles, ninguém decide por ele: espera o prazo; no fim, o parceiro bot (se houver) decide.
    const agentes = quemDeveAgir(s);
    const humanos = agentes.filter((c) => this.humanoNaVez(c));
    if (humanos.length > 0) {
      const ms = this.prazoMs(s);
      const substituto = agentes.find((c) => !this.humanoNaVez(c));
      this.prazo = { cadeiras: humanos, ate: this.relogio.agora() + ms };
      this.agendar(ms, () => (substituto !== undefined ? this.jogarBot(substituto) : this.estourouTempo(humanos[0])));
    } else {
      const ms = this.atrasoBot(s);
      for (const c of agentes) this.agendar(ms, () => this.jogarBot(c));
    }
    this.familiasDosBots(s, agentes);
    this.enviarEstados();
  }

  /**
   * Na janela de família, os bots fora da vez também podem pedir (`quemDeveAgir` só devolve
   * a vez). Cada bot decide uma vez por mão; só uma ação `familia` do próprio bot é aplicada.
   * Cadeira de humano (mesmo desconectado) nunca: bot não pede família por humano.
   */
  private familiasDosBots(s: EstadoPartida, agentes: Cadeira[]): void {
    if (!janelaDeFamilia(s)) return;
    for (const c of CADEIRAS) {
      if (agentes.includes(c) || this.ocupantes[c].humano || this.familiaDecidida.has(c)) continue;
      this.agendar(this.tempos.botMs, () => this.familiaDoBot(c));
    }
  }

  /** Janela de família aberta agora: dentro do prazo, mão ainda na hora de família e algum humano por decidir. */
  private janelaAberta(): boolean {
    const j = this.janela;
    if (!j || j.fechada || !this.estado || !janelaDeFamilia(this.estado)) return false;
    if (this.relogio.agora() >= j.ate) return false;
    return CADEIRAS.some((c) => this.humanoAtivo(c) && !j.decidiram.has(c));
  }

  private conferirFimDaJanela(): void {
    if (this.janela && !this.janela.fechada && !this.janelaAberta()) this.fecharJanela();
    else this.atualizar();
  }

  private fecharJanela(): void {
    if (!this.janela || this.janela.fechada) return;
    this.janela.fechada = true;
    this.atualizar(true);
  }

  private familiaDoBot(c: Cadeira): void {
    const s = this.estado;
    if (!s || !janelaDeFamilia(s) || this.ocupantes[c].humano || this.familiaDecidida.has(c)) return;
    // Marcado já aqui, antes de saber se pede: o bot fora da vez que trocou as cartas por família
    // não reavalia as 3 novas nesta mão (`familiaDecidida` só limpa na mão seguinte). Aceitável:
    // as 3 cartas de reposição formarem outra família é raro, o limite de fechadas por mão é
    // compartilhado pela mesa, e reavaliar a cada mudança de estado reagendaria timers sem fim
    // (e deixaria o bot encadear famílias mais rápido do que um humano consegue reagir). O bot
    // da vez continua reavaliando: `decidirBot` passa por `querFamilia` a cada jogada dele.
    this.familiaDecidida.add(c);
    let a: AcaoJogador | null = null;
    try {
      a = this.decidirBot(s, c);
    } catch (e) {
      this.falha(e);
    }
    if (a?.tipo === 'familia' && a.cadeira === c) this.aplicar(a);
  }

  /** Aplica a batida ao tampo e avisa todos (o estado novo vai no próximo `estado`). */
  private bater(c: Cadeira, forca: number): void {
    const r = aplicarBatida(this.fisica, c, forca, this.rand);
    this.fisica = r.fisica;
    const msg: MsgBatida = { de: c, forca };
    if (r.rachadura) msg.rachadura = r.rachadura;
    if (r.quebrou) msg.quebrou = true;
    this.paraHumanos((destino) => this.o.enviar(destino, 'batida', msg));
  }

  /**
   * Situação dos timers. Com humano entre os agentes, vale a etapa (o prazo fica o mesmo enquanto
   * fase, agentes e `etapa` não mudarem); só com bots, cada mudança do jogo reagenda o próximo passo.
   */
  private chaveDoTurno(s: EstadoPartida): string {
    const agentes = quemDeveAgir(s);
    const marcas = agentes.map((c) => `${c}${this.humanoNaVez(c) ? 'h' : 'b'}`);
    const marco = agentes.some((c) => this.humanoNaVez(c)) ? `e${this.etapa}` : `v${this.versao}`;
    const j = this.janelaAberta() ? `|jf${[...this.janela!.decidiram].join('')}` : '';
    return `${marco}|${s.fase}|${marcas.join(',')}${j}`;
  }

  /** Prazo do humano: etapa do ritual (+ a pausa do resumo, na 1ª de uma mão nova), conferir família ou jogada. */
  private prazoMs(s: EstadoPartida): number {
    if (this.inicioDeMaoNova(s)) return this.tempos.ritualMs + this.tempos.pausaMaoMs;
    if (ehFaseRitual(s.fase)) return this.tempos.ritualMs;
    if (s.fase === 'conferindoFamilia') return this.tempos.conferirMs;
    return this.tempos.jogadaMs;
  }

  /** Espera do bot. A 1ª embaralhada de uma mão nova espera a pausa (o resumo da mão anterior aparece). */
  private atrasoBot(s: EstadoPartida): number {
    if (this.inicioDeMaoNova(s)) return this.tempos.pausaMaoMs;
    // Depois da janela de família a distribuição já acabou faz tempo: a vez joga no ritmo normal.
    if (this.janela?.fechada) return this.tempos.botMs;
    // Só bots na mesa (sem janela aberta): a vez ainda espera a janela, para a família dos bots sair antes.
    if (this.janela && janelaDeFamilia(s)) return Math.max(this.tempos.botMs, this.janela.ate - this.relogio.agora());
    // Cartas acabaram de ser dadas: espera a distribuição (animada no cliente) chegar às mãos.
    if (acabouDeDar(s)) return Math.max(this.tempos.botMs, this.tempos.distribuicaoMs);
    return this.tempos.botMs;
  }

  /** Monte ainda sem embaralhar numa mão que não é a 1ª: o resumo da mão anterior está na tela. */
  private inicioDeMaoNova(s: EstadoPartida): boolean {
    return s.fase === 'embaralhando' && s.ritual?.embaralhadas === 0 && !!s.ultimaMao;
  }

  /** 1ª mão: o servidor põe o monte sorteado na mesa. */
  private porMonte(): void {
    if (!this.estado) return;
    try {
      this.estado = reduce(this.estado, { tipo: 'monte', baralho: embaralhar(baralhoDaMesa(this.estado.regras), this.rand) });
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
    // Jogando por um humano desconectado: a carta sim, a família não.
    if (escolhida?.tipo === 'familia' && this.ocupantes[c].humano) escolhida = null;
    if (escolhida && this.aplicar(escolhida)) return;
    this.agirPor(c);
  }

  /** Tempo esgotado. No ritual faz a etapa inteira de uma vez (ex.: 3 embaralhadas e passa). */
  private estourouTempo(c: Cadeira): void {
    for (let i = 0; i < 8; i++) {
      const versao = this.versao;
      this.agirPor(c);
      const s = this.estado;
      if (!s || this.versao === versao || !ehFaseRitual(s.fase) || !quemDeveAgir(s).includes(c)) return;
    }
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
      modo: this.o.modo ?? 'classica',
      regras: this.o.regras,
      chanceInterceptarSinal: this.o.chanceInterceptarSinal ?? 0,
      sinais: this.o.sinais !== false,
      humanosEsperados: this.o.humanosEsperados,
      visao: s ? visaoDoJogador(s, c) : null,
      prazo: this.prazo,
      janelaFamilia: this.janelaAberta() ? { ate: this.janela!.ate, decidiram: [...this.janela!.decidiram] } : null,
      revanche: this.podeRevanche() ? { votos: [...this.votosRevanche], faltam: this.faltamRevanche() } : null,
      minhasAcoes: s ? acoesValidas(s, c).filter((a) =>
        (a.tipo !== 'jogar' || !this.janelaAberta()) &&
        (a.tipo !== 'familia' || !this.janela || this.janelaAberta())
      ) : [],
      mesaFisica: this.fisica,
      cacife: this.cacife,
      eloCongelado: this.eloCongelado || undefined,
    };
    this.o.enviar(this.ocupantes[c].id!, 'estado', msg);
  }

  private infoCadeiras(): InfoCadeira[] {
    return this.ocupantes.map((o) => ({
      tipo: o.humano ? 'humano' : o.nome ? 'bot' : 'vazia',
      nome: o.nome,
      conectado: o.humano ? o.conectado : true,
      avatar: o.avatar ?? null,
      voz: o.voz ?? null,
      visual: o.humano ? (o.visual ?? null) : null,
    }));
  }

  /** Cacife pedido pela mesa (0 = sem); o efetivo chega com `definirCacife` depois do início. */
  private cacife: CacifeMesa | null = null;

  configurarCacife(pedido: number): void {
    this.cacife = pedido > 0 ? { pedido, efetivo: null, pote: 0 } : null;
  }

  /** Ranqueada gravada com o Elo congelado (mesmo grupo de contas em 24 h): a tela de fim avisa. */
  private eloCongelado = false;

  definirEloCongelado(): void {
    this.eloCongelado = true;
    this.enviarEstados();
  }

  /** O início foi gravado: quanto cada um pagou e o pote (efetivo 0 = a partida corre sem Fichas). */
  definirCacife(efetivo: number, pote: number): void {
    if (!this.cacife) return;
    this.cacife = { ...this.cacife, efetivo, pote };
    this.enviarEstados();
  }

  /** Cada bot conta ao parceiro sua melhor carta (só em mão normal: na de 10/11 não faz sentido). */
  private sinaisDosBots(): void {
    const s = this.estado;
    if (!s?.mao || s.mao.tipo !== 'normal') return;
    if (this.o.sinais === false || !(this.o.sinaisBot ?? this.o.nivelBot === 'dificil')) return;
    for (const c of CADEIRAS) {
      if (this.ocupantes[c].humano) continue;
      this.enviarSinal(c, sinalDaMao(s.mao.maos[c], s.regras.variante, s.mao.vira));
    }
  }

  /** Entrega o sinal ao parceiro (humano), sorteia interceptações e guarda a dica do parceiro. */
  private enviarSinal(c: Cadeira, sinal: Sinal): void {
    const s = this.estado;
    const parceiro = parceiroDe(c);
    this.dicas[parceiro] = s?.mao ? cartaDoSinal(sinal, s.regras.variante, s.mao.vira) : null;
    const chance = this.o.chanceInterceptarSinal ?? 0;
    for (const alvo of CADEIRAS) {
      if (alvo === c || !this.humanoAtivo(alvo)) continue;
      if (alvo === parceiro) this.o.enviar(this.ocupantes[alvo].id!, 'sinal', { de: c, sinal });
      else if (chance > 0 && this.rand() < chance) {
        this.o.enviar(this.ocupantes[alvo].id!, 'sinal', { de: c, sinal, interceptado: true });
      }
    }
  }

  /** Às vezes um bot comenta a rodada que acabou de fechar. */
  private comentarRodada(antes: EstadoPartida, depois: EstadoPartida): void {
    const chance = this.o.chanceFalaBot ?? 0;
    if (chance <= 0) return;
    const r = rodadaFechada(antes, depois);
    if (r === null || r === 'empate') return;
    const c = CADEIRAS.find((x) => !this.ocupantes[x].humano && this.rand() < chance);
    if (c === undefined) return;
    const fala = falaDaRodada(r, c, this.rand());
    if (fala && this.podeMandar(c)) this.paraHumanos((destino) => this.o.enviar(destino, 'fala', { de: c, fala }));
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

  /**
   * Humano sentado, conectado ou não: na vez dele vale o prazo do humano. Quem caiu (troca de
   * app, rede) tem o mesmo prazo de quem está parado e, no fim, a mesma ação padrão; antes o bot
   * jogava por ele no ritmo do bot. A cadeira só vira bot de vez quando a reconexão expira (onLeave).
   */
  private humanoNaVez(c: Cadeira): boolean {
    const o = this.ocupantes[c];
    return o.humano && o.id !== null;
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

/** Mão recém-distribuída: ninguém jogou, pediu truco nem família ainda. */
function acabouDeDar(s: EstadoPartida): boolean {
  const m = s.mao;
  return s.fase === 'jogando' && !!m && m.rodadas.length === 0 && m.mesa.length === 0 && m.nivel === 0 && m.familias.length === 0;
}
