import type { RegrasMesa, Variante } from '@truco/engine';
import type { ModoMesa, NivelBot, TempoFamiliaS } from '../mesa/protocolo';

export type Formato = '1x1' | '2x2';

export interface UsuarioApi {
  id: number;
  apelido: string;
  email: string | null;
  /** Conta ligada a um login do Google. */
  google: boolean;
  /** Foto de perfil: `pronto:<id>` (um dos `AVATARES_PRONTOS`), uma imagem `data:` pequena, ou null. */
  avatar?: string | null;
  /** Está em `ADMIN_EMAILS`: o menu mostra "Admin". Só um atalho de tela; o servidor confere de novo. */
  admin?: boolean;
}

/** Avatares desenhados que o site oferece (os desenhos ficam no web). */
export const AVATARES_PRONTOS = ['zap', 'copas', 'espadilha', 'ouros', 'chope', 'chapeu', 'galo', 'viola', 'ferradura', 'lua'] as const;
export type AvatarPronto = (typeof AVATARES_PRONTOS)[number];

/** O que a tela inicial lembra entre visitas (na conta, para quem entrou). */
export interface PreferenciasMesa {
  variante: Variante;
  pontuacao: RegrasMesa['pontuacao'];
  maoDe10: boolean;
  maoDe11: RegrasMesa['maoDe11'];
  familia: RegrasMesa['familia'];
  maoLimpa: boolean;
  humanos: number;
  nivelBot: NivelBot;
  chanceInterceptarSinal: number;
  tempoFamiliaS?: TempoFamiliaS;
  sinais?: boolean;
}

export interface ConfigApi {
  /** Client ID do Google (liga o botão) ou null. */
  google: string | null;
  /** Caixa de saída de teste ativa (E2E). */
  emailTeste: boolean;
}

export interface RatingVariante {
  elo: number;
  pontos: number;
  patente: string;
  proxima: { nome: string; faltam: number } | null;
  partidasRanqueadas: number;
  jogos: number;
  vitorias: number;
  /** Aceitos ÷ respostas a truco, em %; null sem respostas. */
  pctTrucoAceito: number | null;
  corridas: number;
}

export interface PerfilApi {
  usuario: { id: number; apelido: string; avatar?: string | null };
  variantes: Record<Variante, RatingVariante>;
  /** Conquistas (só de quem tem conta; saem das partidas gravadas). */
  conquistas?: Conquista[];
}

export interface Conquista {
  id: string;
  nome: string;
  descricao: string;
  alcancada: boolean;
  /** Para as que contam algo (ex.: 7 de 10 partidas); null nas de uma vez só. */
  progresso: { atual: number; meta: number } | null;
}

export interface ItemHistorico {
  partidaId: number;
  variante: Variante;
  modo: ModoMesa;
  ranqueada: boolean;
  nos: number;
  eles: number;
  venceu: boolean | null;
  abandonou: boolean;
  deltaElo: number | null;
  iniciadaEm: string;
  terminadaEm: string | null;
}

export interface LinhaRanking {
  posicao: number;
  usuarioId: number;
  apelido: string;
  pontos: number;
  elo: number;
  patente: string;
  partidas: number;
}

export interface SalaAberta {
  id: string;
  modo: ModoMesa;
  variante: Variante;
  humanos: number;
  nivelBot: NivelBot;
  regras: RegrasMesa | null;
  ocupados: number;
  dono: string | null;
}

export interface MsgStatusFila {
  esperaS: number;
  faixa: number;
  /** Quantos estão na mesma fila (variante + formato). */
  naFila: number;
  aguardandoParceiro: boolean;
}

export interface MsgPareado {
  /** `ISeatReservation` do Colyseus, para `client.consumeSeatReservation`. */
  reserva: unknown;
}

// ---------- painel de admin ----------

export interface DiaAdmin {
  /** AAAA-MM-DD (UTC). */
  dia: string;
  usuarios: number;
  partidas: number;
}

export interface ResumoAdmin {
  usuarios: number;
  banidos: number;
  partidas: number;
  /** Salas abertas agora no Colyseus (qualquer modo). */
  mesasAtivas: number;
  /** Últimos 14 dias, do mais antigo ao de hoje (dias sem nada vêm com zero). */
  porDia: DiaAdmin[];
}

export interface UsuarioAdmin {
  id: number;
  apelido: string;
  email: string | null;
  google: boolean;
  avatar: string | null;
  criadoEm: string;
  banidoEm: string | null;
  admin: boolean;
  partidas: number;
}

export interface MesaAdmin {
  id: string;
  modo: ModoMesa | null;
  variante: Variante | null;
  ocupados: number;
  lugares: number;
  privada: boolean;
  /** Já começou (ou encheu): ninguém novo entra pela lista. */
  trancada: boolean;
  dono: string | null;
  criadaEm: string | null;
}

export interface JogadorPartidaAdmin {
  nome: string;
  usuarioId: number | null;
  humano: boolean;
  dupla: number;
  abandonou: boolean;
}

export interface PartidaAdmin {
  id: number;
  variante: Variante;
  modo: ModoMesa;
  ranqueada: boolean;
  placar: [number, number];
  vencedora: number | null;
  abandonada: boolean;
  iniciadaEm: string;
  terminadaEm: string | null;
  jogadores: JogadorPartidaAdmin[];
}
