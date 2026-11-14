import { AVATARES_PRONTOS, type AvatarPronto } from '@truco/api';
import type { ReactNode } from 'react';

/** Nome de cada avatar do site (para o leitor de tela e o título do botão). */
export const NOME_AVATAR: Record<AvatarPronto, string> = {
  zap: 'Zap',
  copas: 'Sete de copas',
  espadilha: 'Espadilha',
  ouros: 'Sete de ouros',
  chope: 'Chope',
  chapeu: 'Chapéu de palha',
  galo: 'Galo',
  viola: 'Viola caipira',
  ferradura: 'Ferradura',
  lua: 'Madrugada',
};

const PAUS = 'M32 13c-5.2 0-8.6 4.4-7.4 9.4-5.3-1.5-10.1 2.3-10.1 7.6 0 6.6 7.6 9.6 13 5.4-.6 4-2.3 7.3-5 9.6h19c-2.7-2.3-4.4-5.6-5-9.6 5.4 4.2 13 1.2 13-5.4 0-5.3-4.8-9.1-10.1-7.6C40.6 17.4 37.2 13 32 13Z';
const COPAS = 'M32 48C20 39 14 32.5 14 25.5 14 20 18 16 23 16c4 0 7 2.4 9 6 2-3.6 5-6 9-6 5 0 9 4 9 9.5C50 32.5 44 39 32 48Z';
const ESPADAS = 'M32 12C24 21 15 26 15 34c0 5 4 8.5 8.5 8.5 2.8 0 5.2-1.3 6.6-3.4-.4 3.2-1.8 5.6-4.3 7.4h12.4c-2.5-1.8-3.9-4.2-4.3-7.4 1.4 2.1 3.8 3.4 6.6 3.4 4.5 0 8.5-3.5 8.5-8.5 0-8-9-13-17-22Z';
const OUROS = 'M32 12 47 32 32 52 17 32Z';

/** Desenho de naipe com o número no canto, como o canto de uma carta. */
function Naipe({ fundo, cor, d, valor, corValor }: { fundo: string; cor: string; d: string; valor: string; corValor?: string }) {
  return (
    <>
      <circle cx="32" cy="32" r="32" fill={fundo} />
      <path d={d} fill={cor} />
      <text x="15" y="20" fontSize="12" fontWeight="800" fill={corValor ?? cor} textAnchor="middle" fontFamily="var(--fonte-ui)">
        {valor}
      </text>
    </>
  );
}

