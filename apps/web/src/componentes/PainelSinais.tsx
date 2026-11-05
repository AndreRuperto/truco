import { SINAIS, type Sinal } from '@truco/protocolo';
import { INFO_SINAL, type SinalRecebido, textoSinalRecebido } from '../logica/sinais';
import { useAgora } from '../rede/hooks';

/** Depois disso o "último sinal recebido" já não diz respeito à jogada atual. */
export const VALIDADE_SINAL_MS = 8_000;

interface Props {
  /** Chance (0–1) de cada adversário ver o sinal (`MsgEstado.chanceInterceptarSinal`). */
  chanceInterceptar: number;
  aoEnviar: (s: Sinal) => void;
  /** `em` = carimbo do evento no feed (relógio local). */
  ultimo: (SinalRecebido & { em: number }) | null;
}

export function PainelSinais({ chanceInterceptar, aoEnviar, ultimo }: Props) {
  const agora = useAgora(500);
  const recente = ultimo && agora - ultimo.em < VALIDADE_SINAL_MS ? ultimo : null;
  return (
    <section className="painel painel-sinais" aria-label="Sinais">
      <p className="dica-painel">
        {chanceInterceptar > 0 ? 'Só seu parceiro vê — mas os adversários podem interceptar.' : 'Só seu parceiro vê.'}
      </p>
      <div className="grade-sinais">
        {SINAIS.map((s) => (
          <button key={s} type="button" aria-label={INFO_SINAL[s].descricao} title={INFO_SINAL[s].descricao} onClick={() => aoEnviar(s)}>
            <span aria-hidden="true">{INFO_SINAL[s].emoji}</span>
          </button>
        ))}
      </div>
      {recente && (
        <p className="sinal-recebido" role="status">
          {textoSinalRecebido(recente)}
        </p>
      )}
    </section>
  );
}
