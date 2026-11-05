// TEMPORÁRIO: cópia do contrato de `apps/server/src/api/tipos.ts` (Plano 4, Tarefa 6), que a frente
// servidor ainda não criou. Quando ele existir, aponte o alias `@truco/api` (vite.config.ts e
// tsconfig.json) para `../server/src/api/tipos.ts` e apague este arquivo.
import type { RegrasMesa, Variante } from '@truco/engine';
import type { ModoMesa, NivelBot } from '@truco/protocolo';

export type Formato = '1x1' | '2x2';

export interface UsuarioApi {
  id: number;
  apelido: string;
  email: string | null;
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
  usuario: { id: number; apelido: string };
  variantes: Record<Variante, RatingVariante>;
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
