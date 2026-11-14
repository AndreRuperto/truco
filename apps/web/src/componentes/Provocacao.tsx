import type { CSSProperties } from 'react';
import type { EfeitoProvocacao } from '@truco/protocolo';

/** Quanto tempo o efeito fica sobre o assento (a animação do CSS dura isso). */
export const DURACAO_PROVOCACAO_MS = 1_600;

/** Texto curto de cada efeito: aparece no lugar da animação com movimento reduzido. */
export const TEXTO_EFEITO: Record<EfeitoProvocacao, string> = {
  guardanapo: 'guardanapada!',
  laco: 'laçado!',
  farpa: 'farpa!',
  ofusca: 'ofuscado!',
  'po-de-giz': 'giz na cara!',
};

/** Frase da região da mesa quando o alvo é você ("Ana te laçou!"). */
export const FRASE_EFEITO: Record<EfeitoProvocacao, (quem: string) => string> = {
  guardanapo: (q) => `${q} jogou um guardanapo em você!`,
  laco: (q) => `${q} te laçou!`,
  farpa: (q) => `${q} jogou uma farpa em você!`,
  ofusca: (q) => `${q} te ofuscou com o neon!`,
  'po-de-giz': (q) => `${q} soprou pó de giz em você!`,
};

/**
 * O efeito da moldura sobre o assento do alvo (só visual, CSS em estilos.css: `.provocacao`).
 * Desenhado sobre o assento; some quando o pai deixa de renderizar (depois de DURACAO_PROVOCACAO_MS).
 */
export function Provocacao({ efeito }: { efeito: EfeitoProvocacao }) {
  return (
    <span className={`provocacao efeito-${efeito}`} aria-hidden="true" data-testid="provocacao" data-efeito={efeito}>
      {efeito === 'laco' && (
        <svg className="provocacao-laco" viewBox="0 0 100 60" focusable="false">
          <ellipse cx="50" cy="30" rx="46" ry="24" />
          <path d="M92 26 C100 10, 96 2, 86 0" />
        </svg>
      )}
      {efeito === 'farpa' && <span className="provocacao-farpa" />}
      {efeito === 'ofusca' && <span className="provocacao-clarao" />}
      {efeito === 'po-de-giz' && (
        <span className="provocacao-po">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </span>
      )}
      {efeito === 'guardanapo' && <span className="provocacao-bolinha" />}
      <span className="provocacao-texto">{TEXTO_EFEITO[efeito]}</span>
    </span>
  );
}
