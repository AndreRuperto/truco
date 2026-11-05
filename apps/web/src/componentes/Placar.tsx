interface Props {
  nos: number;
  eles: number;
  /** Valor atual da mão (null entre mãos). */
  valor: number | null;
}

export function Placar({ nos, eles, valor }: Props) {
  return (
    <header className="placar" aria-label="Placar">
      <span className="nos">
        Nós <strong>{nos}</strong>
      </span>
      <span className="valor">{valor !== null ? `Mão vale ${valor}` : ''}</span>
      <span className="eles">
        <strong>{eles}</strong> Eles
      </span>
    </header>
  );
}
