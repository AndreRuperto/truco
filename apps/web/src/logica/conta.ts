import type { ItemHistorico } from '@truco/api';
import type { Variante } from '@truco/engine';
import type { ModoMesa } from '@truco/protocolo';

export const NOME_VARIANTE: Record<Variante, string> = { paulista: 'Paulista', mineiro: 'Mineiro' };

export const NOME_MODO: Record<ModoMesa, string> = { classica: 'Clássica', desafio: 'Desafio', privada: 'Privada', ranqueada: 'Ranqueada' };

export function textoResultado(p: Pick<ItemHistorico, 'venceu' | 'abandonou' | 'terminadaEm'>): string {
  if (p.abandonou) return 'Abandonou';
  if (p.venceu === true) return 'Vitória';
  if (p.venceu === false) return 'Derrota';
  return p.terminadaEm ? '—' : 'Em andamento';
}

export function textoDelta(d: number | null): string {
  if (d === null) return '';
  if (d > 0) return `+${d}`;
  return d < 0 ? `−${-d}` : '0';
}

export function formatarEspera(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Mensagens do `onAuth` da sala `fila` em português de gente. */
export function textoErroFila(msg: string): string {
  const m = msg.match(/bloqueada até (\S+)/);
  if (m) {
    const d = new Date(m[1]);
    if (!Number.isNaN(d.getTime())) {
      return `Fila bloqueada até ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por abandono de partida ranqueada.`;
    }
  }
  if (/entre na sua conta/.test(msg)) return 'Entre na sua conta para jogar ranqueada.';
  return `Não foi possível entrar na fila: ${msg}`;
}
