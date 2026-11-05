import type { RegrasMesa } from '@truco/engine';
import { SINAIS, type Sinal } from '@truco/protocolo';

/** Emote e descrição de cada sinal (design: piscar = zap, sobrancelha = copas, boca torta = espadilha...). */
export const INFO_SINAL: Record<Sinal, { emoji: string; descricao: string }> = {
  zap: { emoji: '😉', descricao: 'Piscar — Zap' },
  copas: { emoji: '🤨', descricao: 'Sobrancelha — Copas' },
  espadilha: { emoji: '😏', descricao: 'Boca torta — Espadilha' },
  picafumo: { emoji: '😤', descricao: 'Bochecha — Pica-fumo' },
  coringa: { emoji: '😆', descricao: 'Piscar os dois olhos — Coringa' },
  tres: { emoji: '😛', descricao: 'Língua — tenho 3' },
  dois: { emoji: '😗', descricao: 'Biquinho — tenho 2' },
  as: { emoji: '🙄', descricao: 'Olhar pra cima — tenho Ás' },
  nada: { emoji: '😐', descricao: 'Cara fechada — nada' },
};

/** A mesa joga com coringas (mineiro com mão limpa). */
export const temCoringa = (regras: Pick<RegrasMesa, 'variante' | 'maoLimpa'>): boolean =>
  regras.variante === 'mineiro' && regras.maoLimpa === true;

/** Os sinais oferecidos: o de coringa só quando há coringa no baralho. */
export function sinaisDisponiveis(comCoringa: boolean): Sinal[] {
  return SINAIS.filter((s) => comCoringa || s !== 'coringa');
}

export interface SinalRecebido {
  sinal: Sinal;
  interceptado: boolean;
  nome: string;
}

export function textoSinalRecebido(s: SinalRecebido): string {
  const info = INFO_SINAL[s.sinal];
  const quem = s.interceptado ? `Interceptado de ${s.nome}` : `${s.nome} (parceiro)`;
  return `${quem}: ${info.emoji} ${info.descricao}`;
}
