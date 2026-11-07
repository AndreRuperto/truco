import { ComandosBaralhoTreino, MonteBaralhoTreino, useBaralhoTreino } from './BaralhoTreino';

/** Passatempo local durante a própria vez de embaralhar, sem enviar ações ao motor. */
export function BaralhoNaPartida() {
  const treino = useBaralhoTreino();
  return (
    <aside className="baralho-na-partida" data-testid="treino-na-partida" aria-label="Treino de embaralhamento na partida">
      <div className="baralho-na-partida-monte">
        <MonteBaralhoTreino treino={treino} />
      </div>
      <ComandosBaralhoTreino treino={treino} contexto="partida" />
    </aside>
  );
}
