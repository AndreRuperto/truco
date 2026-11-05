import { type Cadeira, duplaDe, ESCADAS, type FamiliaVisivel, MOVIMENTOS_CORTE, type Visao } from '@truco/engine';
import type { MsgAcao } from '@truco/protocolo';
import { type Posicao, posicaoRelativa } from './posicoes';

/** Quem está com o monte: no ritual, quem age (embaralhador ou cortador); na mão, o pé (quem deu). */
export function donoDoMonte(v: Pick<Visao, 'qtdMonte' | 'ritual' | 'fase' | 'mao' | 'pe'>): Cadeira | null {
  if (v.qtdMonte === 0) return null;
  const r = v.ritual;
  if (r) return v.fase === 'cortando' ? r.cortador : r.embaralhador;
  return v.mao ? v.pe : null;
}

const vezes = (n: number) => (n > 0 ? ` (${n}×)` : '');
const movimentos = (n: number) => `${n} ${n === 1 ? 'movimento' : 'movimentos'}`;

/** Linha de estado do centro da mesa (ritual e conferência). null = nada a dizer. */
export function textoEtapa(v: Visao, nome: (c: Cadeira) => string): string | null {
  const r = v.ritual;
  const eu = (c: Cadeira) => c === v.cadeira;
  if (v.fase === 'aguardandoMonte') return 'Separando o baralho…';
  if (r && v.fase === 'embaralhando')
    return eu(r.embaralhador) ? `Sua vez de embaralhar${vezes(r.embaralhadas)}` : `${nome(r.embaralhador)} está embaralhando${vezes(r.embaralhadas)}`;
  if (r && v.fase === 'cortando') {
    const restam = movimentos(MOVIMENTOS_CORTE - r.movimentos);
    return eu(r.cortador) ? `Sua vez de cortar — ${restam}` : `${nome(r.cortador)} vai cortar — ${restam}`;
  }
  if (r && v.fase === 'escolhendoDistribuicao') return eu(r.embaralhador) ? 'Como você vai dar as cartas?' : `${nome(r.embaralhador)} vai dar as cartas`;
  const m = v.mao;
  if (m && v.fase === 'conferindoFamilia' && m.familiaPendente !== null) {
    const f = m.familias[m.familiaPendente];
    if (duplaDe(f.cadeira) !== duplaDe(v.cadeira)) return `${nome(f.cadeira)} pediu família fechada. Conferir?`;
    return eu(f.cadeira) ? 'Esperando os adversários: conferem ou não?' : `${nome(f.cadeira)} pediu família fechada — esperando os adversários`;
  }
  return null;
}

/** Legenda de uma família na mesa (com o resultado, se foi conferida). */
export function textoFamilia(f: FamiliaVisivel, v: Pick<Visao, 'cadeira' | 'regras'>, nome: (c: Cadeira) => string): string {
  if (f.tipo === 'aberta') return `${nome(f.cadeira)} mostrou família`;
  if (!f.conferida) return `${nome(f.cadeira)}: família fechada`;
  const ganhou = f.conferida.real ? duplaDe(f.cadeira) : duplaDe(f.conferida.por);
  const pra = ganhou === duplaDe(v.cadeira) ? 'nós' : 'eles';
  const base = ESCADAS[v.regras.pontuacao][0];
  return `${nome(f.conferida.por)} conferiu: ${f.conferida.real ? 'era família' : 'era blefe'}! +${base} pra ${pra}`;
}

export interface PassoDistribuicao {
  pos: Posicao;
  qtd: 1 | 3;
  /** Sai do fundo do monte (por baixo, subindo). */
  deBaixo: boolean;
}

/** Os voos da animação de distribuir, na ordem e no modo certos. */
export function passosDistribuicao(a: MsgAcao, minha: Cadeira): PassoDistribuicao[] {
  if (a.tipo !== 'distribuir' || !a.modo || !a.ordem) return [];
  const deBaixo = a.modo !== 'porCima';
  const pos = a.ordem.map((c) => posicaoRelativa(minha, c));
  if (a.modo === 'subindo') return [0, 1, 2].flatMap(() => pos.map((p) => ({ pos: p, qtd: 1 as const, deBaixo })));
  return pos.map((p) => ({ pos: p, qtd: 3 as const, deBaixo }));
}

/** O resumo da mão anterior fica na tela até o pé novo embaralhar a 1ª vez. */
export function mostrarResumoMao(v: Visao): boolean {
  return !v.mao && v.fase === 'embaralhando' && v.ritual?.embaralhadas === 0 && v.ultimaMao !== null;
}
