import type { Cadeira, FamiliaVisivel, Visao } from '@truco/engine';
import { useEffect, useRef, useState } from 'react';
import { posicaoRelativa } from '../logica/posicoes';
import { textoFamilia } from '../logica/ritual';
import { CartaVisual } from './CartaVisual';
import { cx } from './cx';

interface Props {
  visao: Visao;
  nome: (c: Cadeira) => string;
}

/** Tempo que a família recém-conferida segura na mesa: a revelação das 3 (3 x 320 ms) e uma folga. */
export const SEGURA_CONFERIDA_MS = 1_500;

/** As 3 abertas no corte (ao lado do monte) e a última família de cada cadeira, na frente dela. */
export function FamiliasNaMesa({ visao, nome }: Props) {
  const m = visao.mao;
  const abertas = m?.abertasNoCorte ?? visao.ritual?.abertas ?? [];
  const familias = m?.familias ?? [];
  // A família só fica na mesa até cair a 1ª carta: depois a janela de pedir/conferir passou (os
  // pontos já estão no placar) e as figuras ao redor da cruz cruzavam as cartas jogadas. Exceção: a
  // conferida há pouco fica até terminar de revelar as 3 (no modo rápido o bot joga na hora).
  const comecou = !!m && (m.rodadas.length > 0 || m.mesa.length > 0);
  const conferidaEm = useRef(new Map<number, number>());
  const [, redesenhar] = useState(0);
  familias.forEach((f, i) => {
    if (!f.conferida) conferidaEm.current.delete(i);
    else if (!conferidaEm.current.has(i)) conferidaEm.current.set(i, Date.now());
  });
  const agora = Date.now();
  const segura = (i: number) => {
    const em = conferidaEm.current.get(i);
    return em !== undefined && agora - em < SEGURA_CONFERIDA_MS;
  };
  // A espera vale só enquanto a 1ª rodada não fechou: fechada, a pilha das rodadas ocupa o canto.
  const rodadaFechada = !!m && m.rodadas.length > 0;
  const visiveis = familias.map((f, i) => ({ f, i })).filter(({ i }) => !comecou || (!rodadaFechada && segura(i)));
  const proximaSaida = comecou && visiveis.length > 0
    ? Math.min(...visiveis.map(({ i }) => conferidaEm.current.get(i)! + SEGURA_CONFERIDA_MS - agora))
    : null;
  useEffect(() => {
    if (proximaSaida === null) return;
    const t = setTimeout(() => redesenhar((n) => n + 1), Math.max(0, proximaSaida) + 10);
    return () => clearTimeout(t);
  }, [proximaSaida]);
  if (abertas.length === 0 && visiveis.length === 0) return null;
  const variante = visao.regras.variante;
  const vira = m?.vira ?? null;
  const ultimas = new Map<Cadeira, number>();
  visiveis.forEach(({ f, i }) => ultimas.set(f.cadeira, i));
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
            <CartasDaFamilia familia={f} minha={visao.cadeira} variante={variante} vira={vira} />
            <figcaption>{textoFamilia(f, visao, nome)}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** Conferida agora: para os adversários, vira a 1ª, a 2ª e a 3ª, sem revelar tudo instantaneamente. */
function CartasDaFamilia({
  familia,
  minha,
  variante,
  vira,
}: {
  familia: FamiliaVisivel;
  minha: Cadeira;
  variante: Visao['regras']['variante'];
  vira: import('@truco/engine').Carta | null;
}) {
  const jaConferida = useRef(familia.conferida !== null);
  const [abertas, setAbertas] = useState(familia.conferida ? 3 : 0);
  useEffect(() => {
    if (!familia.conferida) {
      jaConferida.current = false;
      setAbertas(0);
      return;
    }
    // Ao abrir a tela durante uma conferência já encerrada, não repetir a animação.
    if (jaConferida.current) return;
    jaConferida.current = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setAbertas(3);
      return;
    }
    const timers = [1, 2, 3].map((n) => setTimeout(() => setAbertas(n), n * 320));
    return () => timers.forEach(clearTimeout);
  }, [familia.conferida?.por]);

  const esconderAteVirar = familia.tipo === 'fechada' && familia.conferida !== null && familia.cadeira !== minha;
  return (
    <div className="familia-cartas" data-abertas={esconderAteVirar ? abertas : familia.cartas ? 3 : 0}>
      {(familia.cartas ?? [null, null, null]).map((c, k) => (
        <span key={k} className={esconderAteVirar && k < abertas ? 'familia-carta-revelada' : undefined}>
          <CartaVisual carta={esconderAteVirar && k >= abertas ? null : c} variante={variante} vira={vira} tamanho="pequena" />
        </span>
      ))}
    </div>
  );
}
