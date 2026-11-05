import type { Sinal } from '@truco/protocolo';

/** Emote e descrição de cada sinal (design: piscar = zap, sobrancelha = copas, boca torta = espadilha...). */
export const INFO_SINAL: Record<Sinal, { emoji: string; descricao: string }> = {
  zap: { emoji: '😉', descricao: 'Piscar — Zap' },
  copas: { emoji: '🤨', descricao: 'Sobrancelha — Copas' },
  espadilha: { emoji: '😏', descricao: 'Boca torta — Espadilha' },
  picafumo: { emoji: '😤', descricao: 'Bochecha — Pica-fumo' },
  tres: { emoji: '😛', descricao: 'Língua — tenho 3' },
  dois: { emoji: '😗', descricao: 'Biquinho — tenho 2' },
  as: { emoji: '🙄', descricao: 'Olhar pra cima — tenho Ás' },
  nada: { emoji: '😐', descricao: 'Cara fechada — nada' },
};

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
