import type { VisualRoupa } from '@truco/api';
import type { CSSProperties } from 'react';
import { vestir } from '../logica/lojaItens';
import { cx } from './cx';

/**
 * Jogadores de bar desenhados (2.5D): busto sentado atrás da mesa, de frente para o centro.
 * Seis tipos; cada assento recebe um pelo nome (bots têm sempre o mesmo jeito).
 */
interface Tipo {
  pele: string;
  peleSombra: string;
  camisa: string;
  camisaSombra: string;
  cabelo: string;
  chapeu?: 'palha' | 'bone' | 'feltro';
  chapeuCor?: string;
  cabeloTipo: 'curto' | 'careca' | 'coque' | 'cacheado';
  rosto?: 'bigode' | 'bigodao' | 'barba';
  estampa?: 'xadrez' | 'regata' | 'listra';
}

export const TIPOS: readonly Tipo[] = [
  { pele: '#d9a47a', peleSombra: '#b07a52', camisa: '#b8202a', camisaSombra: '#861820', cabelo: '#3a2618', chapeu: 'palha', chapeuCor: '#e8c35e', cabeloTipo: 'curto', rosto: 'bigode', estampa: 'xadrez' },
  { pele: '#8d5a3b', peleSombra: '#6a4029', camisa: '#efeadf', camisaSombra: '#c9c2b2', cabelo: '#1c1410', chapeu: 'bone', chapeuCor: '#2f68b8', cabeloTipo: 'curto', estampa: 'regata' },
  { pele: '#e8bc96', peleSombra: '#c4916a', camisa: '#2d6a45', camisaSombra: '#1f4b31', cabelo: '#9c9a94', cabeloTipo: 'careca', rosto: 'bigodao' },
  { pele: '#b9825c', peleSombra: '#94603f', camisa: '#e9b02c', camisaSombra: '#bb8a18', cabelo: '#2a1a12', cabeloTipo: 'coque' },
  { pele: '#6b4128', peleSombra: '#4f2e1b', camisa: '#d9763a', camisaSombra: '#a95824', cabelo: '#1a120d', cabeloTipo: 'cacheado', estampa: 'listra' },
  { pele: '#f0c9a4', peleSombra: '#cf9f76', camisa: '#2b2f36', camisaSombra: '#1a1d22', cabelo: '#5a3a22', chapeu: 'feltro', chapeuCor: '#4a3a2c', cabeloTipo: 'curto', rosto: 'barba' },
];

/** Tipo de cada nome, sem repetir entre os da mesa (na ordem dada). */
export function tiposDaMesa(nomes: string[]): number[] {
  const usados = new Set<number>();
  return nomes.map((n) => {
    let h = 0;
    for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let t = h % TIPOS.length;
    while (usados.has(t)) t = (t + 1) % TIPOS.length;
    usados.add(t);
    return t;
  });
}

interface Props {
  tipo: number;
  lado: 'cima' | 'esquerda' | 'direita';
  daVez: boolean;
  gritando: boolean;
  /** Roupa da loja (camisa, estampa, chapéu) por cima do tipo. */
  roupa?: VisualRoupa | null;
}

