import type { Cadeira, Variante } from '@truco/engine';
import type { Formato, MsgStatusFila } from '../api/tipos';
import { media } from '../ranking/elo';

export interface EntradaFila {
  /** sessionId do cliente na sala `fila`. */
  id: string;
  usuarioId: number;
  apelido: string;
  elo: number;
  variante: Variante;
  formato: Formato;
  /** Só no 2x2: amigos que digitam o mesmo código ficam parceiros. */
  codigoDupla: string | null;
  /** Epoch ms de entrada. */
  desde: number;
}

export interface Pareamento {
  variante: Variante;
  formato: Formato;
  times: [EntradaFila[], EntradaFila[]];
}

export const FAIXA_INICIAL = 100;
export const PASSO_FAIXA = 50;
export const INTERVALO_FAIXA_MS = 15_000;
export const FAIXA_MAXIMA = 1000;

/** Diferença de Elo aceita para quem espera há `esperaMs`. */
export function faixa(esperaMs: number): number {
  return Math.min(FAIXA_MAXIMA, FAIXA_INICIAL + PASSO_FAIXA * Math.floor(Math.max(0, esperaMs) / INTERVALO_FAIXA_MS));
}

export function normalizarCodigoDupla(cru: unknown): string | null {
  if (typeof cru !== 'string') return null;
  const c = cru.trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(c) ? c : null;
}

interface Grupo {
  membros: EntradaFila[];
  elo: number;
  desde: number;
  /** Dupla montada pela fila com dois avulsos (sem código). */
  avulsa?: boolean;
}

const grupo = (membros: EntradaFila[], avulsa = false): Grupo => ({
  membros,
  elo: media(membros.map((m) => m.elo)),
  desde: Math.min(...membros.map((m) => m.desde)),
  avulsa,
});

/** Quatro avulsos: maior + menor Elo contra os dois do meio (médias o mais perto possível). */
function equilibrar(quatro: EntradaFila[]): [EntradaFila[], EntradaFila[]] {
  const [w, x, y, z] = [...quatro].sort((p, q) => p.elo - q.elo || p.desde - q.desde);
  return [
    [w, z],
    [x, y],
  ];
}

function cabem(a: Grupo, b: Grupo, agora: number): boolean {
  return Math.abs(a.elo - b.elo) <= Math.max(faixa(agora - a.desde), faixa(agora - b.desde));
}

/** Guloso: o grupo mais antigo escolhe o mais próximo em Elo que caiba na faixa. */
function casar(grupos: Grupo[], agora: number): [Grupo, Grupo][] {
  const livres = [...grupos].sort((x, y) => x.desde - y.desde || x.elo - y.elo);
  const pares: [Grupo, Grupo][] = [];
  while (livres.length > 1) {
    const a = livres.shift()!;
    let melhor = -1;
    for (let i = 0; i < livres.length; i++) {
      if (!cabem(a, livres[i], agora)) continue;
      if (melhor < 0 || Math.abs(livres[i].elo - a.elo) < Math.abs(livres[melhor].elo - a.elo)) melhor = i;
    }
    if (melhor >= 0) pares.push([a, livres.splice(melhor, 1)[0]]);
  }
  return pares;
}

