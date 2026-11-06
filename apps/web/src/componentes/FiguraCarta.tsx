import type { Naipe } from '@truco/engine';
import { type ReactNode, useId } from 'react';

/*
 * Figuras das cartas de corte (Rei, Dama, Valete) e o naipe ornamentado do Ás, em SVG
 * inline. Arte própria, geométrica: tinta para contorno, a cor do naipe para roupa/cabelo
 * (vermelho; nos naipes pretos um cinza-azulado, para a roupa não virar silhueta contra o
 * contorno) e um toque de amarelo só em coroa e detalhe. O naipe desenhado fica na cor real.
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
    <g className="fig-naipe fig-sem-traco" transform={`translate(${x - t / 2} ${y - t / 2}) scale(${s})`}>
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

/** Bolinha/guizo: círculo amarelo com contorno. */
const Guizo = ({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) => (
  <circle className="fig-ouro" cx={x} cy={y} r={r} />
);

/** Bolinhas coloridas das fitas, alternando as quatro cores. */
const COR_BOLINHA = ['fig-bola-a', 'fig-bola-c', 'fig-bola-d', 'fig-bola-b'];

/*
 * Bobo da corte de corpo inteiro numa caixa 100×150, de frente: chapéu de três pontas com
 * guizos, gola em zigue-zague, mão na cintura e a marotte erguida à direita. A composição
 * deixa livres o alto à esquerda e o baixo à direita, onde ficam os cantos "CORINGA".
 * A roupa usa `fig-roupa` (vermelho no Cc, tinta clara no Cp) e os detalhes, amarelo.
 */
function Bobo() {
  return (
    <>
      {/* naipes pequenos em volta dos pés (cor própria de cada naipe) */}
      <g className="fig-sem-traco">
        <g className="fig-naipe-preto">
          <Naipe naipe="espadas" x={11} y={131} t={10} />
        </g>
        <g className="fig-naipe-vermelho">
          <Naipe naipe="copas" x={22} y={145} t={9} />
        </g>
        <g className="fig-naipe-preto">
          <Naipe naipe="paus" x={50} y={145.5} t={8} />
        </g>
        <g className="fig-naipe-vermelho">
          <Naipe naipe="ouros" x={77} y={145} t={9} />
        </g>
      </g>
      {/* pernas em duas cores e sapatos de bico enrolado */}
      <path className="fig-roupa" d="M39 102 L37 134 L47 134 L49 102 Z" />
      <path className="fig-ouro" d="M51 102 L53 134 L63 134 L61 102 Z" />
      <path className="fig-ouro" d="M47 131 L37 131 Q28 133 23 126 Q23 139 37 140 L47 140 Z" />
      <path className="fig-roupa" d="M53 131 L63 131 Q72 133 77 126 Q77 139 63 140 L53 140 Z" />
      <Guizo x={23} y={125} r={2.4} />
      <Guizo x={77} y={125} r={2.4} />
      {/* braço esquerdo na cintura */}
      <path className="fig-roupa" d="M36 62 Q20 66 16 80 Q16 92 32 95 L34 87 Q25 85 25 80 Q27 72 38 71 Z" />
      {/* túnica com barra em zigue-zague e pompons */}
      <path className="fig-roupa" d="M33 60 Q28 82 30 104 L37 99 L43 106 L50 100 L57 106 L63 99 L70 104 Q72 82 67 60 Z" />
      <circle className="fig-papel" cx="33" cy="91" r="4.2" />
      <Guizo x={50} y={73} />
      <Guizo x={50} y={84} />
      <Guizo x={50} y={95} />
      {/* braço direito erguido segurando a marotte */}
      <path className="fig-roupa" d="M64 61 Q76 64 79 52 L86 55 Q83 72 65 73 Z" />
      {/* marotte: bastão, fitas com bolinhas e a cabecinha com chapéu */}
      <path className="fig-ouro" d="M80.5 62 L84 62 L88 22 L84.5 22 Z" />
      {/* fitas largas em leque, cada uma com uma bolinha colorida na ponta */}
      <path className="fig-papel" d="M85 24 Q76 26 72 34 L77 37 Q79 30 86 27 Z" />
      <path className="fig-papel" d="M86 25 Q95 28 98 37 L93 39 Q91 31 85 28 Z" />
      <path className="fig-papel" d="M86 26 Q92 36 91 46 L86 46 Q87 37 84 29 Z" />
      {[
        [74, 37],
        [96, 40],
        [88.5, 48],
      ].map(([x, y], i) => (
        <circle key={i} className={COR_BOLINHA[i % 4]} cx={x} cy={y} r="3.4" />
      ))}
      <circle className="fig-papel" cx="82.5" cy="52" r="4.6" />
      <circle className="fig-papel" cx="86.5" cy="16" r="6" />
      <circle className="fig-tinta fig-sem-traco" cx="84.5" cy="15.5" r="1.2" />
      <circle className="fig-tinta fig-sem-traco" cx="88.5" cy="15.5" r="1.2" />
      <path className="fig-so-traco" d="M84 19 Q86.5 21 89 19" />
      <path className="fig-roupa" d="M80.5 12 L74 2 L86.5 7 L99 2 L92.5 12 Z" />
      <Guizo x={74} y={2.5} r={2.2} />
      <Guizo x={99} y={2.5} r={2.2} />
      {/* gola em zigue-zague com guizos nas pontas */}
      <path className="fig-papel" d="M30 55 L35 66 L41 58 L46 68 L50 59 L54 68 L59 58 L65 66 L70 55 Q50 47 30 55 Z" />
      <Guizo x={35} y={66} r={2.2} />
      <Guizo x={46} y={68} r={2.2} />
      <Guizo x={54} y={68} r={2.2} />
      <Guizo x={65} y={66} r={2.2} />
      {/* rosto: sobrancelhas arqueadas, nariz redondo e sorriso maroto */}
      <ellipse className="fig-papel" cx="50" cy="41" rx="12.5" ry="13.5" />
      <circle className="fig-bola-d fig-sem-traco" cx="42" cy="46" r="2.4" />
      <circle className="fig-bola-d fig-sem-traco" cx="58" cy="46" r="2.4" />
      <path className="fig-so-traco" d="M41 34 Q44.5 30.5 48 34 M52 34 Q55.5 30.5 59 34" />
      <circle className="fig-tinta fig-sem-traco" cx="45" cy="39" r="2.2" />
      <circle className="fig-tinta fig-sem-traco" cx="55" cy="39" r="2.2" />
      <circle className="fig-roupa" cx="50" cy="44" r="2.4" />
      <path className="fig-tinta" d="M42 47 Q50 56 59 46 Q50 51 42 47 Z" />
      {/* chapéu de três pontas: as de fora caídas, a do meio em pé, guizo em cada uma */}
      <path className="fig-roupa" d="M38 31 Q28 17 17 29 Q28 23 44 25 Z" />
      <path className="fig-roupa" d="M62 31 Q72 14 82 26 Q70 20 56 25 Z" />
      <path className="fig-ouro" d="M42 27 Q41 9 53 1 Q55 14 58 27 Z" />
      <path className="fig-roupa" d="M37 34 Q50 25 63 34 L63 29 Q50 20 37 29 Z" />
      <Guizo x={17} y={29} />
      <Guizo x={53} y={2} />
      <Guizo x={82} y={26} />
    </>
  );
}

/**
 * Coringa: o bobo da corte de corpo inteiro. Sem recorte: a figura ocupa a carta toda e
 * os cantos com a palavra ficam por cima, num recorte de papel.
 */
export function FiguraCoringa() {
  return (
    <svg className="figura-svg" viewBox="0 0 100 150" aria-hidden="true" focusable="false" data-figura="coringa">
      <g className="fig-traco">
        <Bobo />
      </g>
    </svg>
  );
}

/**
 * Símbolo do coringa onde a carta é pequena demais para o bobo: a cabeça do bobo com o
 * chapéu de pontas caídas e guizos, do tamanho do texto (1em) e na cor da carta. Só o
 * chapéu sozinho se confundia com coroa (ou sino); com o rosto embaixo vira bobo.
 */
export function ChapeuCoringa() {
  return (
    <svg
      className="chapeu-coringa"
      viewBox="-0.6 0 21.2 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-simbolo="coringa"
    >
      <path d="M9.2 8.8 C7.8 3.4 2 3.2 1.2 10.2 C3 7.8 5 7.8 5.8 9.6 Z" />
      <path d="M10.8 8.8 C12.2 3.4 18 3.2 18.8 10.2 C17 7.8 15 7.8 14.2 9.6 Z" />
      <path d="M7.4 8.6 C7.6 5.4 8.6 3.4 10 2.4 C11.4 3.4 12.4 5.4 12.6 8.6 Z" />
      <path d="M4.4 8.4 Q10 6.4 15.6 8.4 L15.6 10.6 Q10 8.8 4.4 10.6 Z" />
      <circle cx="1.6" cy="11.6" r="1.7" />
      <circle cx="18.4" cy="11.6" r="1.7" />
      <circle cx="10" cy="1.9" r="1.7" />
      <path d="M5.5 11 A4.8 4.8 0 1 0 14.5 11" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.2" cy="12.8" r="0.9" />
      <circle cx="11.8" cy="12.8" r="0.9" />
      <path d="M7.8 15 Q10 17 12.2 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
