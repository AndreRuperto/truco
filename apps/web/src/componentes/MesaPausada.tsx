import { useEffect, useRef } from 'react';

interface Props {
  /** Quanto falta para a mesa voltar sozinha (o servidor tem um limite de pausa). */
  restamMs: number;
  /** Nome de quem pausou, quando não foi você; null = você pausou. */
  quem: string | null;
  /** Presente para quem pode retomar (sozinho contra bots; na privada, o admin). */
  aoRetomar?: () => void;
}

const relogio = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Aviso por cima da mesa enquanto ela está pausada: ninguém joga e nenhum prazo corre. */
export function MesaPausada({ restamMs, quem, aoRetomar }: Props) {
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => botao.current?.focus(), []);
  return (
    <div className="mesa-pausada" role="dialog" aria-labelledby="titulo-mesa-pausada" data-testid="mesa-pausada">
      <div className="mesa-pausada-caixa">
        <h2 id="titulo-mesa-pausada">Mesa pausada</h2>
        {quem && <p>{quem} pausou a mesa.</p>}
        <p className="mesa-pausada-tempo">Volta sozinha em {relogio(restamMs)}</p>
        {aoRetomar && (
          <button ref={botao} type="button" className="botao-principal" onClick={aoRetomar}>
            Continuar
          </button>
        )}
      </div>
    </div>
  );
}
