import type { Cadeira, Visao } from '@truco/engine';
import { posicaoRelativa } from '../logica/posicoes';
import { textoFamilia } from '../logica/ritual';
import { CartaVisual } from './CartaVisual';
import { cx } from './cx';

interface Props {
  visao: Visao;
  nome: (c: Cadeira) => string;
}

/** As 3 abertas no corte (ao lado do monte) e a última família de cada cadeira, na frente dela. */
export function FamiliasNaMesa({ visao, nome }: Props) {
  const m = visao.mao;
  const abertas = m?.abertasNoCorte ?? visao.ritual?.abertas ?? [];
  const familias = m?.familias ?? [];
  if (abertas.length === 0 && familias.length === 0) return null;
  const variante = visao.regras.variante;
  const vira = m?.vira ?? null;
  const ultimas = new Map<Cadeira, number>();
  familias.forEach((f, i) => ultimas.set(f.cadeira, i));
  return (
    <div className="familias">
      {abertas.length > 0 && (
        <figure className="familia abertas-corte" data-testid="abertas-corte">
          <div className="familia-cartas">
            {abertas.map((c, i) => (
              <CartaVisual key={i} carta={c} variante={variante} vira={vira} tamanho="pequena" />
            ))}
          </div>
          <figcaption>Abertas no corte</figcaption>
        </figure>
      )}
      {[...ultimas.values()].map((i) => {
        const f = familias[i];
        return (
          <figure
            key={i}
            className={cx('familia', `pos-${posicaoRelativa(visao.cadeira, f.cadeira)}`)}
            data-familia={i}
            data-conferida={f.conferida ? 'sim' : undefined}
            data-testid={f.conferida ? 'familia-conferida' : 'familia'}
          >
            <div className="familia-cartas">
              {(f.cartas ?? [null, null, null]).map((c, k) => (
                <CartaVisual key={k} carta={c} variante={variante} vira={vira} tamanho="pequena" />
              ))}
            </div>
            <figcaption>{textoFamilia(f, visao, nome)}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
