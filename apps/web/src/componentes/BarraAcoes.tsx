import type { AcaoJogador } from '@truco/engine';
import type { BotaoAcao } from '../logica/acoes';
import { cx } from './cx';

interface Props {
  botoes: BotaoAcao[];
  /** Ex.: "Pediram Truco! Vale 3." */
  pedido: string | null;
  aoEscolher: (a: AcaoJogador) => void;
}

export function BarraAcoes({ botoes, pedido, aoEscolher }: Props) {
  if (botoes.length === 0 && !pedido) return null;
  return (
    <div className="barra-acoes" role="toolbar" aria-label="Ações">
      {pedido && <span className="pedido">{pedido}</span>}
      {botoes.map((b) => (
        <button key={b.chave} type="button" className={cx('acao', `tom-${b.tom}`)} onClick={() => aoEscolher(b.acao)}>
          {b.rotulo}
        </button>
      ))}
    </div>
  );
}
