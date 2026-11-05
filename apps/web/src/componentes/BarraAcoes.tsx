import type { AcaoJogador } from '@truco/engine';
import type { BotaoAcao } from '../logica/acoes';
import { cx } from './cx';

/** Amarelo de grito só para pedir/aumentar; aceitar em verde; o resto principal em papel. */
const ESTILO: Partial<Record<BotaoAcao['chave'], string>> = {
  truco: 'grito',
  aumentar: 'grito',
  aceitar: 'aceitar',
  familia: 'papel',
  'mao10-sim': 'papel',
};

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
      {/* o placar já mostra o pedido em giz; aqui fica para o leitor de tela, junto dos botões */}
      {pedido && <span className="pedido so-leitor">{pedido}</span>}
      {botoes.map((b) => (
        <button key={b.chave} type="button" className={cx('acao', `tom-${b.tom}`, ESTILO[b.chave])} onClick={() => aoEscolher(b.acao)}>
          {b.rotulo}
        </button>
      ))}
    </div>
  );
}
