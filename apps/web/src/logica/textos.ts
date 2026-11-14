import {
  type Cadeira,
  duplaDe,
  ESCADAS,
  limiteMaoEspecial,
  type RegrasMesa,
  type ResultadoRodada,
  type Visao,
  type VisaoResultadoMao,
} from '@truco/engine';

const NOMES_PEDIDO = ['Mão', 'Truco', 'Seis', 'Nove', 'Doze'] as const;

/** Nome do nível de aposta (0 = mão, 1 = truco, ..., 4 = doze). */
export const nomePedido = (nivel: number): string => NOMES_PEDIDO[Math.max(0, Math.min(4, nivel))];

export const valorMao = (regras: RegrasMesa, nivel: number): number => ESCADAS[regras.pontuacao][nivel];

/** Frase da barra de ações durante um pedido: "Pediram Truco! Vale 3." / "Pedimos ...". */
export function textoPedidoPendente(v: Visao): string | null {
  const p = v.mao?.trucoPendente;
  if (!p) return null;
  const quem = p.dupla === duplaDe(v.cadeira) ? 'Pedimos' : 'Pediram';
  return `${quem} ${nomePedido(p.proposto)}! Vale ${valorMao(v.regras, p.proposto)}.`;
}

/** Quem levou a rodada que acabou de fechar, do ponto de vista de quem olha (texto, não só cor). */
export function textoResultadoRodada(resultado: 0 | 1 | 'empate', minhaDupla: 0 | 1): string {
  if (resultado === 'empate') return 'Cangou!';
  return resultado === minhaDupla ? 'Rodada nossa!' : 'Rodada deles.';
}

export function placarRelativo(v: Visao): { nos: number; eles: number } {
  const d = duplaDe(v.cadeira);
  return { nos: v.placar[d], eles: v.placar[1 - d] };
}

export type Marcador = 'nos' | 'eles' | 'empate';

export function marcadoresRodadas(rodadas: ResultadoRodada[], minha: Cadeira): Marcador[] {
  const d = duplaDe(minha);
  return rodadas.map((r) => (r === 'empate' ? 'empate' : r === d ? 'nos' : 'eles'));
}

export interface ResumoMao {
  titulo: string;
  detalhe: string;
  /** true = minha dupla levou; null = ninguém. */
  nos: boolean | null;
}

export function resumoFimMao(u: VisaoResultadoMao, minha: Cadeira): ResumoMao {
  if (u.vencedor === null) return { titulo: 'Empatou!', detalhe: 'Ninguém pontua nesta mão', nos: null };
  const nos = u.vencedor === duplaDe(minha);
  const pontos = `+${u.pontos} ${u.pontos === 1 ? 'ponto' : 'pontos'}`;
  const motivo =
    u.motivo === 'rodadas'
      ? 'nas rodadas'
      : u.motivo === 'familia'
        ? 'na família conferida'
        : u.motivo === 'correu'
          ? nos
            ? 'eles correram'
            : 'nós corremos'
          : u.motivo === 'trucoNaMaoEspecial'
            ? nos
              ? 'eles pediram truco numa mão já trucada'
              : 'pedimos truco numa mão já trucada'
            : nos
              ? 'eles correram da mão'
              : 'corremos da mão';
  return { titulo: nos ? 'Nós levamos!' : 'Eles levaram!', detalhe: `${pontos} — ${motivo}`, nos };
}

export function resumoFimPartida(v: Visao): { titulo: string; placar: string; venceu: boolean } {
  const { nos, eles } = placarRelativo(v);
  const venceu = v.vencedor === duplaDe(v.cadeira);
  return { titulo: venceu ? 'Vitória!' : 'Derrota', placar: `Nós ${nos} × ${eles} Eles`, venceu };
}


const TEXTO_FAMILIA: Record<RegrasMesa['familia'], string> = {
  off: 'Sem família',
  aberta: 'Família aberta',
  fechada: 'Família fechada',
};

export function textoInterceptacao(chance: number): string {
  if (chance <= 0) return 'Sinais: só o parceiro vê';
  return chance >= 0.5 ? 'Adversários interceptam sinais com facilidade' : 'Adversários às vezes interceptam sinais';
}

/** Linhas curtas com as regras da mesa (sala de espera). */
export function resumoRegras(r: RegrasMesa, chanceInterceptarSinal: number, sinais = true): string[] {
  return [
    r.variante === 'paulista' ? 'Paulista (com vira)' : 'Mineiro (manilhas fixas)',
    `Pontos ${r.pontuacao.split('-').join(' · ')}`,
    r.maoDe10 ? `Mão de ${limiteMaoEspecial(r.pontuacao)} ligada` : `Mão de ${limiteMaoEspecial(r.pontuacao)} desligada`,
    r.maoDe11 === 'onzeAOnze' ? `Mão de ferro no ${limiteMaoEspecial(r.pontuacao)} a ${limiteMaoEspecial(r.pontuacao)}` : 'Sem mão de ferro',
    TEXTO_FAMILIA[r.familia],
    ...(r.variante === 'mineiro' && r.maoLimpa === true ? ['Mão limpa (sem 4 a 7, com 2 coringas)'] : []),
    sinais ? textoInterceptacao(chanceInterceptarSinal) : 'Sem sinais entre parceiros',
  ];
}