const DESENHOS: Record<AvatarPronto, ReactNode> = {
  zap: <Naipe fundo="#2d6a45" cor="#fbf3dc" d={PAUS} valor="4" />,
  copas: <Naipe fundo="#b8202a" cor="#fbf3dc" d={COPAS} valor="7" />,
  espadilha: <Naipe fundo="#24304a" cor="#efeadf" d={ESPADAS} valor="A" />,
  ouros: <Naipe fundo="#e9b02c" cor="#b8202a" d={OUROS} valor="7" corValor="#5e3a1f" />,
  chope: (
    <>
      <circle cx="32" cy="32" r="32" fill="#2f6d6a" />
      <path d="M44 25h4a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-4" fill="none" stroke="#fbf3dc" strokeWidth="3.5" />
      <rect x="19" y="22" width="26" height="28" rx="3" fill="#e9b02c" />
      <path d="M24 27v18M32 27v18M40 27v18" stroke="#c98d17" strokeWidth="2" />
      <path d="M17 24c0-5 4-8 8-7 1-3 5-5 8-3 3-2 8-1 9 3 4 0 6 3 5 7Z" fill="#fbf3dc" />
    </>
  ),
  chapeu: (
    <>
      <circle cx="32" cy="32" r="32" fill="#d9763a" />
      <ellipse cx="32" cy="40" rx="24" ry="7" fill="#f0d27a" />
      <path d="M20 39c0-12 5-19 12-19s12 7 12 19c-7 3-17 3-24 0Z" fill="#e8c35e" />
      <path d="M20.5 34c7 2.6 16 2.6 23 0l.3 3.4c-7.2 2.6-16.4 2.6-23.6 0Z" fill="#b8202a" />
      <path d="M26 26l2 3M32 23v4M38 26l-2 3" stroke="#c99b3a" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  galo: (
    <>
      <circle cx="32" cy="32" r="32" fill="#f3e6c4" />
      <path d="M22 18c1-5 5-6 7-3 1-4 6-4 7 0 2-3 7-1 6 4-3 1-14 1-20-1Z" fill="#b8202a" />
      <path d="M20 54c-2-12 0-26 9-33 9-4 17 2 17 11 0 6-4 9-4 14 0 3 2 6 4 8Z" fill="#9a6337" />
      <path d="M45 28l9 3-9 4Z" fill="#e9b02c" />
      <path d="M41 36c1 5-1 9-4 9-2-3-1-7 4-9Z" fill="#b8202a" />
      <circle cx="38" cy="27" r="2.6" fill="#1c1916" />
      <circle cx="38.8" cy="26.2" r=".8" fill="#fbf8f1" />
    </>
  ),
  viola: (
    <>
      <circle cx="32" cy="32" r="32" fill="#5e3a1f" />
      <g transform="rotate(35 32 32)">
        <rect x="29.5" y="4" width="5" height="26" rx="1.5" fill="#2a1a0e" />
        <rect x="27" y="2" width="10" height="7" rx="2" fill="#2a1a0e" />
        <path d="M32 26c-6 0-10 3-10 8 0 3 2 4 2 6-3 1-5 4-5 8 0 6 6 10 13 10s13-4 13-10c0-4-2-7-5-8 0-2 2-3 2-6 0-5-4-8-10-8Z" fill="#e3a35b" />
        <circle cx="32" cy="41" r="4.2" fill="#2a1a0e" />
        <rect x="27" y="50" width="10" height="2.4" rx="1" fill="#2a1a0e" />
        <path d="M31 6v46M33 6v46" stroke="#efeadf" strokeWidth=".6" />
      </g>
    </>
  ),
  ferradura: (
    <>
      <circle cx="32" cy="32" r="32" fill="#3f9b66" />
      <path d="M18 50V30a14 14 0 0 1 28 0v20h-8V30a6 6 0 0 0-12 0v20Z" fill="#c9ccd1" />
      <path d="M18 50h8M38 50h8" stroke="#8a8f96" strokeWidth="4" />
      <g fill="#5f6b78">
        <circle cx="22" cy="31" r="1.5" />
        <circle cx="22" cy="40" r="1.5" />
        <circle cx="42" cy="31" r="1.5" />
        <circle cx="42" cy="40" r="1.5" />
        <circle cx="27" cy="21" r="1.5" />
        <circle cx="37" cy="21" r="1.5" />
      </g>
    </>
  ),
  lua: (
    <>
      <circle cx="32" cy="32" r="32" fill="#1b2340" />
      <path d="M38 14a19 19 0 1 0 12 32A16 16 0 0 1 38 14Z" fill="#f3e6c4" />
      <path d="M48 16l1.2 2.8 2.8 1.2-2.8 1.2L48 24l-1.2-2.8L44 20l2.8-1.2ZM16 18l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8ZM51 36l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7Z" fill="#e9b02c" />
    </>
  ),
};

export const ehAvatarPronto = (x: string): x is AvatarPronto => (AVATARES_PRONTOS as readonly string[]).includes(x);

export function DesenhoAvatar({ id }: { id: AvatarPronto }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {DESENHOS[id]}
    </svg>
  );
}

/*
 * Avatares exclusivos da loja (`loja:<id do item>`), desenhados na prancha "Avatares do boteco"
 * (https://claude.ai/artifact/X63TgRg4WVK55nLiuaLEdx). Regras do traço:
 * - cabeça, pescoço e tronco são uma peça só (nunca fundo entre eles);
 * - o fundo é um quadrado cheio e o corpo passa da borda: o `.avatar` (raio 50%, overflow hidden) corta;
 * - a mesma luz em todos: pele #d9a47a, sombra #c48a62, traço #3a2618;
 * - uma silhueta forte e um detalhe só, para ler em 28 px.
 */
const PELE = '#d9a47a';
const SOMBRA = '#c48a62';
const TRACO = '#3a2618';

