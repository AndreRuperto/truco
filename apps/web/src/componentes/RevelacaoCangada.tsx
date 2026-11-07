import type { Cadeira, Variante } from '@truco/engine';
import type { JogadaExibida } from '../logica/jogadas';
import { posicaoRelativa } from '../logica/posicoes';
import { CartaVisual } from './CartaVisual';

/** Revelação lateral da cangada: uma carta de cada vez, na ordem da rodada. */
export interface DadosCangadaLateral {
  jogadas: JogadaExibida[];
  abertas: number;
}

const ROTULOS = { baixo: 'Você', cima: 'Parceiro', esquerda: 'Esquerda', direita: 'Direita' } as const;

export function RevelacaoCangada({
  dados,
  variante,
  vira,
  minha,
}: {
  dados: DadosCangadaLateral | null;
  variante: Variante;
  vira: import('@truco/engine').Carta | null;
  minha: Cadeira;
}) {
  if (!dados) return null;
  return (
    <aside className="cangada-lateral" aria-label="Revelação da cangada" data-testid="cangada-lateral" data-abertas={dados.abertas}>
      <strong>Cangou! Carta por carta</strong>
      <div className="cangada-lateral-cartas">
        {dados.jogadas.map(({ chave, jogada }, i) => (
          <span key={chave} className={i < dados.abertas ? 'cangada-lateral-item aberta' : 'cangada-lateral-item'}>
            <CartaVisual carta={i < dados.abertas ? jogada.carta : null} variante={variante} vira={vira} tamanho="pequena" />
            <small>{ROTULOS[posicaoRelativa(minha, jogada.cadeira)]}</small>
          </span>
        ))}
      </div>
    </aside>
  );
}
