import { type Cadeira, mulberry32, REGRAS_RANQUEADA } from '@truco/engine';
import { vi } from 'vitest';
import { Mesa, type OpcoesMesa } from '../src/mesa/Mesa';
import type { MsgEstado } from '../src/mesa/protocolo';

export const TEMPOS = { jogadaMs: 1_000, botMs: 10, pausaMaoMs: 20, intervaloMensagemMs: 100, ritualMs: 1_000, conferirMs: 500, janelaFamiliaMs: 30, distribuicaoMs: 30 };

/** Regras padrão dos testes da Mesa: mineiro ranqueado sem família (família tem testes próprios). */
export const MINEIRO_SEM_FAMILIA = { ...REGRAS_RANQUEADA.mineiro, familia: 'off' as const };

export function criarMesa(extra: Partial<OpcoesMesa> = {}) {
  const caixa = new Map<string, { tipo: string; payload: any }[]>();
  const mesa = new Mesa({
    regras: MINEIRO_SEM_FAMILIA,
    nivelBot: 'facil',
    humanosEsperados: 1,
    rand: mulberry32(7),
    tempos: TEMPOS,
    enviar: (id, tipo, payload) => {
      if (!caixa.has(id)) caixa.set(id, []);
      caixa.get(id)!.push({ tipo, payload });
    },
    ...extra,
  });
  const de = (id: string, tipo: string): any[] => (caixa.get(id) ?? []).filter((m) => m.tipo === tipo).map((m) => m.payload);
  const estado = (id: string): MsgEstado | undefined => de(id, 'estado').at(-1);
  return { mesa, caixa, de, estado };
}

/** Avança o relógio falso em passos até `cond()` ser verdadeira. */
export function avancarAte(cond: () => boolean, passoMs = 10, maxMs = 600_000): void {
  for (let t = 0; t <= maxMs; t += passoMs) {
    if (cond()) return;
    vi.advanceTimersByTime(passoMs);
  }
  throw new Error('condição não atingida no tempo simulado');
}

/** A cadeira `c` de `id` tem prazo para jogar carta (não para uma etapa do ritual). */
export function vezDeJogar(t: ReturnType<typeof criarMesa>, id = 'a', c: Cadeira = 0): boolean {
  const e = t.estado(id);
  return e?.visao?.fase === 'jogando' && !!e.prazo?.cadeiras.includes(c);
}

/** Avança até o humano 'a' (cadeira 0) estar com o monte na `fase` (no embaralhar, antes da 1ª embaralhada). */
export function ateEtapa(t: ReturnType<typeof criarMesa>, fase: 'embaralhando' | 'cortando' | 'escolhendoDistribuicao'): void {
  avancarAte(() => {
    const v = t.estado('a')?.visao;
    if (!v?.ritual || v.fase !== fase) return false;
    const dono = fase === 'cortando' ? v.ritual.cortador : v.ritual.embaralhador;
    return dono === 0 && (fase !== 'embaralhando' || v.ritual.embaralhadas === 0);
  });
}