export const DESENHOS_LOJA: Record<string, ReactNode> = {
  'avatar-violeiro': (
    <>
      <rect width="64" height="64" fill="#2d6a45" />
      <path data-parte="camisa" data-topo="42" d="M8 66c1-15 10-24 24-24s23 9 24 24Z" fill="#b8202a" />
      <path d="M17 52v14M47 52v14M24 44v22M40 44v22" stroke="#8f1820" strokeWidth="1.6" />
      <rect data-parte="pescoco" x="28.2" y="31" width="7.6" height="13" fill={SOMBRA} />
      <path d="M25.5 42h13L32 49.5Z" fill="#e9b02c" />
      <circle data-parte="cabeca" cx="32" cy="27" r="8.6" fill={PELE} />
      <circle cx="23.6" cy="28" r="1.9" fill={SOMBRA} />
      <circle cx="40.4" cy="28" r="1.9" fill={SOMBRA} />
      <circle cx="28.8" cy="27.2" r="1.15" fill={TRACO} />
      <circle cx="35.2" cy="27.2" r="1.15" fill={TRACO} />
      <path d="M28 31.6c1.6 1.1 2.8 1.1 4 0 1.2 1.1 2.4 1.1 4 0" stroke={TRACO} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <ellipse cx="32" cy="21" rx="16.5" ry="3.8" fill="#e8c35e" />
      <path d="M23.6 21c0-6.4 3.6-9.8 8.4-9.8s8.4 3.4 8.4 9.8Z" fill="#e8c35e" />
      <path d="M23.9 17.6h16.2v2.8H23.9Z" fill="#b8202a" />
      <path d="M18 21.6c4 1.4 24 1.4 28 0" stroke="#c99b3a" strokeWidth="1" fill="none" />
      <g transform="rotate(-40 36 50)">
        <rect x="34.8" y="28" width="2.4" height="14" fill="#5e3a1f" />
        <rect x="34" y="25.5" width="4" height="4.5" rx="1" fill={TRACO} />
        <circle cx="36" cy="45.6" r="5.4" fill="#e3a35b" />
        <circle cx="36" cy="53" r="7.4" fill="#e3a35b" />
        <circle cx="36" cy="50.2" r="2.1" fill="#5e3a1f" />
        <rect x="32.5" y="56" width="7" height="1.8" rx=".8" fill="#5e3a1f" />
      </g>
      <circle cx="27" cy="39.4" r="2.5" fill={PELE} />
      <circle cx="41.5" cy="50" r="2.7" fill={PELE} />
    </>
  ),
  'avatar-garrafa': (
    <>
      <rect width="64" height="64" fill="#24304a" />
      <circle cx="50" cy="15" r="1.2" fill="#e9b02c" />
      <circle cx="14" cy="22" r=".9" fill="#e9b02c" />
      <rect x="0" y="52" width="64" height="12" fill="#6e4424" />
      <rect x="0" y="47" width="64" height="5.5" fill="#9a6337" />
      <path d="M0 49.2h64" stroke="#b47a4a" strokeWidth=".8" />
      <path d="M25.5 10h7v7c0 2 5 4 5 10v20H20.5V27c0-6 5-8 5-10Z" fill="#3f9b66" />
      <rect x="24.8" y="7.6" width="8.4" height="4" rx="1" fill="#e9b02c" />
      <rect x="22.6" y="27" width="2" height="18" rx="1" fill="#7cc79a" />
      <rect x="21.8" y="31" width="14.4" height="9.4" rx="1.5" fill="#fbf3dc" />
      <rect x="24" y="33.6" width="10" height="1.8" fill="#b8202a" />
      <rect x="25.2" y="36.6" width="7.6" height="1.2" fill="#b8202a" />
      <path d="M40.5 31h11l-1.3 16h-8.4Z" fill="#e9b02c" />
      <path d="M44.2 33.5v12M47.8 33.5v12" stroke="#c98d17" strokeWidth="1" />
      <path d="M40 31.4c0-2.6 2-3.7 3.6-2.9.8-1.7 3.7-1.9 4.7 0 1.6-.6 3.6.4 3.6 2.9Z" fill="#fbf3dc" />
    </>
  ),
  'avatar-caramelo': (
    <>
      <rect width="64" height="64" fill="#4a76a8" />
      <ellipse cx="32" cy="66" rx="21" ry="16" fill="#c98040" />
      <ellipse cx="32" cy="59" rx="7" ry="8" fill="#fbf3dc" />
      <rect x="25" y="37" width="14" height="17" fill="#c98040" />
      <rect x="24.5" y="43" width="15" height="3.6" rx="1.6" fill="#b8202a" />
      <circle cx="32" cy="48.6" r="2.4" fill="#e9b02c" />
      <path d="M18.5 27 20 10.5l9.5 9.5Z" fill="#b06a30" />
      <path d="M41 18.5c6.5-2.4 10.6 2 9.6 9.2-.6 4-2.8 6.1-5 6.1Z" fill="#8a5326" />
      <ellipse cx="32" cy="30" rx="13" ry="12" fill="#d08a3e" />
      <ellipse cx="26.6" cy="23.6" rx="1.8" ry="1.1" fill="#f0d2a2" />
      <ellipse cx="37.4" cy="23.6" rx="1.8" ry="1.1" fill="#f0d2a2" />
      <circle cx="27" cy="27.4" r="1.9" fill="#1c1916" />
      <circle cx="37" cy="27.4" r="1.9" fill="#1c1916" />
      <circle cx="27.6" cy="26.8" r=".6" fill="#fbf8f1" />
      <circle cx="37.6" cy="26.8" r=".6" fill="#fbf8f1" />
      <ellipse cx="32" cy="36" rx="7.2" ry="5.6" fill="#f0d2a2" />
      <ellipse cx="32" cy="33.2" rx="2.7" ry="1.9" fill="#1c1916" />
      <path d="M31 38.3h2.4v2.4a1.2 1.2 0 0 1-2.4 0Z" fill="#d0626a" />
      <path d="M28.8 37.4c1.6 1.5 4.8 1.5 6.4 0" stroke={TRACO} strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </>
  ),
  'avatar-mao': (
    <>
      <rect width="64" height="64" fill="#2f6d6a" />
      <g transform="rotate(-24 32 46)">
        <rect x="24" y="13" width="16" height="25" rx="2.4" fill="#fbf3dc" stroke="#1c1916" strokeWidth=".8" />
        <text x="27" y="19.5" fontSize="6" fontWeight="800" fill="#1c1916" fontFamily="var(--fonte-ui)">
          4
        </text>
        <circle cx="32" cy="23.6" r="2" fill="#1c1916" />
        <circle cx="29.9" cy="26.8" r="2" fill="#1c1916" />
        <circle cx="34.1" cy="26.8" r="2" fill="#1c1916" />
        <rect x="31.3" y="26.5" width="1.4" height="4" fill="#1c1916" />
      </g>
      <g transform="rotate(24 32 46)">
        <rect x="24" y="13" width="16" height="25" rx="2.4" fill="#fbf3dc" stroke="#1c1916" strokeWidth=".8" />
        <text x="27" y="19.5" fontSize="6" fontWeight="800" fill="#1c1916" fontFamily="var(--fonte-ui)">
          A
        </text>
        <path d="M32 21c-2.5 2.8-5 4.3-5 6.5 0 1.5 1.2 2.5 2.5 2.5.9 0 1.6-.4 2-1-.1 1-.6 1.7-1.3 2.2h3.6c-.7-.5-1.2-1.2-1.3-2.2.4.6 1.1 1 2 1 1.3 0 2.5-1 2.5-2.5 0-2.2-2.5-3.7-5-6.5Z" fill="#1c1916" />
      </g>
      <rect x="24" y="12" width="16" height="25" rx="2.4" fill="#fbf3dc" stroke="#1c1916" strokeWidth=".8" />
      <text x="27" y="18.5" fontSize="6" fontWeight="800" fill="#b8202a" fontFamily="var(--fonte-ui)">
        7
      </text>
      <path d="M32 30c-3-2.2-4.5-3.8-4.5-5.6 0-1.4 1-2.4 2.3-2.4 1 0 1.7.6 2.2 1.5.5-.9 1.2-1.5 2.2-1.5 1.3 0 2.3 1 2.3 2.4 0 1.8-1.5 3.4-4.5 5.6Z" fill="#b8202a" />
      <path d="M20 47c0-4 3-6.5 6-6.5h12c3 0 6 2.5 6 6.5v6c0 2-1 3-3 3H23c-2 0-3-1-3-3Z" fill={PELE} />
      <path d="M24 40.5v4M29 40.5v4.5M34 40.5v4.5M39 40.5v4" stroke={SOMBRA} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M21.5 45c-1.6-3.4.6-6 3.6-5.2l6.2 3.8c1 .7.7 2.2-.5 2.3Z" fill={SOMBRA} />
      <rect x="17" y="55" width="30" height="12" rx="3" fill="#b8202a" />
      <rect x="18.5" y="54" width="27" height="3.2" rx="1.5" fill="#fbf3dc" />
    </>
  ),
  'avatar-dono': (
    <>
      <rect width="64" height="64" fill="#9a6337" />
      <path d="M7 66c1-14 10-22 25-22s24 8 25 22Z" fill="#4a76a8" />
      <path d="M26.5 44.4 32 51l5.5-6.6" fill="none" stroke="#2f5a86" strokeWidth="1.6" />
      <path d="M40.5 44.6l10 3.6-2.6 10-9.4-3.6Z" fill="#fbf3dc" />
      <path d="M41.6 48l8.6 3.1M40.8 51.2l8.4 3" stroke="#b8202a" strokeWidth="1.3" />
      <rect x="27.5" y="31" width="9" height="14.5" fill={SOMBRA} />
      <circle cx="22" cy="28" r="2.6" fill={SOMBRA} />
      <circle cx="42" cy="28" r="2.6" fill={SOMBRA} />
      <circle cx="32" cy="27" r="10" fill={PELE} />
      <path d="M22.4 29.5c-1.2-6 .6-9.4 3-10.6l1.2 10Z" fill="#7d776f" />
      <path d="M41.6 29.5c1.2-6-.6-9.4-3-10.6l-1.2 10Z" fill="#7d776f" />
      <ellipse cx="28.4" cy="20.4" rx="2.6" ry="1.4" fill="#ecc39d" />
      <path d="M26.6 23.8h3.8M33.6 23.8h3.8" stroke="#5a544d" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="28.6" cy="26.6" r="1.15" fill={TRACO} />
      <circle cx="35.4" cy="26.6" r="1.15" fill={TRACO} />
      <ellipse cx="32" cy="29.6" rx="1.9" ry="1.5" fill={SOMBRA} />
      <path d="M24.4 33.4c2-3.8 5.2-3.8 7.6-1.9 2.4-1.9 5.6-1.9 7.6 1.9-2.6.7-5.3.2-7.6-1.2-2.3 1.4-5 1.9-7.6 1.2Z" fill="#4a4038" />
    </>
  ),
  'avatar-vo': (
    <>
      <rect width="64" height="64" fill="#7a1a22" />
      <path d="M9 66c1-14 10-21 23-21s22 7 23 21Z" fill="#3f9b66" />
      <path d="M18 52l2 14M46 52l-2 14" stroke="#2d7a4f" strokeWidth="1.4" />
      <path d="M25.6 45 32 51.6 38.4 45Z" fill="#fbf3dc" />
      <rect x="28.2" y="33" width="7.6" height="13" fill={SOMBRA} />
      <circle cx="32" cy="13.6" r="5" fill="#d7d2c8" />
      <circle cx="32" cy="26" r="11" fill="#d7d2c8" />
      <ellipse cx="32" cy="28.6" rx="8.6" ry="9.2" fill={PELE} />
      <path d="M23.5 26.4c1-6 5-8.6 8.5-8.6s7.5 2.6 8.5 8.6c-3-2-5.5-3.6-8.5-3.6s-5.5 1.6-8.5 3.6Z" fill="#d7d2c8" />
      <circle cx="26" cy="32.4" r="1.7" fill="#e07a6a" opacity=".6" />
      <circle cx="38" cy="32.4" r="1.7" fill="#e07a6a" opacity=".6" />
      <circle cx="28.3" cy="28.6" r=".95" fill={TRACO} />
      <circle cx="35.7" cy="28.6" r=".95" fill={TRACO} />
      <circle cx="28.3" cy="28.6" r="3" fill="none" stroke={TRACO} strokeWidth="1.1" />
      <circle cx="35.7" cy="28.6" r="3" fill="none" stroke={TRACO} strokeWidth="1.1" />
      <path d="M31.3 28.4h1.4" stroke={TRACO} strokeWidth="1.1" />
      <path d="M29.4 34.2c1.6 1.2 3.6 1.2 5.2 0" stroke={TRACO} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <g transform="rotate(14 45 54)">
        <rect x="40.5" y="46" width="10" height="14" rx="1.6" fill="#fbf3dc" stroke="#1c1916" strokeWidth=".7" />
        <path d="M45.5 56c-2.2-1.6-3.3-2.8-3.3-4.1 0-1 .8-1.8 1.7-1.8.7 0 1.3.4 1.6 1.1.3-.7.9-1.1 1.6-1.1.9 0 1.7.8 1.7 1.8 0 1.3-1.1 2.5-3.3 4.1Z" fill="#b8202a" />
      </g>
      <circle cx="42" cy="59" r="2.6" fill={PELE} />
    </>
  ),
};

