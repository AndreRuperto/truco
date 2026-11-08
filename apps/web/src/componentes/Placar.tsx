interface Props {
  nos: number;
  eles: number;
  /** Valor atual da mão (null entre mãos). */
  valor: number | null;
  /** Pedido pendente curto ("Pediram Seis!"), ou null. */
  pedido?: string | null;
  /** Fase/vez resumida, sem alterar cronômetro ou o estado da partida. */
  situacao?: string;
}

/** Riscos de giz levemente tortos (4 em pé; o 5º corta os quatro). */
const RISCOS = ['M4 2.5 Q5 9 4.4 16', 'M9.6 2 Q9 9.5 10 16.2', 'M15 2.8 Q16 9 15.2 15.8', 'M20.4 2.2 Q20 9 20.8 16'];
const CORTE = 'M1.5 12.5 Q12 8 23 4.5';

function Tentos({ pontos }: { pontos: number }) {
  const grupos: number[] = [];
  for (let resta = Math.max(0, pontos); resta > 0; resta -= 5) grupos.push(Math.min(5, resta));
  return (
    <span className="tentos" aria-hidden="true">
      {grupos.map((n, i) => (
        <svg key={i} className="tento" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {RISCOS.slice(0, Math.min(n, 4)).map((d) => (
            <path key={d} d={d} />
          ))}
          {n === 5 && <path d={CORTE} />}
        </svg>
      ))}
    </span>
  );
}

/** Lousa do placar: tentos riscados a giz de cada lado e o valor da mão no meio. */
export function Placar({ nos, eles, valor, pedido = null, situacao }: Props) {
  const rotulo = `Placar: Nós ${nos}, Eles ${eles}` + (valor !== null ? `, mão vale ${valor}` : '') + (pedido ? `, ${pedido}` : '');
  return (
    <header className="placar" role="group" aria-label={rotulo}>
      <span className="placar-lado nos">
        <span className="placar-nome">Nós</span>
        <strong className="placar-num">{nos}</strong>
        <Tentos pontos={nos} />
      </span>
      <span className="placar-centro">
        {valor !== null && (
          <span className="placar-valor">
            Mão vale <strong>{valor}</strong>
          </span>
        )}
        {pedido && <span className="placar-pedido">{pedido}</span>}
        {situacao && <span className="placar-situacao"><span aria-hidden="true" className="placar-status-ponto" />{situacao}</span>}
      </span>
      <span className="placar-lado eles">
        <strong className="placar-num">{eles}</strong>
        <span className="placar-nome">Eles</span>
        <Tentos pontos={eles} />
      </span>
    </header>
  );
}
