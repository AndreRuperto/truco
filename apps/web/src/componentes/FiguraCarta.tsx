import type { Naipe } from '@truco/engine';
import { type ReactNode, useId } from 'react';

/*
 * Figuras das cartas de corte (Rei, Dama, Valete) e o naipe ornamentado do Ás, em SVG
 * inline. Arte própria, geométrica: tinta para contorno, a cor do naipe (currentColor,
 * vermelho ou tinta) para roupa/cabelo e um toque de amarelo só em coroa e detalhe.
 * As cores vêm de classes em estilos.css (.fig-*), que leem os tokens.
 */

export type Figura = 'rei' | 'dama' | 'valete';

/** Naipe desenhado numa caixa 20×20, centrado em (10, 10). */
const NAIPE: Record<Naipe, ReactNode> = {
  ouros: <path d="M10 0.5 L18 10 L10 19.5 L2 10 Z" />,
  copas: <path d="M10 18.5 C3 13 0 9 1.6 5 C3.2 1.2 8 0.8 10 4.8 C12 0.8 16.8 1.2 18.4 5 C20 9 17 13 10 18.5 Z" />,
  espadas: (
    <path d="M10 0.5 C16 6 19.5 9 18.6 12.6 C17.8 15.6 14 16.4 11.2 13.8 L12.8 19.5 L7.2 19.5 L8.8 13.8 C6 16.4 2.2 15.6 1.4 12.6 C0.5 9 4 6 10 0.5 Z" />
  ),
  paus: (
    <>
      <circle cx="10" cy="5.2" r="4.6" />
      <circle cx="4.9" cy="11.6" r="4.6" />
      <circle cx="15.1" cy="11.6" r="4.6" />
      <path d="M10 8 L13 19.5 L7 19.5 Z" />
    </>
  ),
};

/** Naipe de tamanho `t` centrado em (x, y). */
function Naipe({ naipe, x, y, t }: { naipe: Naipe; x: number; y: number; t: number }) {
  const s = t / 20;
  return (
    <g className="fig-cor fig-sem-traco" transform={`translate(${x - t / 2} ${y - t / 2}) scale(${s})`}>
      {NAIPE[naipe]}
    </g>
  );
}

/*
 * Meia figura (busto) numa caixa 100×120, cortada em y = 120 no peito. Ordem de pintura:
 * cabelo atrás, roupa, rosto, adereços. Toda figura leva o naipe num campo de papel no peito.
 */
function Rei({ naipe }: { naipe: Naipe }) {
  return (
    <>
      {/* manto e gola de arminho */}
      <path className="fig-cor" d="M4 122 L10 98 Q16 84 34 80 L66 80 Q84 84 90 98 L96 122 Z" />
      <path className="fig-papel" d="M22 88 Q50 76 78 88 L74 96 Q50 86 26 96 Z" />
      <path className="fig-papel" d="M38 98 L62 98 L60 122 L40 122 Z" />
      <Naipe naipe={naipe} x={50} y={110} t={15} />
      {/* rosto e barba em ponta */}
      <ellipse className="fig-papel" cx="50" cy="52" rx="19" ry="21" />
      <path className="fig-cor" d="M31 52 Q30 78 50 94 Q70 78 69 52 Q66 68 50 68 Q34 68 31 52 Z" />
      <path className="fig-tinta" d="M38 66 Q50 58 62 66 Q50 63 38 66 Z" />
      <circle className="fig-tinta fig-sem-traco" cx="42.5" cy="49" r="2.6" />
      <circle className="fig-tinta fig-sem-traco" cx="57.5" cy="49" r="2.6" />
      {/* coroa grande de três pontas */}
      <path className="fig-ouro" d="M28 38 L25 10 L39 22 L50 3 L61 22 L75 10 L72 38 Z" />
      <rect className="fig-cor" x="27" y="31" width="46" height="8" />
      <circle className="fig-ouro" cx="25" cy="10" r="3.5" />
      <circle className="fig-ouro" cx="50" cy="3.5" r="3.5" />
      <circle className="fig-ouro" cx="75" cy="10" r="3.5" />
    </>
  );
}

function Dama({ naipe }: { naipe: Naipe }) {
  return (
    <>
      {/* cabelo longo, atrás do rosto, caindo até os ombros */}
      <path className="fig-cor" d="M28 54 Q26 24 50 24 Q74 24 72 54 L80 102 Q66 100 62 84 L38 84 Q34 100 20 102 Z" />
      {/* vestido com decote em U */}
      <path className="fig-cor" d="M10 122 Q14 94 36 86 L64 86 Q86 94 90 122 Z" />
      <path className="fig-papel" d="M34 86 Q50 122 66 86 Z" />
      <Naipe naipe={naipe} x={50} y={97} t={12} />
      {/* rosto */}
      <ellipse className="fig-papel" cx="50" cy="54" rx="16" ry="19" />
      <path className="fig-cor" d="M34 52 Q36 34 50 34 Q64 34 66 52 Q58 40 50 44 Q42 40 34 52 Z" />
      <circle className="fig-tinta fig-sem-traco" cx="44" cy="55" r="2.3" />
      <circle className="fig-tinta fig-sem-traco" cx="56" cy="55" r="2.3" />
      <ellipse className="fig-cor fig-sem-traco" cx="50" cy="65" rx="3.6" ry="2" />
      {/* tiara de pontas miúdas */}
      <path className="fig-ouro" d="M36 32 L39 21 L44 27 L50 15 L56 27 L61 21 L64 32 Z" />
      {/* flor no cabelo */}
      <g transform="translate(74 50)">
        <circle className="fig-papel" cx="0" cy="-6" r="5" />
        <circle className="fig-papel" cx="5.7" cy="-1.9" r="5" />
        <circle className="fig-papel" cx="3.5" cy="4.9" r="5" />
        <circle className="fig-papel" cx="-3.5" cy="4.9" r="5" />
        <circle className="fig-papel" cx="-5.7" cy="-1.9" r="5" />
        <circle className="fig-ouro" cx="0" cy="0" r="3.4" />
      </g>
    </>
  );
}

