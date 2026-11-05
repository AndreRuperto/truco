import { mulberry32, REGRAS_RANQUEADA } from '@truco/engine';
import { vi } from 'vitest';
import { Mesa, type OpcoesMesa } from '../src/mesa/Mesa';
import type { MsgEstado } from '../src/mesa/protocolo';

export const TEMPOS = { jogadaMs: 1_000, botMs: 10, pausaMaoMs: 20, intervaloMensagemMs: 100 };

export function criarMesa(extra: Partial<OpcoesMesa> = {}) {
  const caixa = new Map<string, { tipo: string; payload: any }[]>();
  const mesa = new Mesa({
    regras: REGRAS_RANQUEADA.mineiro,
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
