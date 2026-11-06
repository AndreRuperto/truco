/*
 * Estampa da mesa de plástico: a cerveja inventada do jogo, "Zapada" (do zap, a manilha
 * mais forte do mineiro). Marca própria, sem imitar nenhuma real: selo em forma de tampinha
 * de garrafa, verde-garrafa e creme, com o paus do zap no meio. Impressão gasta pelo uso.
 */

const DENTES = 21;

/** Contorno de tampinha: coroa de dentes arredondados em volta do círculo. */
function coroa(raioFora: number, raioDentro: number): string {
  const pts: string[] = [];
  for (let i = 0; i < DENTES * 2; i++) {
    const a = (i / (DENTES * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? raioFora : raioDentro;
    pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

const CONTORNO = coroa(98, 88);

export function EstampaZapada() {
  return (
    <svg className="estampa-zapada" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false" data-testid="estampa">
      <defs>
        {/* Arcos do texto: em cima da esquerda para a direita; embaixo invertido, para ler de pé. */}
        <path id="zapada-arco-cima" d="M -53 0 A 53 53 0 0 1 53 0" />
        <path id="zapada-arco-baixo" d="M -68 0 A 68 68 0 0 0 68 0" />
        {/* Desgaste: ruído largo apaga manchas da tinta, como plástico muito lavado. */}
        <filter id="zapada-gasta" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.07 0.12" numOctaves="3" seed="7" result="ruido" />
          <feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.35" result="mascara" />
          <feComposite in="SourceGraphic" in2="mascara" operator="in" />
        </filter>
      </defs>
      <g filter="url(#zapada-gasta)">
        <path className="z-tampa" d={CONTORNO} strokeLinejoin="round" />
        <circle className="z-aro" r="80" />
        <circle className="z-miolo" r="74" />
        <circle className="z-fio" r="47" />
        <text className="z-nome">
          <textPath href="#zapada-arco-cima" startOffset="50%" textAnchor="middle">
            ZAPADA
          </textPath>
        </text>
        <text className="z-sub">
          <textPath href="#zapada-arco-baixo" startOffset="50%" textAnchor="middle">
            cerveja de truqueiro
          </textPath>
        </text>
        {/* Paus do zap: três bolas e o pé. */}
        <g className="z-paus" transform="translate(0 4)">
          <circle cx="0" cy="-17" r="13" />
          <circle cx="-15" cy="4" r="13" />
          <circle cx="15" cy="4" r="13" />
          <path d="M -4 2 L 4 2 L 9 26 L -9 26 Z" />
        </g>
        <circle className="z-estrela" cx="-60" cy="10" r="2.6" />
        <circle className="z-estrela" cx="60" cy="10" r="2.6" />
      </g>
    </svg>
  );
}
