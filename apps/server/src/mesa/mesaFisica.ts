import type { AcaoJogador, Cadeira, EstadoPartida } from '@truco/engine';

/**
 * "Bater na mesa": estado físico do tampo durante a partida (só memória da `Mesa`).
 *
 * Coordenadas: `x`, `y` normalizados 0..1 no tampo, no referencial ABSOLUTO da mesa —
 * a cadeira 0 embaixo, 1 à direita, 2 em cima, 3 à esquerda (o que a cadeira 0 vê).
 * A UI gira para o ponto de vista de quem olha. `angulo` em graus (0 = para a direita,
 * sentido horário na tela, y para baixo).
 */
export type TipoMesa = 'madeira' | 'plastico';

export interface Rachadura {
  id: number;
  /** Quem bateu. */
  cadeira: Cadeira;
  x: number;
  y: number;
  angulo: number;
  /** Comprimento relativo ao lado do tampo (0..1). */
  tamanho: number;
  /** Semente do desenho (a UI gera a forma deterministicamente a partir dela). */
  semente: number;
}

export interface MesaFisica {
  tipo: TipoMesa;
  /** Na madeira são rachaduras; no plástico, amassados/arranhões. */
  rachaduras: Rachadura[];
  /** Soma de força² das batidas que racharam a madeira; ao chegar em `LIMITE_DANO` ela quebra. */
  dano: number;
}

export interface MsgBatida {
  de: Cadeira;
  forca: number;
  rachadura?: Rachadura;
  /** A madeira quebrou nesta batida (a mesa agora é de plástico). */
  quebrou?: boolean;
}

/** Abaixo disto a batida é só barulho. */
export const FORCA_MINIMA_RACHADURA = 0.3;
/** 1 batida máxima soma 1 de dano; ~0,8 soma 0,64: quebra em 3–4 batidas fortes. */
export const LIMITE_DANO = 2.5;
/** Quanto tempo depois do pedido (seis/nove/doze) a batida ainda vale. */
export const JANELA_BATIDA_MS = 3_000;
/** Marcas guardadas (as mais antigas somem): o plástico não quebra e a lista não pode crescer sem fim. */
export const MAX_RACHADURAS = 16;
export const CHANCE_BATIDA_BOT = 0.35;

export const mesaFisicaInicial = (): MesaFisica => ({ tipo: 'madeira', rachaduras: [], dano: 0 });

/** Força vinda do cliente: número finito, clampado a 0..1; qualquer outra coisa é recusada. */
export function forcaDaBatida(x: unknown): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  return Math.min(1, Math.max(0, x));
}

/** A ação (já aplicada, `depois`) foi um pedido de Seis, Nove ou Doze? Truco (nível 1) não bate. */
export function pedidoQueBate(acao: AcaoJogador, depois: Pick<EstadoPartida, 'mao'>): boolean {
  if (acao.tipo !== 'truco' && acao.tipo !== 'aumentar') return false;
  return (depois.mao?.trucoPendente?.proposto ?? 0) >= 2;
}

/** Bot que acabou de pedir seis/nove/doze: bate com chance `chance`, força 0,4–1. */
export function decidirBatidaBot(rand: () => number, chance = CHANCE_BATIDA_BOT): number | null {
  if (rand() >= chance) return null;
  return 0.4 + 0.6 * rand();
}

/** Gira um ponto 90° do referencial: o lado de baixo vai para a esquerda, a direita para baixo. */
function girar(x: number, y: number, angulo: number, vezes: number): [number, number, number] {
  for (let i = 0; i < vezes; i++) [x, y, angulo] = [1 - y, x, angulo + 90];
  return [x, y, ((angulo % 360) + 360) % 360];
}

function novaRachadura(id: number, cadeira: Cadeira, forca: number, rand: () => number): Rachadura {
  // Sorteada como se fosse do lado de baixo, depois levada ao lado de quem bateu.
  const bx = 0.2 + 0.6 * rand();
  const by = 0.84 + 0.08 * rand();
  const ba = -90 + (rand() - 0.5) * 70;
  const [x, y, angulo] = girar(bx, by, ba, (4 - cadeira) % 4);
  const tamanho = 0.12 + (0.26 * (forca - FORCA_MINIMA_RACHADURA)) / (1 - FORCA_MINIMA_RACHADURA);
  return { id, cadeira, x, y, angulo, tamanho, semente: Math.floor(rand() * 2 ** 31) };
}

/**
 * Aplica uma batida (força já clampada). Madeira: força ≥ 0,3 racha e soma `forca²` ao dano;
 * no `LIMITE_DANO` quebra — vira plástico, sem marcas e com dano zerado. Plástico: força ≥ 0,3
 * deixa marca, sem dano (não quebra).
 */
export function aplicarBatida(
  f: MesaFisica,
  cadeira: Cadeira,
  forca: number,
  rand: () => number,
): { fisica: MesaFisica; rachadura?: Rachadura; quebrou: boolean } {
  if (forca < FORCA_MINIMA_RACHADURA) return { fisica: f, quebrou: false };
  const id = (f.rachaduras.at(-1)?.id ?? 0) + 1;
  const rachadura = novaRachadura(id, cadeira, forca, rand);
  const rachaduras = [...f.rachaduras, rachadura].slice(-MAX_RACHADURAS);
  if (f.tipo === 'plastico') return { fisica: { ...f, rachaduras }, rachadura, quebrou: false };
  const dano = f.dano + forca * forca;
  if (dano >= LIMITE_DANO) return { fisica: { tipo: 'plastico', rachaduras: [], dano: 0 }, rachadura, quebrou: true };
  return { fisica: { tipo: 'madeira', rachaduras, dano }, rachadura, quebrou: false };
}