export function Personagem({ tipo, lado, daVez, gritando, roupa }: Props) {
  const t = vestir(TIPOS[tipo % TIPOS.length], roupa);
  const estilo = { '--atraso': `${(tipo * 0.7) % 3}s` } as CSSProperties;
  return (
    <svg
      className={cx('personagem', `personagem-${lado}`, daVez && 'pensando', gritando && 'gritando')}
      viewBox="0 0 200 210"
      style={estilo}
      aria-hidden="true"
      focusable="false"
    >
      {/* encosto da cadeira (dois pés e a travessa), atrás de tudo */}
      <g fill="#5a3820">
        <rect x="40" y="96" width="12" height="118" rx="4" />
        <rect x="148" y="96" width="12" height="118" rx="4" />
        <rect x="36" y="100" width="128" height="16" rx="7" fill="#6f4628" />
      </g>
      <g className="personagem-corpo">
        {/* braço erguido (grito) fica atrás do tronco */}
        <g className="braco-grito">
          <path d="M150 150 C 168 120, 176 96, 172 70" stroke={t.camisa} strokeWidth="22" strokeLinecap="round" fill="none" />
          <circle cx="172" cy="64" r="12" fill={t.pele} />
        </g>
        {/* tronco */}
        <path d="M44 214 C 44 168, 60 140, 100 136 C 140 140, 156 168, 156 214 Z" fill={t.camisa} />
        <path d="M100 136 C 140 140, 156 168, 156 214 L 128 214 C 130 180, 122 156, 100 150 Z" fill={t.camisaSombra} opacity="0.55" />
        {t.estampa === 'xadrez' && (
          <g opacity="0.28" stroke="#2a0d0d" strokeWidth="3">
            <path d="M60 160 V214 M80 146 V214 M120 146 V214 M140 160 V214" />
            <path d="M50 172 H150 M46 192 H154" />
          </g>
        )}
        {t.estampa === 'listra' && (
          <g opacity="0.25" stroke="#fff3df" strokeWidth="5">
            <path d="M50 170 H150 M46 188 H154 M45 206 H155" />
          </g>
        )}
        {t.estampa === 'regata' && (
          <>
            <path d="M58 150 C 66 172, 66 196, 60 214 L 44 214 C 44 180, 50 160, 58 150 Z" fill={t.pele} />
            <path d="M142 150 C 134 172, 134 196, 140 214 L 156 214 C 156 180, 150 160, 142 150 Z" fill={t.pele} />
          </>
        )}
        {/* gola e pescoço */}
        <path d="M86 128 h28 v14 c0 8 -28 8 -28 0 Z" fill={t.peleSombra} />
        <path d="M84 140 L100 156 L116 140" fill="none" stroke={t.camisaSombra} strokeWidth="4" strokeLinejoin="round" />
        {/* braço da vez: mão no queixo, pensando */}
        <g className="braco-pensa">
          <path d="M62 214 C 62 186, 70 162, 84 150" stroke={t.camisaSombra} strokeWidth="20" strokeLinecap="round" fill="none" />
          <ellipse cx="88" cy="140" rx="11" ry="9" fill={t.pele} />
        </g>
        {/* cabeça */}
        <g className="personagem-cabeca">
          {t.cabeloTipo === 'coque' && <circle cx="100" cy="44" r="16" fill={t.cabelo} />}
          {t.cabeloTipo === 'cacheado' && (
            <g fill={t.cabelo}>
              <circle cx="72" cy="78" r="18" />
              <circle cx="128" cy="78" r="18" />
              <circle cx="80" cy="58" r="20" />
              <circle cx="120" cy="58" r="20" />
              <circle cx="100" cy="50" r="22" />
            </g>
          )}
          <ellipse cx="72" cy="96" rx="7" ry="10" fill={t.peleSombra} />
          <ellipse cx="128" cy="96" rx="7" ry="10" fill={t.peleSombra} />
          <ellipse cx="100" cy="94" rx="28" ry="34" fill={t.pele} />
          {t.cabeloTipo === 'curto' && <path d="M72 88 C 70 64, 84 58, 100 58 C 116 58, 130 64, 128 88 C 120 74, 82 74, 72 88 Z" fill={t.cabelo} />}
          {t.cabeloTipo === 'coque' && <path d="M72 92 C 68 62, 84 58, 100 58 C 116 58, 132 62, 128 92 C 122 72, 80 70, 72 92 Z" fill={t.cabelo} />}
          {t.cabeloTipo === 'careca' && (
            <g fill={t.cabelo}>
              <path d="M72 96 C 70 84, 74 80, 78 80 L 78 100 Z" />
              <path d="M128 96 C 130 84, 126 80, 122 80 L 122 100 Z" />
            </g>
          )}
          {/* olhos (piscam) */}
          <g className="olhos" fill="#1c1916">
            <ellipse cx="89" cy="95" rx="3.4" ry="4.2" />
            <ellipse cx="111" cy="95" rx="3.4" ry="4.2" />
          </g>
          <path d="M82 86 q7 -4 14 0 M104 86 q7 -4 14 0" stroke={t.cabelo === '#9c9a94' ? '#7d7b75' : t.cabelo} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M98 100 q2 6 -2 9" stroke={t.peleSombra} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* boca: linha; aberta no grito */}
          <path className="boca" d="M92 116 q8 4 16 0" stroke="#5a2a1c" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse className="boca-aberta" cx="100" cy="117" rx="7" ry="8" fill="#5a1a14" />
          {t.rosto === 'bigode' && <path d="M88 110 q12 -6 24 0 q-12 4 -24 0 Z" fill={t.cabelo} />}
          {t.rosto === 'bigodao' && <path d="M84 110 q16 -9 32 0 q-4 8 -10 4 q-6 -3 -12 0 q-6 4 -10 -4 Z" fill={t.cabelo} />}
          {t.rosto === 'barba' && <path d="M73 100 C 74 124, 86 132, 100 132 C 114 132, 126 124, 127 100 C 122 112, 112 112, 100 112 C 88 112, 78 112, 73 100 Z" fill={t.cabelo} />}
          {t.chapeu === 'palha' && (
            <g>
              <ellipse cx="100" cy="72" rx="52" ry="11" fill={t.chapeuCor} />
              <path d="M74 72 C 74 48, 86 40, 100 40 C 114 40, 126 48, 126 72 Z" fill={t.chapeuCor} />
              <path d="M75 64 h50 v6 h-50 Z" fill="#b8202a" />
              <path d="M84 50 l3 6 M100 44 v6 M116 50 l-3 6" stroke="#c99b3a" strokeWidth="2" />
            </g>
          )}
          {t.chapeu === 'bone' && (
            <g fill={t.chapeuCor}>
              <path d="M72 80 C 70 56, 86 50, 100 50 C 114 50, 130 56, 128 80 Z" />
              <path d="M96 78 C 112 74, 136 76, 146 84 C 132 86, 112 84, 96 84 Z" />
              <circle cx="100" cy="52" r="3" fill="#efeadf" />
            </g>
          )}
          {t.chapeu === 'feltro' && (
            <g fill={t.chapeuCor}>
              <ellipse cx="100" cy="72" rx="44" ry="9" />
              <path d="M76 72 C 76 50, 86 42, 100 46 C 114 42, 124 50, 124 72 Z" />
              <path d="M77 64 h46 v5 h-46 Z" fill="#1c1410" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
