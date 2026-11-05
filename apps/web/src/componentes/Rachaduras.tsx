import type { Cadeira } from '@truco/engine';
import type { Rachadura, TipoMesa } from '@truco/protocolo';
import { memo } from 'react';
import { caminho, gerarRachadura, paraRelativa } from '../logica/batida';
import { cx } from './cx';

const r1 = (n: number) => Math.round(n * 10) / 10;

interface Props {
  rachaduras: Rachadura[];
  tipo: TipoMesa;
  minha: Cadeira;
  /** A que acabou de aparecer (cresce a partir da borda). */
  novaId?: number | null;
}

/**
 * Fendas na madeira (ou amassados no plástico) desenhadas da `semente`, sob as cartas.
 * viewBox 0..100 esticado no tampo; traço sem escala para manter a espessura.
 */
export const Rachaduras = memo(function Rachaduras({ rachaduras, tipo, minha, novaId }: Props) {
  if (rachaduras.length === 0) return null;
  const marca = tipo === 'plastico';
  return (
    <svg className="rachaduras" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {rachaduras.map((r) => {
        const p = paraRelativa(r, minha);
        // No plástico a marca é curta: amassado com arranhões, não fenda que atravessa.
        const forma = gerarRachadura(r.semente, marca ? r.tamanho * 0.45 : r.tamanho);
        const linhas = [forma.principal, ...forma.ramos].map(caminho);
        return (
          <g
            key={r.id}
            className={cx('rachadura', marca && 'marca', r.id === novaId && 'nova')}
            transform={`translate(${r1(p.x * 100)} ${r1(p.y * 100)}) rotate(${r1(p.angulo)})`}
          >
            {marca && <ellipse className="amassado" cx="0" cy="0" rx={r1(r.tamanho * 9)} ry={r1(r.tamanho * 6)} />}
            {linhas.map((d, i) => (
              <path key={`b${i}`} className={cx('borda', i > 0 && 'ramo')} d={d} pathLength={1} vectorEffect="non-scaling-stroke" />
            ))}
            {linhas.map((d, i) => (
              <path key={`f${i}`} className={cx('fenda', i > 0 && 'ramo')} d={d} pathLength={1} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        );
      })}
    </svg>
  );
});
