import { SINAIS, type Sinal } from '@truco/protocolo';
import { INFO_SINAL, type SinalRecebido, textoSinalRecebido } from '../logica/sinais';

interface Props {
  aoEnviar: (s: Sinal) => void;
  ultimo: SinalRecebido | null;
}

export function PainelSinais({ aoEnviar, ultimo }: Props) {
  return (
    <section className="painel painel-sinais" aria-label="Sinais">
      <p className="dica-painel">Só seu parceiro vê — mas os adversários podem interceptar.</p>
      <div className="grade-sinais">
        {SINAIS.map((s) => (
          <button key={s} type="button" aria-label={INFO_SINAL[s].descricao} title={INFO_SINAL[s].descricao} onClick={() => aoEnviar(s)}>
            <span aria-hidden="true">{INFO_SINAL[s].emoji}</span>
          </button>
        ))}
      </div>
      {ultimo && (
        <p className="sinal-recebido" role="status">
          {textoSinalRecebido(ultimo)}
        </p>
      )}
    </section>
  );
}
