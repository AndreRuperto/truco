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

/** Avatares exclusivos da loja (`loja:<id do item>`), no mesmo traço dos prontos. */
export const DESENHOS_LOJA: Record<string, ReactNode> = {
  'avatar-violeiro': (
    <>
      <circle cx="32" cy="32" r="32" fill="#2d6a45" />
      <ellipse cx="32" cy="18" rx="17" ry="4.5" fill="#e8c35e" />
      <path d="M22 18c0-7 4-11 10-11s10 4 10 11Z" fill="#e8c35e" />
      <circle cx="32" cy="26" r="8" fill="#d9a47a" />
      <path d="M24 30c2 3 5 4 8 4s6-1 8-4" stroke="#3a2618" strokeWidth="2" fill="none" />
      <path d="M14 64c0-14 8-22 18-22s18 8 18 22Z" fill="#b8202a" />
      <g transform="rotate(-30 32 50)">
        <ellipse cx="32" cy="52" rx="9" ry="7" fill="#e3a35b" />
        <circle cx="32" cy="52" r="2.4" fill="#5e3a1f" />
        <rect x="30.6" y="30" width="2.8" height="18" fill="#5e3a1f" />
      </g>
    </>
  ),
  'avatar-garrafa': (
    <>
      <circle cx="32" cy="32" r="32" fill="#24304a" />
      <rect x="10" y="46" width="44" height="8" rx="2" fill="#9a6337" />
      <path d="M28 10h8v8c0 2 4 4 4 9v19H24V27c0-5 4-7 4-9Z" fill="#3f9b66" />
      <rect x="27" y="8" width="10" height="4" rx="1" fill="#e9b02c" />
      <rect x="26" y="30" width="12" height="9" rx="1.5" fill="#fbf3dc" />
      <path d="M44 40h7v6h-7Z" fill="#e9b02c" />
      <path d="M43 36h9" stroke="#fbf3dc" strokeWidth="3" strokeLinecap="round" />
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
