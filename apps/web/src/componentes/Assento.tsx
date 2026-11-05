import { type Carta, idCarta, type Variante } from '@truco/engine';
import type { InfoCadeira, MsgEstado } from '@truco/protocolo';
import type { Posicao } from '../logica/posicoes';
import { CartaVisual } from './CartaVisual';
import { Cronometro } from './Cronometro';
import { cx } from './cx';

interface Props {
  posicao: Posicao;
  info: InfoCadeira | undefined;
  qtdCartas: number;
  daVez: boolean;
  balao: string | null;
  /** Cartas visíveis (mão do parceiro na mão de 10). */
  maoVisivel: Carta[] | null;
  variante: Variante;
  vira: Carta | null;
  /** Prazo desta cadeira (só quando ela está em `prazo.cadeiras`): mostra um cronômetro pequeno. */
  prazo?: NonNullable<MsgEstado['prazo']> | null;
  agora?: number;
}

export function Assento({ posicao, info, qtdCartas, daVez, balao, maoVisivel, variante, vira, prazo = null, agora = 0 }: Props) {
  return (
    <div className={cx('assento', `pos-${posicao}`, daVez && 'da-vez')} data-testid={`assento-${posicao}`}>
      <div className="assento-nome">
        {info?.nome ?? '—'}
        {info?.tipo === 'bot' && <span className="etiqueta">bot</span>}
        {info && !info.conectado && <span className="etiqueta off">desconectado</span>}
        {daVez && <span className="etiqueta">vez</span>}
      </div>
      {prazo && <Cronometro prazo={prazo} agora={agora} rotulo={`Vez de ${info?.nome ?? 'jogador'}`} pequeno />}
      {maoVisivel ? (
        <div className="assento-cartas visivel">
          {maoVisivel.map((c) => (
            <CartaVisual key={idCarta(c)} carta={c} variante={variante} vira={vira} tamanho="pequena" />
          ))}
        </div>
      ) : qtdCartas > 0 ? (
        <div className="assento-cartas" title={`${qtdCartas} cartas`}>
          {Array.from({ length: qtdCartas }, (_, i) => (
            <CartaVisual key={i} carta={null} variante={variante} vira={vira} tamanho="pequena" />
          ))}
        </div>
      ) : null}
      {balao && (
        <div className="balao" role="status">
          {balao}
        </div>
      )}
    </div>
  );
}
