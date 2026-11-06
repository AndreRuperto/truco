import type { Cadeira } from '@truco/engine';
import { type CSSProperties, useLayoutEffect, useRef } from 'react';
import { posicaoRelativa } from '../logica/posicoes';
import { deslizarDe } from './animacaoMesa';
import { cx } from './cx';

interface Props {
  qtd: number;
  /** Quem está com o monte (null = no meio da mesa). */
  dono: Cadeira | null;
  minha: Cadeira;
}

/** Pilha de versos com a contagem, puxada para o lado de quem está com ela; desliza quando muda de mão. */
export function Monte({ qtd, dono, minha }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const antes = useRef<{ lugar: string; ret: DOMRect } | null>(null);
  const lugar = dono === null ? 'meio' : posicaoRelativa(minha, dono);
  useLayoutEffect(() => {
    const el = ref.current;
    // Sem monte na mesa (0 cartas), não há de onde deslizar: o próximo aparece no lugar.
    if (!el) {
      antes.current = null;
      return;
    }
    const a = antes.current;
    if (a && a.lugar !== lugar) deslizarDe(el, a.ret);
    // Mede de novo também quando a contagem muda (a pilha muda de tamanho).
    antes.current = { lugar, ret: el.getBoundingClientRect() };
  }, [lugar, qtd]);
  if (qtd === 0) return null;
  const camadas = Math.max(1, Math.min(5, Math.ceil(qtd / 8)));
  return (
    <div ref={ref} className={cx('monte', `monte-${lugar}`)} data-testid="monte" role="img" aria-label={`Monte com ${qtd} cartas`}>
      {Array.from({ length: camadas }, (_, i) => (
        <span key={i} className="carta verso monte-camada" style={{ '--i': i } as CSSProperties} aria-hidden="true" />
      ))}
      <span className="monte-qtd" aria-hidden="true">
        {qtd}
      </span>
    </div>
  );
}