/** Pareamentos possíveis agora (função pura; a `Fila` tira os pareados). */
export function parear(entradas: readonly EntradaFila[], agora: number): Pareamento[] {
  const out: Pareamento[] = [];
  const chaves = [...new Set(entradas.map((x) => `${x.variante}|${x.formato}`))].sort();
  for (const chave of chaves) {
    const [variante, formato] = chave.split('|') as [Variante, Formato];
    const lista = entradas.filter((x) => x.variante === variante && x.formato === formato);
    if (formato === '1x1') {
      for (const [a, b] of casar(lista.map((x) => grupo([x])), agora)) out.push({ variante, formato, times: [a.membros, b.membros] });
      continue;
    }
    const porCodigo = new Map<string, EntradaFila[]>();
    const solos: EntradaFila[] = [];
    for (const x of lista) {
      if (x.codigoDupla) porCodigo.set(x.codigoDupla, [...(porCodigo.get(x.codigoDupla) ?? []), x]);
      else solos.push(x);
    }
    const times: Grupo[] = [];
    for (const membros of porCodigo.values()) {
      if (membros.length >= 2) times.push(grupo([...membros].sort((p, q) => p.desde - q.desde).slice(0, 2)));
    }
    for (const [a, b] of casar(solos.map((x) => grupo([x])), agora)) times.push(grupo([...a.membros, ...b.membros], true));
    for (const [a, b] of casar(times, agora)) {
      // Os quatro escolhidos são avulsos: a divisão em duplas é livre, então equilibra.
      const t = a.avulsa && b.avulsa ? equilibrar([...a.membros, ...b.membros]) : ([a.membros, b.membros] as [EntradaFila[], EntradaFila[]]);
      out.push({ variante, formato, times: t });
    }
  }
  return out;
}

/** 1x1: cadeiras 0 e 1 (bots nas 2 e 3, parceiros). 2x2: dupla A em 0/2, B em 1/3. */
export function cadeirasDoPareamento(p: Pareamento): { entrada: EntradaFila; cadeira: Cadeira }[] {
  const [a, b] = p.times;
  if (p.formato === '1x1') {
    return [
      { entrada: a[0], cadeira: 0 },
      { entrada: b[0], cadeira: 1 },
    ];
  }
  return [
    { entrada: a[0], cadeira: 0 },
    { entrada: a[1], cadeira: 2 },
    { entrada: b[0], cadeira: 1 },
    { entrada: b[1], cadeira: 3 },
  ];
}

export class Fila {
  private readonly entradas = new Map<string, EntradaFila>();

  /**
   * Entra. Se o mesmo usuário já estava (outra aba), tira e devolve a entrada antiga.
   * Lança se o código de dupla (mesma variante e formato) já tem dois outros jogadores.
   */
  entrar(e: EntradaFila): EntradaFila | null {
    if (e.formato === '2x2' && e.codigoDupla) {
      let mesmos = 0;
      for (const x of this.entradas.values()) {
        if (x.usuarioId !== e.usuarioId && x.variante === e.variante && x.formato === e.formato && x.codigoDupla === e.codigoDupla) mesmos++;
      }
      if (mesmos >= 2) throw new Error('código de dupla já tem dois jogadores; combine outro código');
    }
    let antiga: EntradaFila | null = null;
    for (const x of this.entradas.values()) if (x.usuarioId === e.usuarioId) antiga = x;
    if (antiga) this.entradas.delete(antiga.id);
    this.entradas.set(e.id, e);
    return antiga;
  }

  sair(id: string): boolean {
    return this.entradas.delete(id);
  }

  get tamanho(): number {
    return this.entradas.size;
  }

  /** Pareia e tira da fila quem foi pareado. */
  rodada(agora: number): Pareamento[] {
    const ps = parear([...this.entradas.values()], agora);
    for (const p of ps) for (const t of p.times) for (const x of t) this.entradas.delete(x.id);
    return ps;
  }

  /** Recoloca (ex.: a mesa não pôde ser criada), mantendo o tempo de espera. */
  devolver(p: Pareamento): void {
    for (const t of p.times) for (const x of t) this.entradas.set(x.id, x);
  }

  status(id: string, agora: number): MsgStatusFila | null {
    const e = this.entradas.get(id);
    if (!e) return null;
    const mesma = [...this.entradas.values()].filter((x) => x.variante === e.variante && x.formato === e.formato);
    const aguardandoParceiro = e.formato === '2x2' && e.codigoDupla !== null && mesma.filter((x) => x.codigoDupla === e.codigoDupla).length < 2;
    return { esperaS: Math.floor((agora - e.desde) / 1000), faixa: faixa(agora - e.desde), naFila: mesma.length, aguardandoParceiro };
  }
}
