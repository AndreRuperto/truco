import type { Carta } from '../cartas';
import { type AcaoJogador, type Cadeira, duplaDe, type EstadoPartida, type Jogada, parceiroDe } from '../estado';
import { janelaDeFamilia } from '../familia';
import { FORCA_MANILHA_MIN, forca } from '../forca';
import { visaoDoJogador } from '../visao';
import { decidirEtapa, querFamilia } from './ritual';

const MANILHA = FORCA_MANILHA_MIN;

/** Bot fácil: nunca truca; aceita com manilha; joga a menor carta que vence a mesa; ritual sempre igual. */
export function botFacil(s: EstadoPartida, cadeira: Cadeira): AcaoJogador | null {
  const m = s.mao;
  if (!m || s.fase === 'conferindoFamilia') return decidirEtapa(visaoDoJogador(s, cadeira), () => 0, 'facil');
  const dupla = duplaDe(cadeira);
  const f = (c: Carta) => forca(c, s.regras.variante, m.vira);
  const minha = m.maos[cadeira];

  if (s.fase === 'respondendoTruco') {
    if (!m.trucoPendente || m.trucoPendente.dupla === dupla) return null;
    return { tipo: minha.some((c) => f(c) >= MANILHA) ? 'aceitar' : 'correr', cadeira };
  }

  if (s.fase === 'decisaoMao10') {
    if (m.duplaNoDez !== dupla) return null;
    const boa = [...minha, ...m.maos[parceiroDe(cadeira)]].some((c) => f(c) >= MANILHA);
    return { tipo: 'mao10', cadeira, jogar: boa };
  }

  if (janelaDeFamilia(s) && querFamilia(visaoDoJogador(s, cadeira), () => 1, 'facil')) return { tipo: 'familia', cadeira };
  if (s.fase !== 'jogando' || m.vez !== cadeira) return null;
  if (m.tipo === 'mao11') return { tipo: 'jogar', cadeira, indice: 0 };

  const ordenadas = minha.map((c, i) => ({ i, f: f(c) })).sort((a, b) => a.f - b.f);
  const melhor = m.mesa.reduce<Jogada | null>((b, j) => (!b || j.forca > b.forca ? j : b), null);
  if (melhor && duplaDe(melhor.cadeira) === dupla) return { tipo: 'jogar', cadeira, indice: ordenadas[0].i };
  const vence = ordenadas.find((x) => !melhor || x.f > melhor.forca);
  return { tipo: 'jogar', cadeira, indice: (vence ?? ordenadas[0]).i };
}