/**
 * Foto do usuário: a imagem enviada, um avatar do site ou, sem nada, a inicial do apelido.
 * Decorativa por padrão (o apelido costuma estar ao lado); `rotulo` a torna uma imagem nomeada.
 */
export function Avatar({
  apelido,
  avatar,
  tamanho = 32,
  rotulo,
  moldura,
}: {
  apelido: string;
  avatar?: string | null;
  tamanho?: number;
  rotulo?: string;
  /** Moldura da loja (`corda`, `madeira`, `neon`, `giz`); ausente/`nenhuma` = sem. */
  moldura?: string | null;
}) {
  const corpo = <AvatarSemMoldura apelido={apelido} avatar={avatar} tamanho={tamanho} rotulo={rotulo} />;
  if (!moldura || moldura === 'nenhuma') return corpo;
  return (
    <span className={`avatar-moldura moldura-${moldura}`} data-moldura={moldura}>
      {corpo}
    </span>
  );
}

function AvatarSemMoldura({ apelido, avatar, tamanho = 32, rotulo }: { apelido: string; avatar?: string | null; tamanho?: number; rotulo?: string }) {
  const nome = rotulo ? { role: 'img', 'aria-label': rotulo } : { 'aria-hidden': true as const };
  const estilo = { width: tamanho, height: tamanho, fontSize: tamanho * 0.45 };
  if (avatar?.startsWith('data:image/')) {
    return (
      <span className="avatar avatar-foto" style={estilo} {...nome}>
        <img src={avatar} alt="" />
      </span>
    );
  }
  const daLoja = avatar?.startsWith('loja:') ? DESENHOS_LOJA[avatar.slice(5)] : undefined;
  if (daLoja) {
    return (
      <span className="avatar avatar-pronto" style={estilo} {...nome}>
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          {daLoja}
        </svg>
      </span>
    );
  }
  const pronto = avatar?.startsWith('pronto:') ? avatar.slice(7) : null;
  if (pronto && ehAvatarPronto(pronto)) {
    return (
      <span className="avatar avatar-pronto" style={estilo} {...nome}>
        <DesenhoAvatar id={pronto} />
      </span>
    );
  }
  return (
    <span className="avatar" style={estilo} {...nome}>
      {apelido.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Reduz a imagem escolhida a um quadrado de `lado` px (corte no centro) e devolve um data URL leve. */
export async function reduzirFoto(arquivo: File, lado = 160): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif|avif|bmp)$/.test(arquivo.type)) throw new Error('escolha uma imagem (JPG, PNG ou WebP)');
  const bitmap = await createImageBitmap(arquivo);
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('não deu para ler a imagem');
  const menor = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, (bitmap.width - menor) / 2, (bitmap.height - menor) / 2, menor, menor, 0, 0, lado, lado);
  bitmap.close?.();
  for (const q of [0.85, 0.7, 0.55]) {
    let url = canvas.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= 58_000) return url;
  }
  throw new Error('a imagem ficou grande demais; tente outra');
}