function Valete({ naipe }: { naipe: Naipe }) {
  return (
    <>
      {/* gibão com gola quadrada */}
      <path className="fig-cor" d="M6 122 L12 98 Q18 86 36 82 L64 82 Q82 86 88 98 L94 122 Z" />
      <path className="fig-papel" d="M34 82 L66 82 L62 92 L50 98 L38 92 Z" />
      {/* escudinho com o naipe */}
      <path className="fig-papel" d="M38 100 L62 100 L62 110 Q62 119 50 123 Q38 119 38 110 Z" />
      <Naipe naipe={naipe} x={50} y={110} t={13} />
      {/* rosto jovem, cabelo curto */}
      <ellipse className="fig-papel" cx="50" cy="56" rx="17" ry="20" />
      <path className="fig-cor" d="M32 60 Q30 40 50 38 Q70 40 68 60 Q66 48 60 46 Q50 50 40 46 Q34 48 32 60 Z" />
      <circle className="fig-tinta fig-sem-traco" cx="43.5" cy="57" r="2.4" />
      <circle className="fig-tinta fig-sem-traco" cx="56.5" cy="57" r="2.4" />
      <path className="fig-tinta fig-so-traco" d="M44 67 Q50 71 56 67" />
      {/* pena amarela saindo da boina */}
      <path className="fig-ouro" d="M62 30 Q70 6 94 2 Q88 22 62 30 Z" />
      <path className="fig-so-traco" d="M64 28 Q78 14 92 4" />
      {/* boina inclinada */}
      <path className="fig-cor" d="M24 42 Q24 20 52 18 Q80 18 80 36 Q66 34 50 38 Q34 40 24 42 Z" />
      <circle className="fig-papel" cx="52" cy="18" r="3" />
    </>
  );
}

const DESENHO: Record<Figura, (p: { naipe: Naipe }) => ReactNode> = { rei: Rei, dama: Dama, valete: Valete };

const idSeguro = (id: string) => `fig${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

/**
 * Carta de corte: uma meia figura grande, de frente. Testada contra a composição espelhada
 * (meia figura em cima e invertida embaixo): no tamanho da mesa (56–74px de largura) a
 * espelhada fica com rosto de ~9px e não se lê; a única fica quase o dobro. Os ombros
 * terminam arredondados para não brigar com o canto de baixo.
 */
export function FiguraCarta({ figura, naipe }: { figura: Figura; naipe: Naipe }) {
  const recorte = idSeguro(useId());
  const Desenho = DESENHO[figura];
  return (
    <svg className="figura-svg" viewBox="0 0 100 122" aria-hidden="true" focusable="false" data-figura={figura}>
      <defs>
        <clipPath id={recorte}>
          <path d="M-10 -10 H110 V96 Q104 122 80 122 H20 Q-4 122 -10 96 Z" />
        </clipPath>
      </defs>
      <g className="fig-traco" clipPath={`url(#${recorte})`}>
        <Desenho naipe={naipe} />
      </g>
    </svg>
  );
}

/** Raios em volta do naipe do Ás (traço fino). */
function Raios({ n, r1, r2 }: { n: number; r1: number; r2: number }) {
  const d = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const [s, c] = [Math.sin(a), Math.cos(a)];
    return `M${(50 + r1 * s).toFixed(2)} ${(50 - r1 * c).toFixed(2)} L${(50 + r2 * s).toFixed(2)} ${(50 - r2 * c).toFixed(2)}`;
  }).join(' ');
  return <path className="fig-filete" d={d} />;
}

/**
 * Ás: o naipe grande num medalhão de filete com raios. O A♠ (a espadilha do mineiro) ganha
 * um segundo anel, losangos nos pontos cardeais e um miolo amarelo.
 */
export function OrnamentoAs({ naipe }: { naipe: Naipe }) {
  const espadilha = naipe === 'espadas';
  return (
    <svg
      className="ornamento-svg"
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      data-figura="as"
      data-ornamento={espadilha ? 'espadilha' : 'simples'}
    >
      <circle className="fig-filete" cx="50" cy="50" r="31" />
      <Raios n={espadilha ? 24 : 16} r1={35} r2={espadilha ? 44 : 41} />
      {espadilha && (
        <>
          <circle className="fig-filete fig-tracejado" cx="50" cy="50" r="47.5" />
          {[0, 90, 180, 270].map((g) => (
            <path key={g} className="fig-cor fig-sem-traco" transform={`rotate(${g} 50 50)`} d="M50 0 L53.5 5 L50 10 L46.5 5 Z" />
          ))}
        </>
      )}
      <Naipe naipe={naipe} x={50} y={50} t={espadilha ? 40 : 36} />
      {espadilha && <circle className="fig-ouro" cx="50" cy="47" r="3.2" />}
    </svg>
  );
}
