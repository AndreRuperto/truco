import { ComandosBaralhoTreino, MonteBaralhoTreino, useBaralhoTreino } from './BaralhoTreino';

/** Floreios na própria vez de embaralhar (habilidade da loja): cada truque embaralha de verdade. */
export function BaralhoNaPartida({ aoEmbaralhar }: { aoEmbaralhar: () => void }) {
  const treino = useBaralhoTreino(aoEmbaralhar);
  return (
    <aside className="baralho-na-partida" data-testid="treino-na-partida" aria-label="Floreios ao embaralhar">
      <div className="baralho-na-partida-monte">
        <MonteBaralhoTreino treino={treino} />
      </div>
      <ComandosBaralhoTreino treino={treino} contexto="partida" />
    </aside>
  );
}
