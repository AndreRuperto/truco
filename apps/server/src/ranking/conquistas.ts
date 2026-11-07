import type { Conquista } from '../api/tipos';
import { PATENTES } from './elo';

/** Totais de quem tem conta, somados das partidas terminadas (não abandonadas). */
export interface TotaisConquista {
  jogos: number;
  vitorias: number;
  trucosPedidos: number;
  trucosAceitos: number;
  ranqueadas: number;
  /** Quantas variantes diferentes já jogou (0..2). */
  variantes: number;
  privadas: number;
  /** Vitórias por 12 a 0. */
  lavadas: number;
  /** Maior pontuação de patente entre as variantes. */
  pontos: number;
}

const minimo = (nome: (typeof PATENTES)[number]['nome']) => PATENTES.find((p) => p.nome === nome)!.minimo;

/**
 * As conquistas do perfil: saem das partidas já gravadas (nada novo no banco). `progresso`
 * quando a conquista conta algo; `alcancada` quando chegou na meta.
 */
export function conquistasDe(t: TotaisConquista): Conquista[] {
  const meta = (id: string, nome: string, descricao: string, atual: number, alvo: number): Conquista => ({
    id,
    nome,
    descricao,
    alcancada: atual >= alvo,
    progresso: alvo > 1 ? { atual: Math.min(atual, alvo), meta: alvo } : null,
  });
  return [
    meta('primeira-vitoria', 'Primeira vitória', 'Ganhe uma partida.', t.vitorias, 1),
    meta('frequentador', 'Freguês da casa', 'Termine 10 partidas.', t.jogos, 10),
    meta('dono-da-mesa', 'Dono da mesa', 'Ganhe 25 partidas.', t.vitorias, 25),
    meta('lavada', 'Lavada', 'Ganhe uma partida de 12 a 0.', t.lavadas, 1),
    meta('trucador', 'Trucador', 'Peça truco 20 vezes.', t.trucosPedidos, 20),
    meta('peito-de-aco', 'Peito de aço', 'Aceite 10 trucos.', t.trucosAceitos, 10),
    meta('com-a-turma', 'Com a turma', 'Termine uma partida em mesa privada.', t.privadas, 1),
    meta('dois-sotaques', 'Dois sotaques', 'Jogue paulista e mineiro.', t.variantes, 2),
    meta('estreia', 'Estreia na ranqueada', 'Termine uma partida ranqueada.', t.ranqueadas, 1),
    meta('prata', 'Patente Prata', `Chegue a ${minimo('Prata')} pontos numa variante.`, t.pontos, minimo('Prata')),
    meta('ouro', 'Patente Ouro', `Chegue a ${minimo('Ouro')} pontos numa variante.`, t.pontos, minimo('Ouro')),
  ];
}
