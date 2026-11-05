import { FALAS, type Fala } from '@truco/protocolo';
import { FALA_TEXTO } from '../logica/eventos';

export function PainelFalas({ aoEnviar }: { aoEnviar: (f: Fala) => void }) {
  return (
    <section className="painel painel-falas" aria-label="Falas">
      <div className="grade-falas">
        {FALAS.map((f) => (
          <button key={f} type="button" onClick={() => aoEnviar(f)}>
            {FALA_TEXTO[f]}
          </button>
        ))}
      </div>
    </section>
  );
}
