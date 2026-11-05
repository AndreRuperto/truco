import { baralhoDaMesa, type Carta, idCarta } from '../cartas';
import { type AcaoJogador, duplaDe } from '../estado';
import { ehFamilia, janelaDeFamilia, tipoDaProximaFamilia } from '../familia';
import { FORCA_MANILHA_MIN, forca } from '../forca';
import { LIMITE_EMBARALHADAS } from '../ritual';
import type { Visao } from '../visao';

export type EstiloBot = 'facil' | 'dificil';

const FIGURAS = new Set(['Q', 'J', 'K', 'A']);
const FRACAS = new Set(['4', '5', '6', '7', 'Q', 'J']);
/** Abaixo disto o difícil desconfia de uma família fechada. */
export const LIMIAR_DESCONFIANCA = 0.035;
export const CHANCE_BLEFE_FAMILIA = 0.05;

/** Cartas que `v.cadeira` ainda não viu (mãos alheias, monte, famílias fechadas alheias, cobertas). */
export function cartasDesconhecidas(v: Visao): Carta[] {
  const vistas = new Set<string>();
  const marcar = (c: Carta | null | undefined) => {
    if (c) vistas.add(idCarta(c));
  };
  v.ritual?.abertas.forEach(marcar);
  const m = v.mao;
  if (m) {
    m.minhaMao.forEach(marcar);
    m.maoParceiro?.forEach(marcar);
    marcar(m.vira);
    m.mesa.forEach((j) => marcar(j.carta));
    m.rodadasJogadas.flat().forEach((j) => marcar(j.carta));
    m.abertasNoCorte.forEach(marcar);
    m.familias.forEach((f) => f.cartas?.forEach(marcar));
  }
  return baralhoDaMesa(v.regras).filter((c) => !vistas.has(idCarta(c)));
}

/** Chance de 3 cartas tiradas das que não viu serem todas Q/J/K/A: C(F,3)/C(N,3). */
export function chanceDeFamilia(v: Visao): number {
  const d = cartasDesconhecidas(v);
  const f = d.filter((c) => FIGURAS.has(c.valor)).length;
  const n = d.length;
  if (n < 3) return 0;
  return (f * (f - 1) * (f - 2)) / (n * (n - 1) * (n - 2));
}

function deveConferir(v: Visao, rand: () => number, estilo: EstiloBot): boolean {
  const m = v.mao!;
  const i = m.familiaPendente!;
  const f = m.familias[i];
  const repetiu = m.familias.some((x, j) => j < i && x.cadeira === f.cadeira && x.tipo === 'fechada');
  const p = chanceDeFamilia(v);
  if (p === 0 || repetiu) return true;
  if (estilo === 'facil') return false;
  return p < LIMIAR_DESCONFIANCA || rand() < 0.1;
}

/** Pede família na janela? Fácil: só com família real e sem manilha. Difícil: também blefa às vezes. */
export function querFamilia(v: Visao, rand: () => number, estilo: EstiloBot): boolean {
  const m = v.mao;
  if (!m || !janelaDeFamilia(v) || v.qtdMonte < 3) return false;
  const mao = m.minhaMao.filter((c): c is Carta => c !== null);
  if (mao.length !== 3) return false;
  const semManilha = mao.every((c) => forca(c, v.regras.variante, m.vira) < FORCA_MANILHA_MIN);
  if (ehFamilia(mao) && semManilha) return true;
  if (estilo === 'facil' || tipoDaProximaFamilia(v) !== 'fechada') return false;
  const fraca = semManilha && mao.every((c) => FRACAS.has(c.valor));
  return fraca && rand() < CHANCE_BLEFE_FAMILIA;
}

/** Etapas do ritual e o conferir. null = esta cadeira não tem nada a decidir agora. */
export function decidirEtapa(v: Visao, rand: () => number, estilo: EstiloBot): AcaoJogador | null {
  const cadeira = v.cadeira;
  const r = v.ritual;
  switch (v.fase) {
    case 'embaralhando': {
      if (!r || r.embaralhador !== cadeira) return null;
      const mais = estilo === 'facil' ? r.embaralhadas < 3 : r.embaralhadas < 2 || (r.embaralhadas < 6 && rand() < 0.5);
      return mais && r.embaralhadas < LIMITE_EMBARALHADAS ? { tipo: 'embaralhar', cadeira } : { tipo: 'passarCorte', cadeira };
    }
    case 'cortando': {
      if (!r || r.cortador !== cadeira) return null;
      if (estilo === 'facil') return r.movimentos === 0 ? { tipo: 'cortar', cadeira } : { tipo: 'devolver', cadeira };
      if (r.movimentos === 0) {
        const x = rand();
        if (x < 0.04) return { tipo: 'abrir3', cadeira };
        if (x < 0.08) return { tipo: 'dar3', cadeira };
        if (x < 0.2) return { tipo: 'embaralhar', cadeira };
        return { tipo: 'cortar', cadeira };
      }
      return rand() < 0.3 ? { tipo: 'cortar', cadeira } : { tipo: 'devolver', cadeira };
    }
    case 'escolhendoDistribuicao': {
      if (!r || r.embaralhador !== cadeira) return null;
      if (estilo === 'facil') return { tipo: 'distribuir', cadeira, modo: 'porCima' };
      const x = rand();
      return { tipo: 'distribuir', cadeira, modo: x < 0.6 ? 'porCima' : x < 0.85 ? 'porBaixo' : 'subindo' };
    }
    case 'conferindoFamilia': {
      const m = v.mao;
      if (!m || m.familiaPendente === null) return null;
      if (duplaDe(m.familias[m.familiaPendente].cadeira) === duplaDe(cadeira)) return null;
      return { tipo: 'conferir', cadeira, conferir: deveConferir(v, rand, estilo) };
    }
    default:
      return null;
  }
}
