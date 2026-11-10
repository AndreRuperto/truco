import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Cabeçalhos de segurança (auditoria 2026-11-10, WEB-07). A CSP é a segunda camada caso um XSS
 * apareça um dia; frame-ancestors/X-Frame-Options impedem embutir o jogo num site de terceiros
 * (clickjacking); HSTS só em produção (HTTPS garantido pelo Railway).
 *
 * Origens externas que o app realmente usa: fontes do Google (index.html) e o login com Google
 * (Google Identity Services: script, iframe, estilos e chamadas em accounts.google.com/gsi/).
 */
const GSI = 'https://accounts.google.com/gsi/';

/** Hashes CSP dos <script> inline (sem src) do index.html: o script de tema roda antes do bundle. */
export function hashesDeScriptsInline(html: string): string[] {
  const hashes: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (m[1].trim()) hashes.push(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  }
  return hashes;
}

export function politicaDeConteudo(o: { producao: boolean; urlPublica: string | null; hashesScript: string[] }): string {
  // WebSocket: em produção, só o domínio público (mesma origem do site); fora dela, qualquer
  // ws/wss (dev usa o Vite numa porta e o servidor em outra).
  const host = o.urlPublica ? new URL(o.urlPublica).host : null;
  const ws = o.producao && host ? [`wss://${host}`] : ['ws:', 'wss:'];
  const d: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", ...o.hashesScript, `${GSI}client`],
    // Estilos inline: o Google injeta os dele e o React usa style; injeção de CSS não executa código.
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', `${GSI}style`],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    // Avatares são data URL (validados no servidor); a cena 3D usa blob.
    'img-src': ["'self'", 'data:', 'blob:'],
    'media-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", ...ws, GSI],
    'frame-src': [GSI],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(d)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

export function cabecalhosSeguranca(o: { producao: boolean; urlPublica: string | null; hashesScript: () => string[] }): RequestHandler {
  let csp: string | null = null;
  return (_req, res, next) => {
    csp ??= politicaDeConteudo({ producao: o.producao, urlPublica: o.urlPublica, hashesScript: o.hashesScript() });
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    // O popup do login com Google precisa falar com a janela que o abriu.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (o.producao) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}
