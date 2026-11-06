import type { Carta, RegrasMesa } from '@truco/engine';
import { Fragment, useId, useState } from 'react';
import { nomeValor, SIMBOLO } from '../logica/cartas';
import { type DegrauOrdem, ordemDasCartas } from '../logica/ordem';
import { cx } from './cx';
import { ChapeuCoringa } from './FiguraCarta';

const CHAVE = 'truco.guiaOrdem';
/** A partir desta largura o guia vira uma escada na margem esquerda, fora da mesa (igual ao CSS). */
const LARGURA_MARGEM = '(min-width: 1240px)';

function lerAberto(): boolean {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v !== null) return v === '1';
  } catch {
    /* sem armazenamento: cai no padrão */
  }
  // Aberto de cara só quando cabe na margem da tela (ver CSS); senão cobriria a mesa.
  return window.matchMedia?.(LARGURA_MARGEM).matches ?? false;
}

function gravarAberto(aberto: boolean): void {
  try {
    localStorage.setItem(CHAVE, aberto ? '1' : '0');
  } catch {
    /* ignora */
  }
}

/** Nome lido pelo leitor de tela: a carta, nunca o apelido da manilha. */
function rotuloDegrau(d: DegrauOrdem): string {
  const base = d.grupo === 'coringa' ? 'Coringa' : d.naipe ? `${nomeValor(d.valor)} de ${d.naipe}` : nomeValor(d.valor);
  return d.minhas > 0 ? `${base}, você tem ${d.minhas === 1 ? 'uma' : d.minhas}` : base;
}

function Degrau({ d }: { d: DegrauOrdem }) {
  const vermelha = d.naipe === 'copas' || d.naipe === 'ouros';
  return (
    <li
      className={cx('degrau', `degrau-${d.grupo}`, vermelha && 'vermelha', d.minhas > 0 && 'minha')}
      aria-label={rotuloDegrau(d)}
    >
      <span className="degrau-carta" aria-hidden="true">
        {d.grupo === 'coringa' ? (
          <ChapeuCoringa />
        ) : (
          <>
            {d.valor}
            {d.naipe && <span className="degrau-naipe">{SIMBOLO[d.naipe]}</span>}
          </>
        )}
      </span>
      {d.minhas > 1 && (
        <span className="degrau-qtd" aria-hidden="true">
          ×{d.minhas}
        </span>
      )}
    </li>
  );
}

interface Props {
  regras: Pick<RegrasMesa, 'variante' | 'maoLimpa'>;
  vira: Carta | null;
  mao: readonly (Carta | null)[];
}

/**
 * Guia no canto da mesa: a ordem das cartas da mais forte para a mais fraca, com as da
 * minha mão marcadas. Recolhe num botão; a escolha fica gravada.
 */
export function GuiaOrdem({ regras, vira, mao }: Props) {
  const [aberto, setAberto] = useState(lerAberto);
  const id = useId();
  const { degraus, manilhasPendentes } = ordemDasCartas(regras, vira, mao);
  const alternar = () => {
    setAberto((a) => {
      gravarAberto(!a);
      return !a;
    });
  };

  return (
    <div className={cx('guia-ordem', aberto && 'aberto')}>
      <button type="button" className="guia-ordem-botao" aria-expanded={aberto} aria-controls={id} onClick={alternar}>
        Ordem
      </button>
      {aberto && (
        <div className="guia-ordem-painel" id={id}>
          <span className="guia-ordem-ponta ponta-forte" aria-hidden="true">
            mais forte
          </span>
          <span className="guia-ordem-ponta ponta-fraca" aria-hidden="true">
            mais fraca
          </span>
          <ol className="guia-ordem-lista" aria-label="Ordem das cartas, da mais forte para a mais fraca">
            {manilhasPendentes && (
              <li className="degrau degrau-manilha degrau-pendente" aria-label="Manilhas: a carta seguinte à vira">
                <span className="degrau-carta" aria-hidden="true">
                  ?
                </span>
              </li>
            )}
            {degraus.map((d, i) => (
              <Fragment key={d.forca}>
                {i > 0 && degraus[i - 1].grupo !== d.grupo && <li className="degrau-divisa" aria-hidden="true" />}
                {i === 0 && manilhasPendentes && <li className="degrau-divisa" aria-hidden="true" />}
                <Degrau d={d} />
              </Fragment>
            ))}
          </ol>
          {manilhasPendentes && <p className="guia-ordem-nota">Manilhas: a carta seguinte à vira, nos quatro naipes.</p>}
        </div>
      )}
    </div>
  );
}
