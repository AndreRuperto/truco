import type { Variante } from '@truco/engine';
import { useEffect, useRef } from 'react';
import { Manual } from './Manual';

/** O manual por cima da mesa: a partida continua rodando atrás. Fecha no botão ou no Esc. */
export function ManualMesa({ aoFechar, variante }: { aoFechar: () => void; variante?: Variante }) {
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      anterior?.focus?.();
    };
  }, [aoFechar]);
  return (
    <div className="manual-mesa-fundo" onClick={aoFechar}>
      <div className="manual-mesa" role="dialog" aria-modal="true" aria-labelledby="manual-mesa-titulo" onClick={(e) => e.stopPropagation()}>
        <header className="manual-mesa-topo">
          <h2 id="manual-mesa-titulo">Como jogar</h2>
          <button ref={fechar} type="button" onClick={aoFechar}>
            Voltar pra mesa
          </button>
        </header>
        <div className="manual-mesa-corpo">
          <Manual varianteInicial={variante} />
        </div>
      </div>
    </div>
  );
}
